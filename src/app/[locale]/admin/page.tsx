"use client";

import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Check,
  FileText,
  Heart,
  Inbox,
  Map,
  MessageCircle,
  Phone,
  Share2,
  TrendingUp,
} from "lucide-react";

import { api } from "@/lib/api";
import { useAuth } from "@/app/[locale]/provider/AuthProvider";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import AdminShell from "@/components/admin/AdminShell";
import EnquiryStatusBadge from "@/components/admin/EnquiryStatusBadge";
import { Button } from "@/components/ui/button";
import { formatMnt } from "@/lib/pricing";

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

  if (isPending) {
    return (
      <AdminShell>
        <div className="h-40 animate-pulse rounded-2xl bg-card" />
      </AdminShell>
    );
  }

  // A 403 here means the cookie got them past the middleware but the database
  // says they are not staff — the API is the real gate.
  if (isError) {
    const status = (error as { response?: { status?: number } })?.response?.status;

    return (
      <AdminShell>
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
      </AdminShell>
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

  return (
    <AdminShell>
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

      {Object.keys(data.events).length > 0 && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-bold">Энэ сарын идэвх</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Хүсэлт болгоогүй ч сайттай харьцсан дохио — хуудас хараад юу ч хийхгүй
            орхисон эсэхийг харах боломжтой.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { key: "share_click", label: "Хуваалцсан", icon: Share2 },
              { key: "save_toggle", label: "Хадгалсан", icon: Heart },
              { key: "phone_click", label: "Утас дарсан", icon: Phone },
              { key: "messenger_click", label: "Messenger дарсан", icon: MessageCircle },
              { key: "departure_select", label: "Огноо сонгосон", icon: CalendarDays },
              { key: "custom_trip_submit", label: "Захиалгат хүсэлт", icon: TrendingUp },
            ].map(({ key, label, icon: Icon }) => (
              <div key={key} className="rounded-xl border border-border p-3">
                <Icon className="h-4 w-4 text-primary" />
                <div className="mt-2 text-lg font-bold">{data.events[key] ?? 0}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
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
    </AdminShell>
  );
}
