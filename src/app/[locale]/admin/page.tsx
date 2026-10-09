"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Check,
  FileText,
  Heart,
  Monitor,
  Inbox,
  Map,
  MessageCircle,
  Phone,
  Share2,
  Smartphone,
  Tablet,
  TrendingUp,
  Users,
} from "lucide-react";

import { api } from "@/lib/api";
import { useAuth } from "@/app/[locale]/provider/AuthProvider";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import EnquiryStatusBadge from "@/components/admin/EnquiryStatusBadge";
import { Button } from "@/components/ui/button";
import { formatMnt } from "@/lib/pricing";
import { markStaffDevice } from "@/lib/analytics";

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
    status: "NEW" | "CONTACTED" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
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
    trip: { id: string; title: string; image: string };
  }>;
  topTrips: Array<{
    id: string;
    title: string;
    image: string;
    price: number;
    enquiryCount: number;
  }>;
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

export default function AdminDashboard() {
  const { locale } = useI18n();
  const { setAuthToken } = useAuth();

  const { data, isPending, isError, error } = useQuery<Stats>({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const { data } = await api.get<Stats>("/stats");
      return data;
    },
    retry: false,
  });

  // Staff looking at their own site are not visitors: once someone has opened
  // the admin, this browser stops adding to the visitor numbers.
  useEffect(() => {
    markStaffDevice();
  }, []);

  if (isPending) {
    return (
      <div className="h-40 animate-pulse rounded-2xl bg-card" />
    );
  }

  // A 403 here means the cookie got them past the middleware but the database
  // says they are not staff — the API is the real gate.
  if (isError) {
    const status = (error as { response?: { status?: number } })?.response?.status;

    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-bold">
          {status === 403 ? "Админ эрх алга" : "Мэдээлэл ачаалж чадсангүй"}
        </h1>
        <Button
          className="mt-6"
          onClick={() => {
            setAuthToken(null);
            window.location.href = `/${locale}/admin/log-in`;
          }}
        >
          Гарах
        </Button>
      </div>
    );
  }

  const cards = [
    { icon: Inbox, label: "Шинэ хүсэлт", value: data.stats.newCount, accent: true },
    { icon: TrendingUp, label: "7 хоногт", value: data.stats.weekCount },
    { icon: CalendarDays, label: "Энэ сард", value: data.stats.monthCount },
    { icon: Check, label: "Баталгаажсан", value: data.stats.confirmedCount },
    { icon: Map, label: "Нийтлэгдсэн аялал", value: data.stats.tripCount },
    { icon: FileText, label: "Ноорог аялал", value: data.stats.draftCount },
  ];

  const vs = data.visitorStats;
  const deviceRows = [
    { key: "mobile", label: "Утас", icon: Smartphone, count: vs.devices.mobile ?? 0 },
    { key: "desktop", label: "Компьютер", icon: Monitor, count: vs.devices.desktop ?? 0 },
    { key: "tablet", label: "Таблет", icon: Tablet, count: vs.devices.tablet ?? 0 },
    { key: "unknown", label: "Тодорхойгүй", icon: Users, count: vs.devices.unknown ?? 0 },
  ].filter((row) => row.count > 0);
  const deviceTotal = deviceRows.reduce((sum, row) => sum + row.count, 0);

  return (
    <>
      <h1 className="text-2xl font-bold">Хяналтын самбар</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ icon: Icon, label, value, accent }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5">
            <span
              className={
                accent && value > 0
                  ? "inline-flex rounded-xl bg-gold/20 p-2.5 text-gold"
                  : "inline-flex rounded-xl bg-primary/10 p-2.5 text-primary"
              }
            >
              <Icon className="h-5 w-5" />
            </span>
            <div className="mt-3 text-xs text-muted-foreground">{label}</div>
            <div className="mt-0.5 text-xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      {data.stats.newCount > 0 && (
        <Link
          href={`/${locale}/admin/enquiries?status=NEW`}
          className="mt-4 flex items-center justify-between rounded-2xl border border-gold bg-gold/10 p-4 text-sm transition-colors hover:bg-gold/20"
        >
          <span>
            <strong>{data.stats.newCount}</strong> хүсэлт залгах хүлээж байна.
          </span>
          <span className="font-semibold text-primary">Харах →</span>
        </Link>
      )}

      <section className="mt-8 rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Users className="h-4 w-4 text-primary" />
          Сайтад орсон хүмүүс
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Нэг төхөөрөмж хэдэн ч удаа нээсэн нэг хүн гэж тоолно. Та өөрөө нэвтэрсэн төхөөрөмжөөр орсон нь тоологдохгүй.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Өнөөдөр", value: vs.visitors.today },
            { label: "Сүүлийн 7 хоног", value: vs.visitors.week },
            { label: "Энэ сар", value: vs.visitors.month },
            { label: "Буцаж ирсэн (энэ сар)", value: vs.returningMonth },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-border p-3">
              <div className="text-xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Энэ сар {vs.viewsMonth} удаа хуудас нээгдсэнээс {vs.visitors.month} өөр хүн орсон.
        </p>

        {deviceTotal > 0 && (
          <div className="mt-5">
            <div className="text-sm font-semibold">Ямар төхөөрөмжөөр орсон (энэ сар)</div>
            <ul className="mt-3 space-y-2.5">
              {deviceRows.map(({ key, label, icon: Icon, count }) => (
                <li key={key} className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="w-24 shrink-0 text-sm">{label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round((count / deviceTotal) * 100)}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                    {count} хүн · {Math.round((count / deviceTotal) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Inbox className="h-4 w-4 text-primary" />
              Сүүлийн хүсэлтүүд
            </h2>
            <Link
              href={`/${locale}/admin/enquiries`}
              className="text-sm font-semibold text-primary hover:underline"
            >
              Бүгд
            </Link>
          </div>

          {data.recentEnquiries.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Хүсэлт хараахан алга.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.recentEnquiries.map((enquiry) => (
                <li key={enquiry.id} className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {[enquiry.firstName, enquiry.lastName].filter(Boolean).join(" ")}
                      </span>
                      <EnquiryStatusBadge status={enquiry.status} />
                    </div>
                    <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {enquiry.trip?.title ?? "Аялал сонгоогүй"} ·{" "}
                      {enquiry.adults + enquiry.children + enquiry.infants} хүн
                    </div>
                  </div>
                  <a
                    href={`tel:${enquiry.phone.replace(/[^\d+]/g, "")}`}
                    className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <Phone className="h-3 w-3" />
                    {enquiry.phone}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <CalendarDays className="h-4 w-4 text-primary" />
            Ойрын хөдөлгөөн
          </h2>

          {data.upcomingDepartures.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Товлогдсон огноо алга.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.upcomingDepartures.map((departure) => (
                <li key={departure.id} className="flex items-center gap-3">
                  <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-secondary">
                    {departure.trip.image && (
                      <Image
                        src={departure.trip.image}
                        alt={departure.trip.title}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-sm font-medium">{departure.trip.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(departure.startDate).toLocaleDateString("mn-MN", {
                        month: "long",
                        day: "numeric",
                      })}
                      {departure.seatsLeft != null &&
                        ` · ${departure.seatsLeft}/${departure.seatsTotal ?? "?"} суудал`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {Object.keys(vs.engagement).length > 0 && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-bold">Энэ сарын идэвх</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Хүсэлт болгоогүй ч сайттай харьцсан хүмүүс. Том тоо нь хэдэн өөр хүн, жижиг тоо нь нийт хэдэн удаа дарсныг заана.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { key: "share_click", label: "Хуваалцсан", icon: Share2 },
              { key: "save_toggle", label: "Хадгалсан", icon: Heart },
              { key: "phone_click", label: "Утас дарсан", icon: Phone },
              { key: "messenger_click", label: "Messenger дарсан", icon: MessageCircle },
              { key: "departure_select", label: "Огноо сонгосон", icon: CalendarDays },
              { key: "custom_trip_submit", label: "Захиалгат хүсэлт", icon: TrendingUp },
            ].map(({ key, label, icon: Icon }) => {
              const entry = vs.engagement[key] ?? { people: 0, times: 0 };
              return (
                <div key={key} className="rounded-xl border border-border p-3">
                  <Icon className="h-4 w-4 text-primary" />
                  <div className="mt-2 text-lg font-bold">{entry.people} хүн</div>
                  <div className="text-xs text-muted-foreground">
                    {label}
                    {entry.times > entry.people && ` · нийт ${entry.times} удаа`}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {data.topTrips.length > 0 && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <TrendingUp className="h-4 w-4 text-primary" />
            Энэ сард хамгийн их асуусан
          </h2>
          <ul className="mt-4 space-y-3">
            {data.topTrips.map((trip) => (
              <li key={trip.id} className="flex items-center gap-3">
                <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-secondary">
                  {trip.image && (
                    <Image
                      src={trip.image}
                      alt={trip.title}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-sm font-medium">{trip.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {trip.enquiryCount} хүсэлт · {formatMnt(trip.price)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
