"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { AlertCircle, CalendarDays, Loader2 } from "lucide-react";

import { api } from "@/lib/api";
import { formatMnt } from "@/lib/pricing";
import { CONTACT, hasLink } from "@/lib/contact";
import { Button } from "@/components/ui/button";

export type BookingStatus = {
  reference: string;
  status: string;
  adults: number;
  children: number;
  infants: number;
  totalPrice: number;
  paidAmount: number;
  currency: string;
  holdExpiresAt: string | null;
  createdAt: string;
  firstName: string;
  trip: { title: string; slug: string; image: string } | null;
  departure: { startDate: string; endDate: string | null } | null;
  payments: { reference: string; method: string; status: string; amount: number }[];
};

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  HELD: { label: "Суудал түр барьсан", tone: "text-amber-600" },
  PENDING_PAYMENT: { label: "Төлбөр хүлээгдэж байна", tone: "text-amber-600" },
  PARTIALLY_PAID: { label: "Урьдчилгаа төлөгдсөн", tone: "text-primary" },
  CONFIRMED: { label: "Баталгаажсан", tone: "text-emerald-600" },
  COMPLETED: { label: "Аялал дууссан", tone: "text-muted-foreground" },
  CANCELLED: { label: "Цуцлагдсан", tone: "text-destructive" },
  EXPIRED: { label: "Хугацаа дууссан", tone: "text-destructive" },
};

/**
 * Reference-only lookup — there are no customer accounts, so the 5-character
 * code found in the confirmation email/screen is what stands in for one. The
 * API behind this deliberately returns nothing beyond what the holder of that
 * code already knows (their own trip, dates, amount), never phone or email.
 */
export default function BookingStatusClient({
  reference,
  initialData,
}: {
  reference: string;
  initialData?: BookingStatus;
}) {
  const { data, isLoading, isError } = useQuery<BookingStatus>({
    queryKey: ["booking-status", reference],
    queryFn: async () => (await api.get(`/bookings/${reference}`)).data,
    initialData,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="uudam-container flex max-w-md items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="uudam-container max-w-md py-20 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-bold">Захиалга олдсонгүй</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Захиалгын дугаараа шалгаад дахин оролдоно уу.
        </p>
      </div>
    );
  }

  const status = STATUS_LABEL[data.status] ?? { label: data.status, tone: "" };
  const balance = data.totalPrice - data.paidAmount;

  return (
    <div className="uudam-container max-w-md py-12">
      <div className="rounded-2xl border border-border bg-card p-6">
        {data.trip?.image && (
          <div className="relative -mx-6 -mt-6 mb-5 aspect-[16/9] overflow-hidden rounded-t-2xl bg-secondary">
            <Image src={data.trip.image} alt={data.trip.title} fill sizes="480px" className="object-cover" />
          </div>
        )}

        <div className="text-center">
          <div className="text-xs text-muted-foreground">Захиалгын дугаар</div>
          <div className="mt-1 text-2xl font-bold tracking-wider text-primary">{data.reference}</div>
          <div className={`mt-2 text-sm font-semibold ${status.tone}`}>{status.label}</div>
        </div>

        <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
          {data.trip && <div className="font-semibold">{data.trip.title}</div>}
          {data.departure && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date(data.departure.startDate).toLocaleDateString("mn-MN", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          )}
          <div className="text-muted-foreground">
            {data.adults} том хүн
            {data.children > 0 && `, ${data.children} хүүхэд`}
            {data.infants > 0 && `, ${data.infants} нярай`}
          </div>
        </div>

        <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Нийт дүн</span>
            <span className="font-semibold">{formatMnt(data.totalPrice)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Төлсөн</span>
            <span className="font-semibold">{formatMnt(data.paidAmount)}</span>
          </div>
          {balance > 0 && (
            <div className="flex justify-between text-primary">
              <span>Үлдэгдэл</span>
              <span className="font-bold">{formatMnt(balance)}</span>
            </div>
          )}
        </div>

        {hasLink(CONTACT.phone) && (
          <Button asChild variant="outline" className="mt-5 w-full">
            <a href={CONTACT.phoneHref}>Ажилтантай холбогдох</a>
          </Button>
        )}
      </div>
    </div>
  );
}
