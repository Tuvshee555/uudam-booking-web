"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import {
  Eye,
  Globe,
  MessageSquare,
  Play,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

import { api } from "@/lib/api";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import AdminShell from "@/components/admin/AdminShell";
import EnquiryStatusBadge, { type EnquiryStatus } from "@/components/admin/EnquiryStatusBadge";
import { cn } from "@/lib/utils";

type Analytics = {
  totals: {
    views: number;
    visitors: number;
    enquiries: number;
    conversionRate: number;
    previous: { views: number; visitors: number; enquiries: number };
  };
  daily: Array<{ date: string; views: number; visitors: number }>;
  trips: Array<{
    id: string;
    slug: string;
    title: string;
    image: string;
    views: number;
    visitors: number;
    enquiries: number;
    conversionRate: number;
    avgDurationMs: number;
    videoPlays: number;
  }>;
  referrers: Array<{ referrer: string; count: number }>;
  devices: Array<{ device: string; count: number }>;
  topPages: Array<{ path: string; count: number }>;
  recentEnquiries: Array<{
    id: string;
    reference: string;
    firstName: string;
    lastName: string | null;
    phone: string;
    status: EnquiryStatus;
    referrer: string | null;
    createdAt: string;
    trip: { id: string; title: string; slug: string } | null;
  }>;
};

const RANGES = [
  { days: 7, label: "7 хоног" },
  { days: 30, label: "30 хоног" },
  { days: 90, label: "90 хоног" },
];

const DEVICE_LABEL: Record<string, string> = {
  mobile: "Утас",
  desktop: "Компьютер",
  tablet: "Таблет",
  unknown: "Тодорхойгүй",
};

/** "2 мин 14 сек" — an average of a few seconds means nobody read the page. */
function formatDuration(ms: number) {
  if (!ms || ms < 1000) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} сек`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} мин ${seconds % 60} сек`;
}

function Trend({ current, previous }: { current: number; previous: number }) {
  // No prior data to compare against — showing "+100%" would be meaningless.
  if (previous === 0) return null;

  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return null;

  const up = change > 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold",
        up ? "text-emerald-600" : "text-destructive",
      )}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(change)}%
    </span>
  );
}

export default function AnalyticsPage() {
  const { locale } = useI18n();
  const [days, setDays] = useState(30);

  const { data, isPending } = useQuery<Analytics>({
    queryKey: ["admin", "analytics", days],
    queryFn: async () => {
      const { data } = await api.get<Analytics>("/analytics", { params: { days } });
      return data;
    },
  });

  const peak = data ? Math.max(1, ...data.daily.map((day) => day.views)) : 1;

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Хандалтын тайлан</h1>

        <div className="flex gap-1.5">
          {RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              onClick={() => setDays(range.days)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                days === range.days
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {isPending || !data ? (
        <div className="mt-6 h-40 animate-pulse rounded-2xl bg-card" />
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Users,
                label: "Зочин",
                value: data.totals.visitors,
                prev: data.totals.previous.visitors,
                hint: "давхардаагүй",
              },
              {
                icon: Eye,
                label: "Нийт үзэлт",
                value: data.totals.views,
                prev: data.totals.previous.views,
                hint: "хуудас нээсэн",
              },
              {
                icon: MessageSquare,
                label: "Хүсэлт",
                value: data.totals.enquiries,
                prev: data.totals.previous.enquiries,
                hint: "холбоо барьсан",
              },
              {
                icon: TrendingUp,
                label: "Хөрвөлт",
                value: `${data.totals.conversionRate}%`,
                hint: "үзэлт → хүсэлт",
              },
            ].map(({ icon: Icon, label, value, prev, hint }) => (
              <div key={label} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between">
                  <span className="inline-flex rounded-xl bg-primary/10 p-2.5 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  {typeof value === "number" && prev !== undefined && (
                    <Trend current={value} previous={prev} />
                  )}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">{label}</div>
                <div className="mt-0.5 text-xl font-bold">{value}</div>
                <div className="text-[11px] text-muted-foreground">{hint}</div>
              </div>
            ))}
          </div>

          {data.daily.length > 0 && (
            <section className="mt-6 rounded-2xl border border-border bg-card p-5">
              <h2 className="text-lg font-bold">Өдрийн хандалт</h2>
              <div className="mt-5 flex h-40 items-end gap-1">
                {data.daily.map((day) => (
                  <div key={day.date} className="group relative flex-1">
                    <div
                      className="w-full rounded-t bg-primary/80 transition-colors group-hover:bg-primary"
                      style={{ height: `${Math.max(2, (day.views / peak) * 150)}px` }}
                    />
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-2 py-1 text-[11px] text-background group-hover:block">
                      {new Date(day.date).toLocaleDateString("mn-MN", {
                        month: "short",
                        day: "numeric",
                      })}
                      {" · "}
                      {day.views} үзэлт · {day.visitors} зочин
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-6 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-bold">Аялал тус бүрээр</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Хамгийн баруун багана хамгийн чухал: хэдэн хүн үзээд, хэд нь үнэхээр
              холбоо барьсан бэ.
            </p>

            {data.trips.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Энэ хугацаанд хандалт бүртгэгдээгүй байна.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Аялал</th>
                      <th className="pb-2 text-right font-medium">Зочин</th>
                      <th className="pb-2 text-right font-medium">Үзэлт</th>
                      <th className="pb-2 text-right font-medium">Дундаж хугацаа</th>
                      <th className="pb-2 text-right font-medium">Бичлэг</th>
                      <th className="pb-2 text-right font-medium">Хүсэлт</th>
                      <th className="pb-2 text-right font-medium">Хөрвөлт</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trips.map((trip) => (
                      <tr key={trip.id} className="border-b border-border/60 last:border-0">
                        <td className="py-3">
                          <Link
                            href={`/${locale}/trips/${trip.slug}`}
                            target="_blank"
                            className="flex items-center gap-3 hover:text-primary"
                          >
                            <div className="relative h-9 w-14 shrink-0 overflow-hidden rounded-md bg-secondary">
                              {trip.image && (
                                <Image
                                  src={trip.image}
                                  alt=""
                                  fill
                                  sizes="56px"
                                  className="object-cover"
                                />
                              )}
                            </div>
                            <span className="line-clamp-1 font-medium">{trip.title}</span>
                          </Link>
                        </td>
                        <td className="py-3 text-right tabular-nums">{trip.visitors}</td>
                        <td className="py-3 text-right tabular-nums">{trip.views}</td>
                        <td className="py-3 text-right tabular-nums text-muted-foreground">
                          {formatDuration(trip.avgDurationMs)}
                        </td>
                        <td className="py-3 text-right tabular-nums text-muted-foreground">
                          {trip.videoPlays > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <Play className="h-3 w-3" />
                              {trip.videoPlays}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3 text-right font-semibold tabular-nums">
                          {trip.enquiries}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={cn(
                              "font-semibold tabular-nums",
                              trip.conversionRate >= 3
                                ? "text-emerald-600"
                                : trip.conversionRate > 0
                                  ? "text-foreground"
                                  : "text-muted-foreground",
                            )}
                          >
                            {trip.conversionRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Globe className="h-4 w-4 text-primary" />
                Хаанаас орж ирсэн
              </h2>

              {data.referrers.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Мэдээлэл алга.</p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {data.referrers.map((row) => (
                    <li key={row.referrer} className="flex items-center justify-between text-sm">
                      <span className="truncate text-muted-foreground">{row.referrer}</span>
                      <span className="font-semibold tabular-nums">{row.count}</span>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="mt-6 text-sm font-semibold">Төхөөрөмж</h3>
              <ul className="mt-2 space-y-2">
                {data.devices.map((row) => (
                  <li key={row.device} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {DEVICE_LABEL[row.device] ?? row.device}
                    </span>
                    <span className="font-semibold tabular-nums">{row.count}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <MessageSquare className="h-4 w-4 text-primary" />
                Хэн, аль аялалаас бичсэн
              </h2>

              {data.recentEnquiries.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Хүсэлт алга.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {data.recentEnquiries.map((enquiry) => (
                    <li key={enquiry.id} className="border-b border-border/60 pb-3 last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {[enquiry.firstName, enquiry.lastName].filter(Boolean).join(" ")}
                        </span>
                        <EnquiryStatusBadge status={enquiry.status} />
                      </div>
                      <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {enquiry.trip?.title ?? "Аялал сонгоогүй"}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                        <a
                          href={`tel:${enquiry.phone.replace(/[^\d+]/g, "")}`}
                          className="font-semibold text-primary hover:underline"
                        >
                          {enquiry.phone}
                        </a>
                        <span>{enquiry.referrer ?? "Шууд орсон"}</span>
                        <span>
                          {new Date(enquiry.createdAt).toLocaleDateString("mn-MN", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {data.topPages.length > 0 && (
            <section className="mt-6 rounded-2xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Timer className="h-4 w-4 text-primary" />
                Бусад хуудас
              </h2>
              <ul className="mt-4 space-y-2">
                {data.topPages.map((row) => (
                  <li key={row.path} className="flex items-center justify-between text-sm">
                    <span className="truncate text-muted-foreground">{row.path}</span>
                    <span className="font-semibold tabular-nums">{row.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </AdminShell>
  );
}
