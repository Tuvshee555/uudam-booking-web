"use client";

import { useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Phone, Users } from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import AdminShell from "@/components/admin/AdminShell";
import { formatMnt } from "@/lib/pricing";
import { cn } from "@/lib/utils";

type Booking = {
  id: string;
  reference: string;
  status: string;
  adults: number;
  children: number;
  infants: number;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  totalPrice: number;
  paidAmount: number;
  holdExpiresAt: string | null;
  createdAt: string;
  trip: { id: string; title: string; image: string; slug: string };
  departure: { id: string; startDate: string; endDate: string | null };
  payments: { reference: string; method: string; status: string; amount: number }[];
};

const FILTERS: Array<{ key: string; label: string }> = [
  { key: "ALL", label: "Бүгд" },
  { key: "HELD", label: "Түр барьсан" },
  { key: "PENDING_PAYMENT", label: "Төлбөр хүлээгдэж буй" },
  { key: "PARTIALLY_PAID", label: "Урьдчилгаатай" },
  { key: "CONFIRMED", label: "Баталгаажсан" },
  { key: "COMPLETED", label: "Дууссан" },
  { key: "CANCELLED", label: "Цуцлагдсан" },
  { key: "EXPIRED", label: "Хугацаа дууссан" },
];

const STATUS_STYLE: Record<string, string> = {
  HELD: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
  PENDING_PAYMENT: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
  PARTIALLY_PAID: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400",
  CONFIRMED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  COMPLETED: "bg-secondary text-muted-foreground",
  CANCELLED: "bg-destructive/10 text-destructive",
  EXPIRED: "bg-destructive/10 text-destructive",
};

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  FILTERS.filter((f) => f.key !== "ALL").map((f) => [f.key, f.label]),
);

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("mn-MN", { year: "numeric", month: "short", day: "numeric" });
}

export default function BookingsClient() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("ALL");

  const { data, isPending } = useQuery<Booking[]>({
    queryKey: ["admin", "bookings", filter],
    queryFn: async () =>
      (
        await api.get<Booking[]>("/bookings", {
          params: filter === "ALL" ? undefined : { status: filter },
        })
      ).data,
    refetchInterval: 30_000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ reference, status }: { reference: string; status: string }) =>
      api.patch(`/bookings/${reference}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
      toast.success("Шинэчиллээ");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Алдаа гарлаа")),
  });

  const markPaid = useMutation({
    mutationFn: async ({ reference, amount }: { reference: string; amount: number }) =>
      api.patch(`/bookings/${reference}`, { paidAmount: amount, status: "CONFIRMED" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
      toast.success("Төлбөр баталгаажлаа");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Алдаа гарлаа")),
  });

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Захиалгууд</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Онлайн захиалгууд. Төлбөрийг банкны хуулгатай тулгаад &ldquo;Төлбөр
            орсон&rdquo; дээр дарж баталгаажуулна.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              filter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:border-primary/40",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-2">
        {isPending ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-secondary" />
          ))
        ) : !data?.length ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            Захиалга алга.
          </div>
        ) : (
          data.map((booking) => {
            const balance = booking.totalPrice - booking.paidAmount;

            return (
              <div key={booking.id} className="rounded-2xl border border-border p-4">
                <div className="flex items-start gap-3">
                  <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-secondary">
                    {booking.trip.image && (
                      <Image
                        src={booking.trip.image}
                        alt={booking.trip.title}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-primary">
                        {booking.reference}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          STATUS_STYLE[booking.status] ?? "bg-secondary",
                        )}
                      >
                        {STATUS_LABEL[booking.status] ?? booking.status}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-sm font-medium">{booking.trip.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(booking.departure.startDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {booking.adults + booking.children + booking.infants} хүн
                      </span>
                      <a href={`tel:${booking.phone}`} className="flex items-center gap-1 hover:text-primary">
                        <Phone className="h-3 w-3" />
                        {booking.firstName} · {booking.phone}
                      </a>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold">{formatMnt(booking.totalPrice)}</div>
                    {balance > 0 ? (
                      <div className="text-xs text-destructive">Үлдэгдэл {formatMnt(balance)}</div>
                    ) : (
                      <div className="text-xs text-emerald-600">Бүрэн төлсөн</div>
                    )}
                  </div>
                </div>

                {(booking.status === "HELD" || booking.status === "PENDING_PAYMENT") && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    <button
                      type="button"
                      onClick={() =>
                        markPaid.mutate({ reference: booking.reference, amount: booking.totalPrice })
                      }
                      disabled={markPaid.isPending}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      Төлбөр орсон — баталгаажуулах
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateStatus.mutate({ reference: booking.reference, status: "CANCELLED" })
                      }
                      disabled={updateStatus.isPending}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-destructive hover:border-destructive disabled:opacity-50"
                    >
                      Цуцлах
                    </button>
                  </div>
                )}

                {booking.status === "CONFIRMED" && (
                  <div className="mt-3 border-t border-border pt-3">
                    <button
                      type="button"
                      onClick={() =>
                        updateStatus.mutate({ reference: booking.reference, status: "COMPLETED" })
                      }
                      disabled={updateStatus.isPending}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      Аялал дууссан гэж тэмдэглэх
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </AdminShell>
  );
}
