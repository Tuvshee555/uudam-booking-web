"use client";

import { useEffect, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FileText,
  Heart,
  Inbox,
  MessageCircle,
  Monitor,
  Phone,
  Plus,
  Share2,
  ShieldAlert,
  Smartphone,
  Tablet,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";

import { api } from "@/lib/api";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import EnquiryStatusBadge from "@/components/admin/EnquiryStatusBadge";
import { DEPARTURE_STATUS_INFO, ENQUIRY_KIND_INFO, type EnquiryKind, type EnquiryStatus } from "@/components/admin/statuses";
import { EmptyState, ErrorState, PageHeader, Panel, StatCard, StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { markStaffDevice } from "@/lib/analytics";
import { departureDateKey } from "@/lib/departureDate";
import {
  dateFromKey,
  formatDaysUntil,
  formatMoney,
  formatNumber,
  formatRelative,
  formatTimeLeft,
  formatToday,
  fullName,
  telHref,
  totalPeople,
} from "@/lib/adminFormat";
import { useAdminSummary, LIVE_QUERY } from "@/hooks/useAdminSummary";
import { useTripHealth } from "@/hooks/useTripHealth";
import { cn } from "@/lib/utils";

type Stats = {
  stats: {
    newCount: number;
    weekCount: number;
    monthCount: number;
    confirmedCount: number;
    tripCount: number;
    draftCount: number;
  };
  recentEnquiries: Array<{
    id: string;
    reference: string;
    firstName: string;
    lastName: string | null;
    phone: string;
    status: EnquiryStatus;
    kind?: EnquiryKind;
    destination?: string | null;
    adults: number;
    children: number;
    infants: number;
    departureDate: string | null;
    createdAt: string;
    trip: { id: string; title: string; image: string } | null;
  }>;
  upcomingDepartures: Array<{
    id: string;
    startDate: string;
    seatsLeft: number | null;
    seatsTotal: number | null;
    status?: string;
    trip: { id: string; title: string; image: string; isPublished?: boolean };
  }>;
  topTrips: Array<{ id: string; title: string; image: string; price: number; enquiryCount: number }>;
  events: Record<string, number>;
  visitorStats: {
    visitors: { today: number; week: number; month: number };
    viewsMonth: number;
    returningMonth: number;
    devices: Record<string, number>;
    engagement: Record<string, { people: number; times: number }>;
    sharesByChannel: Array<{ channel: string; people: number }>;
  };
};

const ENGAGEMENT = [
  { key: "phone_click", label: "Утас руу залгах товч дарсан", icon: Phone },
  { key: "messenger_click", label: "Messenger товч дарсан", icon: MessageCircle },
  { key: "departure_select", label: "Аяллын огноо сонгож үзсэн", icon: CalendarDays },
  { key: "save_toggle", label: "Аяллыг хадгалсан", icon: Heart },
  { key: "share_click", label: "Аяллыг хуваалцсан", icon: Share2 },
  { key: "custom_trip_submit", label: "Захиалгат аялал асуусан", icon: TrendingUp },
];

const DEVICES = [
  { key: "mobile", label: "Утас", icon: Smartphone },
  { key: "desktop", label: "Компьютер", icon: Monitor },
  { key: "tablet", label: "Таблет", icon: Tablet },
  { key: "unknown", label: "Тодорхойгүй", icon: Users },
];

export default function AdminDashboard() {
  const { locale } = useI18n();
  const admin = `/${locale}/admin`;

  const stats = useQuery<Stats>({
    queryKey: ["admin", "stats"],
    queryFn: async () => (await api.get<Stats>("/stats")).data,
    retry: false,
    ...LIVE_QUERY,
  });
  const { data: summary } = useAdminSummary();
  const { data: health } = useTripHealth();

  // Staff looking at their own site are not visitors: once someone has opened
  // the admin, this browser stops adding to the visitor numbers.
  useEffect(() => {
    markStaffDevice();
  }, []);

  const header = (
    <PageHeader
      title="Нүүр"
      description={`${formatToday()} · Өнөөдөр анхаарах зүйлс болон сайтын товч тойм.`}
      actions={
        <>
          <Button asChild variant="outline">
            <Link href={`${admin}/enquiries`}>
              <Inbox />
              Хүсэлтүүд
            </Link>
          </Button>
          <Button asChild>
            <Link href={`${admin}/trips/new`}>
              <Plus />
              Шинэ аялал нэмэх
            </Link>
          </Button>
        </>
      }
    />
  );

  if (stats.isPending) {
    return (
      <>
        {header}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-[124px] animate-pulse rounded-xl bg-card" />
          ))}
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="h-80 animate-pulse rounded-xl bg-card" />
          <div className="h-80 animate-pulse rounded-xl bg-card" />
        </div>
      </>
    );
  }

  if (stats.isError) {
    return (
      <>
        {header}
        <Panel>
          <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
        </Panel>
      </>
    );
  }

  const data = stats.data;
  const vs = data.visitorStats;
  const newCount = summary?.enquiries.new ?? data.stats.newCount;
  const awaiting = summary?.bookings.awaiting ?? 0;
  const holdLeft = summary?.bookings.nextHoldExpiresAt ? formatTimeLeft(summary.bookings.nextHoldExpiresAt) : null;

  const attention: Array<{ key: string; tone: "warning" | "danger" | "info"; icon: ComponentType<{ className?: string }>; title: string; detail: string; href: string; action: string }> = [];
  if (newCount > 0) {
    attention.push({
      key: "enquiries",
      tone: "warning",
      icon: Inbox,
      title: `${formatNumber(newCount)} шинэ хүсэлт залгахыг хүлээж байна`,
      detail: "Үйлчлүүлэгч рүү залгаад, ярьсны дараа төлвийг нь «Холбогдсон» болгоно.",
      href: `${admin}/enquiries?status=NEW`,
      action: "Залгах жагсаалт",
    });
  }
  if (awaiting > 0) {
    attention.push({
      key: "bookings",
      tone: "warning",
      icon: Ticket,
      title: `${formatNumber(awaiting)} захиалга төлбөр хүлээж байна`,
      detail: [
        `Нийт ${formatMoney(summary?.bookings.awaitingAmount ?? 0)} орж ирэх ёстой.`,
        holdLeft ? `Хамгийн ойрын суудлын барилт дуусахад ${holdLeft} үлдсэн.` : null,
      ]
        .filter(Boolean)
        .join(" "),
      href: `${admin}/bookings?status=AWAITING`,
      action: "Төлбөр шалгах",
    });
  }
  if (health && health.errors > 0) {
    attention.push({
      key: "health",
      tone: "danger",
      icon: ShieldAlert,
      title: `Нийтэд харагдаж буй аяллуудад ${formatNumber(health.errors)} алдаа илэрлээ`,
      detail: "Үнэ, огноо, зураг дутуу эсвэл буруу байж магадгүй — үйлчлүүлэгч алдаатай мэдээлэл харж байна.",
      href: `${admin}/health`,
      action: "Алдааг харах",
    });
  }

  const deviceRows = DEVICES.map((row) => ({ ...row, count: vs.devices[row.key] ?? 0 })).filter((row) => row.count > 0);
  const deviceTotal = deviceRows.reduce((sum, row) => sum + row.count, 0);
  const topMax = Math.max(1, ...data.topTrips.map((trip) => trip.enquiryCount));
  const hasEngagement = Object.keys(vs.engagement).length > 0;

  return (
    <>
      {header}

      <section aria-labelledby="attention-title" className="mb-6">
        <h2 id="attention-title" className="sr-only">
          Анхаарах зүйлс
        </h2>
        {attention.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>
              <strong className="font-semibold">Яаралтай хийх зүйл алга.</strong> Шинэ хүсэлт, төлбөр хүлээж буй захиалга, аяллын алдаа байхгүй байна.
            </span>
          </div>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {attention.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex h-full items-start gap-3 rounded-xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    item.tone === "danger"
                      ? "border-red-200 bg-red-50 hover:bg-red-100/70 dark:border-red-400/25 dark:bg-red-400/10"
                      : "border-amber-300 bg-amber-50 hover:bg-amber-100/70 dark:border-amber-400/25 dark:bg-amber-400/10",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      item.tone === "danger"
                        ? "bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">{item.detail}</span>
                    <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                      {item.action}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Шинэ хүсэлт"
          value={formatNumber(newCount)}
          hint={newCount > 0 ? "Залгаж холбогдох хэрэгтэй" : "Бүх хүсэлттэй холбогдсон"}
          icon={Inbox}
          tone={newCount > 0 ? "warning" : "success"}
          href={`${admin}/enquiries?status=NEW`}
          linkLabel="Харах"
        />
        <StatCard
          label="Энэ сарын хүсэлт"
          value={formatNumber(data.stats.monthCount)}
          hint={`Сүүлийн 7 хоногт ${formatNumber(data.stats.weekCount)} · Нийт баталгаажсан ${formatNumber(data.stats.confirmedCount)}`}
          icon={TrendingUp}
          href={`${admin}/enquiries`}
          linkLabel="Бүх хүсэлт"
        />
        <StatCard
          label="Төлбөр хүлээж буй захиалга"
          value={formatNumber(awaiting)}
          hint={awaiting > 0 ? `${formatMoney(summary?.bookings.awaitingAmount ?? 0)} орж ирэх ёстой` : "Хүлээгдэж буй төлбөр алга"}
          icon={Ticket}
          tone={awaiting > 0 ? "warning" : "brand"}
          href={`${admin}/bookings`}
          linkLabel="Захиалгууд"
        />
        <StatCard
          label="Энэ сард сайтад орсон хүн"
          value={formatNumber(vs.visitors.month)}
          hint={`Өнөөдөр ${formatNumber(vs.visitors.today)} · Сүүлийн 7 хоногт ${formatNumber(vs.visitors.week)}`}
          icon={Users}
          href={`${admin}/analytics`}
          linkLabel="Хандалтын тайлан"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title="Сүүлд ирсэн хүсэлтүүд"
          description="Сайтаас «надтай холбогдоорой» гэж үлдээсэн хүмүүс"
          actions={<LinkAction href={`${admin}/enquiries`}>Бүгдийг харах</LinkAction>}
          bodyClassName="p-0 sm:p-0"
        >
          {data.recentEnquiries.length === 0 ? (
            <EmptyState compact icon={Inbox} title="Хүсэлт хараахан ирээгүй байна" description="Сайтаас хүсэлт ирэхэд энд харагдана." />
          ) : (
            <ul className="divide-y divide-border">
              {data.recentEnquiries.map((enquiry) => {
                const what =
                  enquiry.trip?.title ??
                  (enquiry.kind === "CUSTOM" && enquiry.destination
                    ? `Захиалгат аялал: ${enquiry.destination}`
                    : enquiry.kind
                      ? ENQUIRY_KIND_INFO[enquiry.kind]?.label
                      : "Аялал сонгоогүй");
                return (
                  <li key={enquiry.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link href={`${admin}/enquiries?open=${enquiry.id}`} className="truncate text-sm font-semibold hover:text-primary hover:underline">
                          {fullName(enquiry.firstName, enquiry.lastName)}
                        </Link>
                        <EnquiryStatusBadge status={enquiry.status} />
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {what} · {totalPeople(enquiry)} хүн
                      </p>
                      <p className="text-xs text-muted-foreground">{formatRelative(enquiry.createdAt)}</p>
                    </div>
                    <Button asChild variant="outline" size="sm" className="shrink-0">
                      <a href={telHref(enquiry.phone)} title={`Залгах: ${enquiry.phone}`}>
                        <Phone />
                        <span className="hidden sm:inline">{enquiry.phone}</span>
                        <span className="sm:hidden">Залгах</span>
                      </a>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          className="lg:col-span-2"
          title="Ойрын гаралтууд"
          description="Удахгүй гарах аяллын огноонууд"
          actions={<LinkAction href={`${admin}/trips`}>Аялалууд</LinkAction>}
          bodyClassName="p-0 sm:p-0"
        >
          {data.upcomingDepartures.length === 0 ? (
            <EmptyState compact icon={CalendarDays} title="Товлогдсон огноо алга" description="Аяллын засах хуудсанд гарах огноо нэмнэ." />
          ) : (
            <ul className="divide-y divide-border">
              {data.upcomingDepartures.map((departure) => {
                const day = dateFromKey(departureDateKey(departure.startDate));
                const status = departure.status ? DEPARTURE_STATUS_INFO[departure.status] : null;
                return (
                  <li key={departure.id}>
                    <Link
                      href={`${admin}/trips/${departure.trip.id}/edit`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 sm:px-5"
                    >
                      <span className="flex w-12 shrink-0 flex-col items-center rounded-lg border border-border bg-muted/40 py-1.5 text-center leading-none">
                        <span className="text-[10px] font-semibold text-muted-foreground">{day.getMonth() + 1}-р сар</span>
                        <span className="mt-1 text-lg font-bold tabular-nums">{day.getDate()}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{departure.trip.title}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {formatDaysUntil(day)}
                          {departure.seatsLeft != null &&
                            ` · ${departure.seatsLeft}${departure.seatsTotal ? `/${departure.seatsTotal}` : ""} суудал үлдсэн`}
                        </span>
                      </span>
                      {departure.trip.isPublished === false ? (
                        <StatusBadge tone="neutral">Ноорог</StatusBadge>
                      ) : status && departure.status !== "OPEN" ? (
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Энэ сард хамгийн их асуусан аялал" description="Аль аялал илүү сонирхол татаж байгааг харуулна">
          {data.topTrips.length === 0 ? (
            <EmptyState compact icon={FileText} title="Энэ сард аялалд хүсэлт ирээгүй" />
          ) : (
            <ol className="space-y-3.5">
              {data.topTrips.map((trip, index) => (
                <li key={trip.id} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-center text-sm font-bold tabular-nums text-muted-foreground">{index + 1}</span>
                  <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                    {trip.image && <Image src={trip.image} alt="" fill sizes="56px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`${admin}/trips/${trip.id}/edit`} className="block truncate text-sm font-medium hover:text-primary hover:underline">
                      {trip.title}
                    </Link>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${(trip.enquiryCount / topMax) * 100}%` }} />
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums">{trip.enquiryCount} хүсэлт</span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel
          title="Сайтад орсон хүмүүс"
          description="Нэг төхөөрөмжөөс хэдэн ч удаа орсон нэг хүн гэж тоолно. Ажилтнуудын төхөөрөмж тоологдохгүй."
          actions={<LinkAction href={`${admin}/analytics`}>Дэлгэрэнгүй</LinkAction>}
        >
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Өнөөдөр" value={vs.visitors.today} />
            <MiniStat label="Сүүлийн 7 хоног" value={vs.visitors.week} />
            <MiniStat label="Энэ сар" value={vs.visitors.month} />
            <MiniStat label="Дахин орж ирсэн" value={vs.returningMonth} hint="энэ сар" />
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Энэ сард хуудсууд нийт {formatNumber(vs.viewsMonth)} удаа нээгдсэн.
          </p>

          {deviceTotal > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold">Юугаар орсон бэ</h3>
              <ul className="mt-3 space-y-2.5">
                {deviceRows.map(({ key, label, icon: Icon, count }) => {
                  const share = Math.round((count / deviceTotal) * 100);
                  return (
                    <li key={key} className="flex items-center gap-3 text-sm">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="w-24 shrink-0">{label}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                      </div>
                      <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {formatNumber(count)} хүн · {share}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      {hasEngagement && (
        <Panel
          className="mt-6"
          title="Энэ сарын идэвх"
          description="Хүсэлт илгээгээгүй ч сайт дээр ямар нэг үйлдэл хийсэн хүмүүс. Том тоо нь хэдэн өөр хүн, доор нь нийт хэдэн удаа хийснийг харуулна."
        >
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ENGAGEMENT.map(({ key, label, icon: Icon }) => {
              const entry = vs.engagement[key] ?? { people: 0, times: 0 };
              return (
                <li key={key} className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-lg font-bold leading-tight tabular-nums">{formatNumber(entry.people)} хүн</span>
                    <span className="block text-sm text-muted-foreground">{label}</span>
                    {entry.times > entry.people && (
                      <span className="block text-xs text-muted-foreground">нийт {formatNumber(entry.times)} удаа</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {health && health.errors === 0 && health.warnings > 0 && (
        <Link
          href={`${admin}/health`}
          className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm hover:bg-muted/40"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="flex-1">
            Сайтын шалгалтаар {formatNumber(health.warnings)} анхааруулга байна (алдаа биш, гэхдээ нэг харж болох).
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        <Link href={`${admin}/trips`} className="hover:text-foreground hover:underline">
          {formatNumber(data.stats.tripCount)} аялал нийтэд харагдаж байна
          {data.stats.draftCount > 0 && `, ${formatNumber(data.stats.draftCount)} нь ноорог (сайтад харагдахгүй)`}.
        </Link>
      </p>
    </>
  );
}

function LinkAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
      {children}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <dt className="text-xs text-muted-foreground">
        {label}
        {hint && <span className="opacity-70"> · {hint}</span>}
      </dt>
      <dd className="mt-0.5 text-xl font-bold tabular-nums">{formatNumber(value)}</dd>
    </div>
  );
}
