"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Phone, Search, Users } from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import AdminShell from "@/components/admin/AdminShell";
import EnquiryStatusBadge, {
  ENQUIRY_STATUS,
  type EnquiryStatus,
} from "@/components/admin/EnquiryStatusBadge";
import { Input } from "@/components/ui/input";
import { formatMnt } from "@/lib/pricing";
import { cn } from "@/lib/utils";

type Enquiry = {
  id: string;
  reference: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  adults: number;
  children: number;
  infants: number;
  message: string | null;
  estimatedTotal: number | null;
  status: EnquiryStatus;
  staffNotes: string | null;
  departureDate: string | null;
  createdAt: string;
  trip: { id: string; slug: string; title: string; image: string } | null;
};

type Response = {
  enquiries: Enquiry[];
  newCount: number;
  pagination: { page: number; total: number; totalPages: number };
};

const FILTERS: Array<{ key: string; label: string }> = [
  { key: "ALL", label: "Бүгд" },
  { key: "NEW", label: "Шинэ" },
  { key: "CONTACTED", label: "Холбогдсон" },
  { key: "CONFIRMED", label: "Баталгаажсан" },
  { key: "COMPLETED", label: "Аялсан" },
  { key: "CANCELLED", label: "Цуцалсан" },
];

export default function EnquiriesClient() {
  const params = useSearchParams();
  const { locale } = useI18n();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState(params.get("status") ?? "ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isPending } = useQuery<Response>({
    queryKey: ["admin", "enquiries", status, search, page],
    queryFn: async () => {
      const { data } = await api.get<Response>("/enquiries", {
        params: { status, search: search || undefined, page },
      });
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, ...body }: { id: string; status?: string; staffNotes?: string }) => {
      const { data } = await api.patch(`/enquiries/${id}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Шинэчиллээ");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Шинэчлэхэд алдаа гарлаа")),
  });

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Хүсэлтүүд</h1>
        {data && (
          <span className="text-sm text-muted-foreground">
            Нийт {data.pagination.total}
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Нэр, утас эсвэл дугаараар хайх"
            className="bg-card pl-9"
          />
        </div>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => {
              setStatus(filter.key);
              setPage(1);
            }}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              status === filter.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-primary/40",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {isPending ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl bg-card" />
          ))
        ) : !data?.enquiries.length ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            Хүсэлт олдсонгүй.
          </div>
        ) : (
          data.enquiries.map((enquiry) => (
            <div key={enquiry.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      {[enquiry.firstName, enquiry.lastName].filter(Boolean).join(" ")}
                    </span>
                    <EnquiryStatusBadge status={enquiry.status} />
                    <span className="text-xs text-muted-foreground">{enquiry.reference}</span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <a
                      href={`tel:${enquiry.phone.replace(/[^\d+]/g, "")}`}
                      className="flex items-center gap-1 font-semibold text-primary hover:underline"
                    >
                      <Phone className="h-3 w-3" />
                      {enquiry.phone}
                    </a>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {[
                        enquiry.adults ? `${enquiry.adults} том` : null,
                        enquiry.children ? `${enquiry.children} хүүхэд` : null,
                        enquiry.infants ? `${enquiry.infants} нярай` : null,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {enquiry.departureDate
                        ? new Date(enquiry.departureDate).toLocaleDateString("mn-MN", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "Огноо тодруулаагүй"}
                    </span>
                  </div>

                  {enquiry.trip && (
                    <Link
                      href={`/${locale}/trips/${enquiry.trip.slug}`}
                      target="_blank"
                      className="mt-1.5 inline-block text-sm font-medium hover:text-primary"
                    >
                      {enquiry.trip.title}
                    </Link>
                  )}

                  {enquiry.message && (
                    <p className="mt-2 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
                      {enquiry.message}
                    </p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  {enquiry.estimatedTotal != null && (
                    <div className="text-sm font-bold text-primary">
                      ~{formatMnt(enquiry.estimatedTotal)}
                    </div>
                  )}
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(enquiry.createdAt).toLocaleDateString("mn-MN", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-3">
                {(Object.keys(ENQUIRY_STATUS) as EnquiryStatus[]).map((next) => (
                  <button
                    key={next}
                    type="button"
                    disabled={next === enquiry.status || update.isPending}
                    onClick={() => update.mutate({ id: enquiry.id, status: next })}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40",
                      next === enquiry.status
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    {ENQUIRY_STATUS[next].label}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {data && data.pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((prev) => prev - 1)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Өмнөх
          </button>
          <span className="text-sm text-muted-foreground">
            {page} / {data.pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= data.pagination.totalPages}
            onClick={() => setPage((prev) => prev + 1)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Дараах
          </button>
        </div>
      )}
    </AdminShell>
  );
}
