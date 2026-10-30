"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Eye, Globe, Lightbulb, MessageSquare, Monitor, Percent, Smartphone, Tablet, Users } from "lucide-react";

import { api } from "@/lib/api";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import EnquiryStatusBadge, { type EnquiryStatus } from "@/components/admin/EnquiryStatusBadge";
import { EmptyState, ErrorState, PageHeader, Panel, SortHeader } from "@/components/admin/ui";
import { departureDateKey } from "@/lib/departureDate";
import { dateFromKey, formatDate, formatDuration, formatNumber, formatRelative, fullName, percentChange, telHref } from "@/lib/adminFormat";
import { cn } from "@/lib/utils";

type Analytics = {
  range: { days: number; since: string };
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

type TripRow = Analytics["trips"][number];
type SortKey = "visitors" | "views" | "avgDurationMs" | "videoPlays" | "enquiries" | "conversionRate";

const RANGES = [
  { days: 7, label: "Сүүлийн 7 хоног" },
  { days: 30, label: "Сүүлийн 30 хоног" },
  { days: 90, label: "Сүүлийн 90 хоног" },
];

const DEVICE = {
  mobile: { label: "Утас", icon: Smartphone },
  desktop: { label: "Компьютер", icon: Monitor },
  tablet: { label: "Таблет", icon: Tablet },
  unknown: { label: "Тодорхойгүй", icon: Globe },
} as const;

const PAGE_NAMES: Record<string, string> = {
  "": "Нүүр хуудас",
  "/trips": "Аяллын жагсаалт",
  "/departures": "Гарах хуваарь",
  "/about": "Бидний тухай",
  "/contact": "Холбоо барих",
  "/custom-trip": "Захиалгат аялал",
  "/gift": "Бэлгийн эрх",
  "/faq": "Түгээмэл асуулт",
  "/guide": "Зөвлөгөө",
  "/discover": "Танин мэдэхүй",
  "/saved": "Хадгалсан аялал",
  "/terms": "Үйлчилгээний нөхцөл",
};

/** "m.facebook.com" → "Facebook". Unknown sites keep their own address. */
function referrerName(host: string): string {
  const value = host.toLowerCase();
  if (value === "шууд орсон") return "Шууд орсон (хаяг бичиж эсвэл хадгалснаас)";
  if (value.includes("facebook") || value === "fb.com" || value.includes("fb.me")) return "Facebook";
  if (value.includes("messenger")) return "Messenger";
  if (value.includes("instagram")) return "Instagram";
  if (value.includes("google")) return "Google хайлт";
  if (value.includes("youtube")) return "YouTube";
  if (value.includes("tiktok")) return "TikTok";
  if (value.includes("bing")) return "Bing хайлт";
  return host.replace(/^www\./, "");
}

function pageName(path: string): string {
  const withoutLocale = path.replace(/^\/[a-z]{2}(?=\/|$)/, "");
  if (PAGE_NAMES[withoutLocale] !== undefined) return PAGE_NAMES[withoutLocale];
  if (withoutLocale.startsWith("/guide/")) return "Зөвлөгөөний нийтлэл";
  if (withoutLocale.startsWith("/discover/")) return "Танин мэдэхүйн нийтлэл";
  if (withoutLocale.startsWith("/category/")) return "Ангиллын хуудас";
  if (withoutLocale.startsWith("/booking/")) return "Захиалгын төлөв шалгах";
  return withoutLocale || "Нүүр хуудас";
}

/** Every day of the range, including the quiet ones — a gap must read as zero, not vanish. */
function fillDays(daily: Analytics["daily"], since: string) {
  const byDay = new Map(daily.map((day) => [day.date, day]));
  const today = departureDateKey(new Date());
  const rows: Array<{ date: string; views: number; visitors: number }> = [];
  let cursor = new Date(since);
  for (let guard = 0; guard < 400; guard++) {
    const key = departureDateKey(cursor);
    if (key > today) break;
    rows.push(byDay.get(key) ?? { date: key, views: 0, visitors: 0 });
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return rows;
}

function shortDay(key: string) {
  return `${key.slice(5, 7)}/${key.slice(8, 10)}`;
}

function Trend({ current, previous, days }: { current: number; previous: number; days: number }) {
  const change = percentChange(current, previous);
  if (change === null) return <span className="text-xs text-muted-foreground">Өмнөх үетэй харьцуулах мэдээлэл алга</span>;
  if (change === 0) return <span className="text-xs text-muted-foreground">Өмнөх {days} хоногтой ижил</span>;
  const up = change > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className={cn("inline-flex items-center gap-0.5 font-semibold", up ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
        <Icon className="h-3.5 w-3.5" />
        {up ? "+" : "−"}
        {Math.abs(change)}%
      </span>
      <span className="text-muted-foreground">өмнөх {days} хоногоос</span>
    </span>
  );
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }) {
  if (!active || !payload?.length || !payload[0].payload) return null;
  const row = payload[0].payload as { date: string; views: number; visitors: number };
  const day = dateFromKey(row.date);
  const weekday = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"][day.getDay()];
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-lg">
      <p className="text-xs text-muted-foreground">
        {formatDate(day)}, {weekday}
      </p>
      <p className="mt-1 flex items-center gap-2">
        <span aria-hidden="true" className="h-0.5 w-3 rounded-full bg-current text-[hsl(var(--chart-3))] dark:text-[hsl(207_64%_55%)]" />
        <strong className="tabular-nums">{formatNumber(row.visitors)}</strong>
        <span className="text-muted-foreground">хүн орсон</span>
      </p>
      <p className="mt-0.5 pl-5 text-xs text-muted-foreground">{formatNumber(row.views)} удаа хуудас нээсэн</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { locale } = useI18n();
  const [days, setDays] = useState(30);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "views", direction: "desc" });
  const [showTable, setShowTable] = useState(false);

  const analytics = useQuery<Analytics>({
    queryKey: ["admin", "analytics", days],
    queryFn: async () => (await api.get<Analytics>("/analytics", { params: { days } })).data,
    placeholderData: keepPreviousData,
  });
  const data = analytics.data;

  const series = useMemo(() => (data ? fillDays(data.daily, data.range.since) : []), [data]);
  const peakDay = useMemo(() => series.reduce<(typeof series)[number] | null>((best, day) => (!best || day.visitors > best.visitors ? day : best), null), [series]);

  const trips = useMemo(() => {
    const rows = [...(data?.trips ?? [])];
    rows.sort((a, b) => (sort.direction === "desc" ? b[sort.key] - a[sort.key] : a[sort.key] - b[sort.key]));
    return rows;
  }, [data, sort]);

  const needsAttention = (data?.trips ?? []).filter((trip) => trip.views >= 30 && trip.enquiries === 0).sort((a, b) => b.views - a.views);
  const deviceTotal = (data?.devices ?? []).reduce((sum, row) => sum + row.count, 0);
  const referrerTotal = (data?.referrers ?? []).reduce((sum, row) => sum + row.count, 0);

  function sortBy(key: SortKey) {
    setSort((current) => ({ key, direction: current.key === key && current.direction === "desc" ? "asc" : "desc" }));
  }

  const rangeLabel = RANGES.find((range) => range.days === days)?.label.toLowerCase() ?? `${days} хоног`;

  return (
    <>
      <PageHeader
        title="Хандалт"
        description="Сайтад хэдэн хүн орж, аль аяллыг үзэж, хэд нь холбогдсоныг харуулна. Ажилтнуудын төхөөрөмжөөс орсныг тоолохгүй."
        actions={
          <div role="group" aria-label="Хугацаа сонгох" className="inline-flex rounded-lg border border-border bg-card p-1 shadow-sm">
            {RANGES.map((range) => (
              <button
                key={range.days}
                type="button"
                aria-pressed={days === range.days}
                onClick={() => setDays(range.days)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  days === range.days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {range.label.replace("Сүүлийн ", "")}
              </button>
            ))}
          </div>
        }
      />

      {analytics.isPending ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-xl bg-card" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-xl bg-card" />
        </div>
      ) : analytics.isError || !data ? (
        <Panel>
          <ErrorState error={analytics.error} onRetry={() => analytics.refetch()} />
        </Panel>
      ) : (
        <div className={cn("space-y-6 transition-opacity", analytics.isPlaceholderData && "opacity-60")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                icon: Users,
                label: "Сайтад орсон хүн",
                value: data.totals.visitors,
                previous: data.totals.previous.visitors,
                hint: "Нэг төхөөрөмж = нэг хүн, хэдэн ч удаа орсон",
              },
              {
                icon: Eye,
                label: "Хуудас нээсэн",
                value: data.totals.views,
                previous: data.totals.previous.views,
                hint: "Нийт хэдэн удаа хуудас нээгдсэн",
              },
              {
                icon: MessageSquare,
                label: "Ирсэн хүсэлт",
                value: data.totals.enquiries,
                previous: data.totals.previous.enquiries,
                hint: "Сайтаас «холбогдоорой» гэж үлдээсэн",
              },
            ].map(({ icon: Icon, label, value, previous, hint }) => (
              <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-muted-foreground">{label}</p>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-1.5 text-[28px] font-bold leading-9 tracking-tight">{formatNumber(value)}</p>
                <Trend current={value} previous={previous} days={days} />
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
              </div>
            ))}
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-muted-foreground">Хүсэлт болсон хувь</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Percent className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-1.5 text-[28px] font-bold leading-9 tracking-tight">{data.totals.conversionRate}%</p>
              <p className="text-xs text-muted-foreground">
                100 удаа үзэхэд дунджаар {data.totals.conversionRate} хүсэлт ирж байна
              </p>
            </div>
          </div>

          <Panel
            title="Өдөр бүр сайтад орсон хүн"
            description={
              peakDay && peakDay.visitors > 0
                ? `Хамгийн их нь ${formatDate(dateFromKey(peakDay.date))}: ${formatNumber(peakDay.visitors)} хүн. Цэг бүр дээр очиж тухайн өдрийн тоог харна.`
                : "Энэ хугацаанд хандалт бүртгэгдээгүй байна."
            }
            actions={
              <button type="button" onClick={() => setShowTable((value) => !value)} className="text-sm font-medium text-primary hover:underline">
                {showTable ? "Графикаар харах" : "Хүснэгтээр харах"}
              </button>
            }
          >
            {showTable ? (
              <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Өдөр</th>
                      <th className="px-3 py-2 text-right font-medium">Орсон хүн</th>
                      <th className="px-3 py-2 text-right font-medium">Хуудас нээсэн</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[...series].reverse().map((day) => (
                      <tr key={day.date}>
                        <td className="px-3 py-1.5">{formatDate(dateFromKey(day.date))}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(day.visitors)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{formatNumber(day.views)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-64 text-[hsl(var(--chart-3))] dark:text-[hsl(207_64%_55%)]" role="img" aria-label={`Өдөр бүр сайтад орсон хүний тоо, ${rangeLabel}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={shortDay}
                      tickLine={false}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      minTickGap={28}
                    />
                    <YAxis
                      allowDecimals={false}
                      width={44}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      tickFormatter={(value: number) => formatNumber(value)}
                    />
                    <Tooltip content={(props) => <ChartTooltip active={props.active} payload={props.payload} />} cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }} />
                    <Area
                      type="monotone"
                      dataKey="visitors"
                      stroke="currentColor"
                      strokeWidth={2}
                      fill="currentColor"
                      fillOpacity={0.1}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))", fill: "currentColor" }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          {needsAttention.length > 0 && (
            <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
              <Lightbulb className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Олон хүн үзсэн ч хүсэлт ирээгүй аялал</p>
                <p className="mt-0.5 opacity-90">
                  {needsAttention
                    .slice(0, 3)
                    .map((trip) => `«${trip.title}» (${formatNumber(trip.views)} үзэлт)`)
                    .join(", ")}
                  . Үнэ, огноо, зураг эсвэл тайлбарыг нь шалгаж сайжруулбал хүсэлт нэмэгдэж магадгүй.
                </p>
              </div>
            </div>
          )}

          <Panel
            title="Аялал тус бүрээр"
            description="Хамгийн чухал нь сүүлийн багана: 100 удаа үзэхэд хэдэн хүсэлт ирснийг харуулна. Баганын нэр дээр дарж эрэмбэлнэ."
            bodyClassName="p-0 sm:p-0"
          >
            {trips.length === 0 ? (
              <EmptyState compact icon={Eye} title="Энэ хугацаанд аялал үзсэн бүртгэл алга" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Аялал</th>
                      {(
                        [
                          ["visitors", "Орсон хүн"],
                          ["views", "Үзсэн удаа"],
                          ["avgDurationMs", "Дундаж хугацаа"],
                          ["videoPlays", "Бичлэг үзсэн"],
                          ["enquiries", "Хүсэлт"],
                          ["conversionRate", "Хүсэлт болсон %"],
                        ] as const
                      ).map(([key, label]) => (
                        <th key={key} className="px-4 py-2.5 text-right font-medium" aria-sort={sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}>
                          <SortHeader label={label} align="right" active={sort.key === key} direction={sort.direction} onClick={() => sortBy(key)} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {trips.map((trip: TripRow) => (
                      <tr key={trip.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5">
                          <Link href={`/${locale}/admin/trips/${trip.id}/edit`} className="flex items-center gap-3 hover:text-primary">
                            <span className="relative h-9 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                              {trip.image && <Image src={trip.image} alt="" fill sizes="56px" className="object-cover" />}
                            </span>
                            <span className="line-clamp-2 font-medium">{trip.title}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(trip.visitors)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(trip.views)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{formatDuration(trip.avgDurationMs)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{trip.videoPlays > 0 ? formatNumber(trip.videoPlays) : "—"}</td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatNumber(trip.enquiries)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={cn(
                              "font-semibold tabular-nums",
                              trip.conversionRate >= 3 ? "text-emerald-700 dark:text-emerald-400" : trip.conversionRate > 0 ? "text-foreground" : "text-muted-foreground",
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
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Хаанаас орж ирсэн бэ" description="Ямар сайт, апп-аас холбоосоор дарж орсон">
              {data.referrers.length === 0 ? (
                <EmptyState compact icon={Globe} title="Мэдээлэл алга" />
              ) : (
                <ul className="space-y-3">
                  {data.referrers.map((row) => {
                    const share = referrerTotal ? Math.round((row.count / referrerTotal) * 100) : 0;
                    return (
                      <li key={row.referrer}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate" title={row.referrer}>
                            {referrerName(row.referrer)}
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            <strong className="font-semibold text-foreground">{formatNumber(row.count)}</strong> · {share}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-[hsl(var(--chart-3))] dark:bg-[hsl(207_64%_55%)]" style={{ width: `${share}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {deviceTotal > 0 && (
                <>
                  <h3 className="mt-6 text-sm font-semibold">Юугаар орсон бэ</h3>
                  <ul className="mt-3 space-y-2.5">
                    {data.devices
                      .slice()
                      .sort((a, b) => b.count - a.count)
                      .map((row) => {
                        const device = DEVICE[row.device as keyof typeof DEVICE] ?? DEVICE.unknown;
                        const share = Math.round((row.count / deviceTotal) * 100);
                        return (
                          <li key={row.device} className="flex items-center gap-3 text-sm">
                            <device.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="w-24 shrink-0">{device.label}</span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-[hsl(var(--chart-3))] dark:bg-[hsl(207_64%_55%)]" style={{ width: `${share}%` }} />
                            </div>
                            <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{share}%</span>
                          </li>
                        );
                      })}
                  </ul>
                </>
              )}
            </Panel>

            <Panel title="Сүүлд хүсэлт илгээсэн хүмүүс" description="Хэн, аль аяллаас, хаанаас орж ирээд бичсэн бэ">
              {data.recentEnquiries.length === 0 ? (
                <EmptyState compact icon={MessageSquare} title="Энэ хугацаанд хүсэлт ирээгүй" />
              ) : (
                <ul className="divide-y divide-border">
                  {data.recentEnquiries.map((enquiry) => (
                    <li key={enquiry.id} className="py-2.5 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/${locale}/admin/enquiries?open=${enquiry.id}`} className="truncate text-sm font-medium hover:text-primary hover:underline">
                          {fullName(enquiry.firstName, enquiry.lastName)}
                        </Link>
                        <EnquiryStatusBadge status={enquiry.status} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{enquiry.trip?.title ?? "Аялал сонгоогүй"}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <a href={telHref(enquiry.phone)} className="font-medium text-primary hover:underline">
                          {enquiry.phone}
                        </a>
                        <span>{enquiry.referrer ? referrerName(enquiry.referrer) : "Шууд орсон"}</span>
                        <span>{formatRelative(enquiry.createdAt)}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {data.topPages.length > 0 && (
            <Panel title="Аяллаас бусад хуудас" description="Аяллын хуудсаас гадна хамгийн их нээгдсэн хуудсууд">
              <ul className="divide-y divide-border">
                {data.topPages.map((row) => (
                  <li key={row.path} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
                    <span className="min-w-0">
                      <span className="block truncate">{pageName(row.path)}</span>
                      <span className="block truncate text-xs text-muted-foreground">{row.path}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      <strong className="font-semibold">{formatNumber(row.count)}</strong> <span className="text-muted-foreground">удаа</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
