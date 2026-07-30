"use client";

import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Eye, EyeOff, ExternalLink, Pencil, Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

import { api, apiErrorMessage } from "@/lib/api";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import AdminShell from "@/components/admin/AdminShell";
import { formatMnt } from "@/lib/pricing";
import type { Trip } from "@/types/trip";
import { cn } from "@/lib/utils";

export default function AdminTripsPage() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();

  const { data: trips, isPending } = useQuery<Trip[]>({
    queryKey: ["admin", "trips"],
    queryFn: async () => {
      const { data } = await api.get<Trip[]>("/trips", { params: { all: "true" } });
      return data;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, ...body }: { id: string; isPublished?: boolean; isFeatured?: boolean }) => {
      const { data } = await api.put(`/trips/${id}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "trips"] });
      toast.success("Шинэчиллээ");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Шинэчлэхэд алдаа гарлаа")),
  });

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Аялалууд</h1>
          {trips && <span className="text-sm text-muted-foreground">Нийт {trips.length}</span>}
        </div>
        <Button asChild className="gap-1.5">
          <Link href={`/${locale}/admin/trips/new`}>
            <Plus className="h-4 w-4" />
            Шинэ аялал
          </Link>
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        {isPending ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-card" />
          ))
        ) : !trips?.length ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            Аялал алга байна.
          </div>
        ) : (
          trips.map((trip) => (
            <div
              key={trip.id}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4"
            >
              <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-secondary">
                {trip.image && (
                  <Image
                    src={trip.image}
                    alt={trip.title}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{trip.title}</span>
                  {!trip.isPublished && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      Ноорог
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatMnt(trip.price)}</span>
                  <span>{trip.durationDays} хоног</span>
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {trip.departures.length} огноо
                  </span>
                  {trip.category && <span>{trip.category.categoryName}</span>}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: trip.id, isFeatured: !trip.isFeatured })}
                  className={cn(
                    "rounded-lg border p-2 transition-colors disabled:opacity-40",
                    trip.isFeatured
                      ? "border-gold bg-gold/15 text-gold"
                      : "border-border text-muted-foreground hover:border-primary/40",
                  )}
                  aria-label="Онцлох"
                  title="Онцлох"
                >
                  <Star className={cn("h-4 w-4", trip.isFeatured && "fill-current")} />
                </button>

                <button
                  type="button"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: trip.id, isPublished: !trip.isPublished })}
                  className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-primary/40 disabled:opacity-40"
                  aria-label={trip.isPublished ? "Нуух" : "Нийтлэх"}
                  title={trip.isPublished ? "Нуух" : "Нийтлэх"}
                >
                  {trip.isPublished ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>

                <Link
                  href={`/${locale}/trips/${trip.slug}`}
                  target="_blank"
                  className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-primary/40"
                  aria-label="Сайт дээр харах"
                  title="Сайт дээр харах"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>

                <Link
                  href={`/${locale}/admin/trips/${trip.id}/edit`}
                  className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-primary/40"
                  aria-label="Засах"
                  title="Засах"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </AdminShell>
  );
}
