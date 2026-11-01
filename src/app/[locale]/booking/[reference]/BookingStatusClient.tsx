"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, CalendarDays, Loader2, Users } from "lucide-react";

import { api } from "@/lib/api";
import { formatMnt } from "@/lib/pricing";
import { fullDateTitle } from "@/lib/calendar";
import { canonicalPath } from "@/lib/locales";
import { formatTripTitle } from "@/lib/tripDisplay";
import { ChannelLink } from "@/components/site/channels";
import { cn } from "@/lib/utils";

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

/** Each status says plainly what it means and what happens next. */
const STATUS: Record<string, { label: string; tone: "warning" | "success" | "muted" | "danger"; next: string }> = {
  HELD: { label: "Суудал түр хадгалагдсан", tone: "warning", next: "Ажилтан тантай холбогдож нөхцөл, төлбөрийг тохирсны дараа захиалга баталгаажна." },
  PENDING_PAYMENT: { label: "Төлбөр хүлээгдэж байна", tone: "warning", next: "Төлбөр төлөгдсөний дараа захиалга баталгаажна. Асуух зүйл байвал ажилтантай холбогдоорой." },
  PARTIALLY_PAID: { label: "Урьдчилгаа төлөгдсөн", tone: "warning", next: "Үлдэгдлийг ажилтантай тохирсон хугацаанд төлнө." },
  CONFIRMED: { label: "Баталгаажсан", tone: "success", next: "Таны захиалга баталгаажсан. Хөдлөхөөс өмнө ажилтан цугларах цаг, газрыг мэдэгдэнэ." },
  COMPLETED: { label: "Аялал дууссан", tone: "muted", next: "Бидэнтэй аялсанд баярлалаа." },
  CANCELLED: { label: "Цуцлагдсан", tone: "danger", next: "Энэ захиалга цуцлагдсан. Дахин захиалах бол ажилтантай холбогдоорой." },
  EXPIRED: { label: "Түр хадгалалтын хугацаа дууссан", tone: "danger", next: "Суудлын түр хадгалалт дууссан. Энэ огноогоор явах хүсэлтэй хэвээр бол ажилтантай холбогдоорой." },
};

const TONE = {
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
  muted: "bg-secondary text-muted-foreground",
  danger: "bg-destructive/10 text-destructive",
};

/**
 * Reference-only lookup — there are no customer accounts, so the code from
 * the confirmation screen or email stands in for one. The API behind this
 * returns nothing beyond what the holder of that code already knows (their
 * own trip, dates, amount), never phone or email.
 */
export default function BookingStatusClient({ reference, initialData }: { reference: string; initialData?: BookingStatus }) {
  const { data, isLoading, isError } = useQuery<BookingStatus>({
    queryKey: ["booking-status", reference],
    queryFn: async () => (await api.get(`/bookings/${reference}`)).data,
    initialData,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="site-container flex max-w-md items-center justify-center py-24" aria-busy="true">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Ачаалж байна" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="site-container max-w-md py-24 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="display-3 mt-4 text-foreground">Захиалга олдсонгүй</h1>
        <p className="mt-2 text-sm text-muted-foreground">Захиалгын дугаараа шалгаад дахин оролдоно уу, эсвэл ажилтантай холбогдоорой.</p>
        <ChannelLink channelKey="phone" from="booking-status" className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground focus-ring">
          Ажилтантай холбогдох
        </ChannelLink>
      </div>
    );
  }

  const status = STATUS[data.status] ?? { label: data.status, tone: "muted" as const, next: "" };
  const balance = data.totalPrice - data.paidAmount;
  const holdUntil = data.status === "HELD" && data.holdExpiresAt
    ? new Date(data.holdExpiresAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Ulaanbaatar", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="site-container max-w-xl pb-20 pt-10">
      <p className="eyebrow">Миний захиалга</p>
      <h1 className="display-2 mt-3 text-foreground">Захиалга {data.reference}</h1>

      <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card shadow-panel">
        {data.trip?.image && (
          <div className="relative aspect-[16/8] bg-sand">
            <Image src={data.trip.image} alt="" fill sizes="576px" className="object-cover" />
          </div>
        )}
        <div className="p-6 sm:p-7">
          <span className={cn("inline-flex rounded-full px-3 py-1 text-[12px] font-bold", TONE[status.tone])}>{status.label}</span>
          {status.next && <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">{status.next}</p>}
          {holdUntil && <p className="mt-2 text-[13.5px] font-semibold text-foreground">Суудал {holdUntil} цаг хүртэл хадгалагдана.</p>}

          <div className="mt-6 space-y-2 border-t border-border pt-5 text-[14.5px]">
            {data.trip && (
              <Link href={canonicalPath(`/trips/${data.trip.slug}`)} className="block font-semibold text-foreground underline-offset-4 hover:underline">
                {formatTripTitle(data.trip.title)}
              </Link>
            )}
            {data.departure && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                {fullDateTitle(data.departure.startDate)}
              </p>
            )}
            <p className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" aria-hidden="true" />
              {data.adults} том хүн{data.children > 0 && `, ${data.children} хүүхэд`}{data.infants > 0 && `, ${data.infants} нярай`}
            </p>
          </div>

          <dl className="mt-5 space-y-2 border-t border-border pt-5 text-[14.5px]">
            <div className="flex justify-between"><dt className="text-muted-foreground">Нийт дүн</dt><dd className="font-semibold tabular-nums text-foreground">{formatMnt(data.totalPrice)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Төлсөн</dt><dd className="font-semibold tabular-nums text-foreground">{formatMnt(data.paidAmount)}</dd></div>
            {balance > 0 && <div className="flex justify-between"><dt className="font-semibold text-foreground">Үлдэгдэл</dt><dd className="font-bold tabular-nums text-foreground">{formatMnt(balance)}</dd></div>}
          </dl>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <ChannelLink channelKey="phone" from="booking-status" className="flex h-11 items-center justify-center rounded-full bg-primary text-[14px] font-semibold text-primary-foreground focus-ring">
              Ажилтантай холбогдох
            </ChannelLink>
            <ChannelLink channelKey="messenger" from="booking-status" className="flex h-11 items-center justify-center rounded-full border border-border text-[14px] font-semibold text-foreground focus-ring">
              Messenger
            </ChannelLink>
          </div>
        </div>
      </div>
    </div>
  );
}
