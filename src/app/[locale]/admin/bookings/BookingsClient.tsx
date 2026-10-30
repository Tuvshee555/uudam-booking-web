"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Banknote,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Flag,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Ticket,
  Users,
  XCircle,
} from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import {
  BOOKING_AWAITING,
  BOOKING_STATUS_INFO,
  BOOKING_STATUSES,
  type BookingStatus,
} from "@/components/admin/statuses";
import {
  DetailRow,
  EmptyState,
  ErrorState,
  FilterChips,
  FormField,
  LoadingRows,
  Notice,
  PageHeader,
  Panel,
  SearchInput,
  SelectFilter,
  SidePanel,
  StatusBadge,
  useConfirm,
  useDebouncedValue,
  useNow,
} from "@/components/admin/ui";
import { useUrlFilters } from "@/components/admin/useUrlFilters";
import { useAdminSummary, LIVE_QUERY } from "@/hooks/useAdminSummary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { departureDateKey } from "@/lib/departureDate";
import {
  dateFromKey,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPeople,
  formatRelative,
  formatTimeLeft,
  fullName,
  telHref,
  totalPeople,
} from "@/lib/adminFormat";
import { cn } from "@/lib/utils";

type Booking = {
  id: string;
  reference: string;
  status: BookingStatus;
  adults: number;
  children: number;
  infants: number;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  notes: string | null;
  totalPrice: number;
  paidAmount: number;
  holdExpiresAt: string | null;
  createdAt: string;
  trip: { id: string; title: string; image: string; slug: string };
  departure: { id: string; startDate: string; endDate: string | null };
  payments: { id: string; reference: string; method: string; status: string; amount: number; paidAt: string | null }[];
  travelers: {
    id: string;
    firstName: string;
    lastName: string | null;
    type: "ADULT" | "CHILD" | "INFANT";
    dateOfBirth: string | null;
    nationality: string | null;
    passportNumber: string | null;
    passportExpiry: string | null;
  }[];
  handledBy?: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
};

const TRAVELER_TYPE = { ADULT: "Том хүн", CHILD: "Хүүхэд", INFANT: "Нярай" } as const;
const PAYMENT_METHOD: Record<string, string> = { BANK: "Банкны шилжүүлэг", QPAY: "QPay" };
const PAYMENT_STATUS: Record<string, { label: string; tone: "warning" | "success" | "danger" | "neutral" }> = {
  PENDING: { label: "Хүлээгдэж буй", tone: "warning" },
  PAID: { label: "Төлөгдсөн", tone: "success" },
  FAILED: { label: "Амжилтгүй", tone: "danger" },
  REFUNDED: { label: "Буцаасан", tone: "neutral" },
};

function departureDay(value: string) {
  return formatDate(dateFromKey(departureDateKey(value)));
}

function balanceOf(booking: Booking) {
  return Math.max(0, booking.totalPrice - booking.paidAmount);
}

function canRecordPayment(status: BookingStatus) {
  return BOOKING_AWAITING.includes(status);
}

export default function BookingsClient() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const now = useNow(30_000);
  const { data: summary } = useAdminSummary();

  const [filters, setFilters] = useUrlFilters({ status: "ALL", q: "", sort: "created", open: "" });
  const [searchDraft, setSearchDraft] = useState(filters.q);
  const search = useDebouncedValue(searchDraft.trim(), 350);
  useEffect(() => {
    if (search !== filters.q) setFilters({ q: search });
    // Only a settled search should move the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const [paying, setPaying] = useState<Booking | null>(null);

  const statusParam = filters.status === "ALL" ? undefined : filters.status === "AWAITING" ? BOOKING_AWAITING.join(",") : filters.status;

  const list = useQuery<Booking[]>({
    queryKey: ["admin", "bookings", filters.status, filters.q],
    queryFn: async () =>
      (await api.get<Booking[]>("/bookings", { params: { status: statusParam, search: filters.q || undefined } })).data,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    ...LIVE_QUERY,
  });

  const bookings = useMemo(() => {
    const rows = [...(list.data ?? [])];
    if (filters.sort === "departure") {
      rows.sort((a, b) => a.departure.startDate.localeCompare(b.departure.startDate));
    }
    return rows;
  }, [list.data, filters.sort]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

  const updateStatus = useMutation({
    mutationFn: async ({ reference, status }: { reference: string; status: BookingStatus }) =>
      api.patch(`/bookings/${reference}`, { status }),
    onSuccess: (_, { reference, status }) => {
      invalidate();
      toast.success(
        status === "CANCELLED"
          ? `${reference} захиалгыг цуцаллаа. Суудал нь буцаж зарагдана.`
          : `${reference}: «${BOOKING_STATUS_INFO[status].label}» боллоо`,
      );
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Төлөв өөрчлөхөд алдаа гарлаа")),
  });

  async function cancel(booking: Booking) {
    const ok = await confirm({
      title: `${booking.reference} захиалгыг цуцлах уу?`,
      description:
        booking.paidAmount > 0
          ? `Энэ захиалгад ${formatMoney(booking.paidAmount)} төлөгдсөн байна. Цуцалбал суудал нь буцаж зарагдах боловч мөнгийг буцаах ажлыг та гараар хийнэ.`
          : "Захиалга цуцлагдаж, барьсан суудал нь буцаж зарагдана. Буцааж сэргээх боломжгүй.",
      confirmLabel: "Захиалгыг цуцлах",
      cancelLabel: "Үгүй, хэвээр үлдээх",
      tone: "danger",
    });
    if (ok) updateStatus.mutate({ reference: booking.reference, status: "CANCELLED" });
  }

  async function complete(booking: Booking) {
    const ok = await confirm({
      title: "Аялал дууссан гэж тэмдэглэх үү?",
      description: `${booking.reference} — ${booking.trip.title}. Аялагчид аялалдаа явж ирсний дараа тэмдэглэнэ.`,
      confirmLabel: "Дууссан гэж тэмдэглэх",
    });
    if (ok) updateStatus.mutate({ reference: booking.reference, status: "COMPLETED" });
  }

  const awaitingCount = summary?.bookings.awaiting ?? 0;
  const statusOptions = [
    { value: "ALL", label: "Бүгд", count: summary?.bookings.total },
    { value: "AWAITING", label: "Төлбөр хүлээж буй", count: summary ? awaitingCount : undefined },
    ...BOOKING_STATUSES.map((status) => ({
      value: status,
      label: BOOKING_STATUS_INFO[status].label,
      count: summary ? (summary.bookings.byStatus[status] ?? 0) : undefined,
    })),
  ];

  const openBooking = bookings.find((booking) => booking.id === filters.open) ?? null;
  const filtersActive = filters.status !== "ALL" || Boolean(filters.q);

  return (
    <>
      <PageHeader
        title="Захиалгууд"
        description="Сайтаас онлайнаар хийсэн захиалгууд. Үйлчлүүлэгч захиалгын дугаараа гүйлгээний утгад бичиж банкаар шилжүүлдэг — банкны хуулгаас тэр дугаарыг хайж олоод «Төлбөр бүртгэх» дарна."
        actions={
          <Button variant="outline" onClick={() => list.refetch()} disabled={list.isFetching}>
            <RefreshCw className={cn(list.isFetching && "animate-spin")} />
            Шинэчлэх
          </Button>
        }
      />

      {awaitingCount > 0 && filters.status !== "AWAITING" && (
        <Notice
          tone="warning"
          icon={Banknote}
          className="mb-4"
          title={`${formatNumber(awaitingCount)} захиалга төлбөр хүлээж байна`}
          action={
            <Button size="sm" variant="outline" onClick={() => setFilters({ status: "AWAITING" })}>
              Зөвхөн тэдгээрийг харах
            </Button>
          }
        >
          Нийт {formatMoney(summary?.bookings.awaitingAmount ?? 0)} орж ирэх ёстой. Банкны шилжүүлэг хугацаандаа орохгүй бол барьсан суудал
          автоматаар суллагдана.
        </Notice>
      )}

      <div className="space-y-3">
        <FilterChips label="Төлвөөр шүүх" options={statusOptions} value={filters.status} onChange={(status) => setFilters({ status })} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput
            className="flex-1"
            value={searchDraft}
            onChange={setSearchDraft}
            placeholder="Захиалгын дугаар, утас, нэрээр хайх"
          />
          <SelectFilter
            label="Эрэмбэ"
            value={filters.sort}
            onChange={(sort) => setFilters({ sort })}
            options={[
              { value: "created", label: "Шинэ захиалга эхэндээ" },
              { value: "departure", label: "Аялал ойрхон нь эхэндээ" },
            ]}
          />
        </div>
      </div>

      <Panel className="mt-4" bodyClassName="p-0 sm:p-0">
        {list.isPending ? (
          <LoadingRows rows={5} className="p-4" rowClassName="h-24" />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : bookings.length === 0 ? (
          filtersActive ? (
            <EmptyState
              icon={Ticket}
              title="Тохирох захиалга олдсонгүй"
              description="Захиалгын дугаарыг бүтнээр нь эсвэл утасны дугаараар хайгаад үзнэ үү."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchDraft("");
                    setFilters({ status: null, q: null });
                  }}
                >
                  Шүүлтүүрийг арилгах
                </Button>
              }
            />
          ) : (
            <EmptyState icon={Ticket} title="Онлайн захиалга хараахан ирээгүй байна" description="Үйлчлүүлэгч сайтаас захиалга хийхэд энд харагдана." />
          )
        ) : (
          <>
            <p className="border-b border-border px-4 py-2.5 text-sm text-muted-foreground">
              {formatNumber(bookings.length)} захиалга{filtersActive ? " олдлоо" : ""}
              {bookings.length >= 200 && " (сүүлийн 200-г харуулж байна — хайлтаар нарийсгана уу)"}
            </p>
            <ul className={cn("divide-y divide-border", list.isPlaceholderData && "opacity-60")}>
              {bookings.map((booking) => {
                const info = BOOKING_STATUS_INFO[booking.status];
                const balance = balanceOf(booking);
                const paidShare = booking.totalPrice > 0 ? Math.min(100, (booking.paidAmount / booking.totalPrice) * 100) : 0;
                const holdLeft = booking.status === "HELD" && booking.holdExpiresAt ? formatTimeLeft(booking.holdExpiresAt, now) : null;
                const name = fullName(booking.firstName, booking.lastName);
                return (
                  <li key={booking.id} className="px-4 py-4">
                    <div className="grid gap-x-5 gap-y-3 md:grid-cols-2 md:items-center lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,0.9fr)] xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_22rem]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setFilters({ open: booking.id })}
                            className="font-mono text-sm font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {booking.reference}
                          </button>
                          <StatusBadge tone={info.tone} title={info.description}>
                            {info.label}
                          </StatusBadge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground" title={formatDateTime(booking.createdAt)}>
                          {formatRelative(booking.createdAt, now)}
                        </p>
                        {holdLeft && (
                          <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                            <Clock className="h-3.5 w-3.5" />
                            Суудал суллагдахад {holdLeft} үлдсэн
                          </p>
                        )}
                      </div>

                      <div className="flex min-w-0 gap-3">
                        <div className="relative hidden h-12 w-16 shrink-0 overflow-hidden rounded-md bg-muted sm:block">
                          {booking.trip.image && <Image src={booking.trip.image} alt="" fill sizes="64px" className="object-cover" />}
                        </div>
                        <div className="min-w-0 text-sm">
                          <p className="truncate font-medium">{booking.trip.title}</p>
                          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {departureDay(booking.departure.startDate)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {totalPeople(booking)} хүн
                            </span>
                          </p>
                          <p className="mt-0.5 truncate text-xs">
                            {name} ·{" "}
                            <a href={telHref(booking.phone)} className="font-medium text-primary hover:underline">
                              {booking.phone}
                            </a>
                          </p>
                        </div>
                      </div>

                      <div className="min-w-0 text-sm">
                        <p className="font-semibold tabular-nums">{formatMoney(booking.totalPrice)}</p>
                        <div className="mt-1.5 h-1.5 w-full max-w-[12rem] overflow-hidden rounded-full bg-muted" aria-hidden="true">
                          <div className={cn("h-full rounded-full", balance === 0 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${paidShare}%` }} />
                        </div>
                        <p className="mt-1 text-xs tabular-nums">
                          {balance === 0 ? (
                            <span className="font-medium text-emerald-700 dark:text-emerald-400">Бүрэн төлсөн</span>
                          ) : booking.status === "CANCELLED" || booking.status === "EXPIRED" ? (
                            <span className="text-muted-foreground">Төлсөн {formatMoney(booking.paidAmount)}</span>
                          ) : (
                            <>
                              <span className="text-muted-foreground">Төлсөн {formatMoney(booking.paidAmount)} · </span>
                              <span className="font-medium text-red-700 dark:text-red-400">Үлдэгдэл {formatMoney(balance)}</span>
                            </>
                          )}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 md:justify-end lg:col-span-3 lg:justify-start xl:col-span-1 xl:justify-end">
                        {canRecordPayment(booking.status) && (
                          <>
                            <Button size="sm" onClick={() => setPaying(booking)}>
                              <Banknote />
                              Төлбөр бүртгэх
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => cancel(booking)}>
                              Цуцлах
                            </Button>
                          </>
                        )}
                        {booking.status === "CONFIRMED" && (
                          <Button size="sm" variant="outline" onClick={() => complete(booking)}>
                            <Flag />
                            Аялал дууссан
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setFilters({ open: booking.id })}>
                          Дэлгэрэнгүй
                          <ChevronRight />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>

      {/* The freshest copy, so a second payment right after the first counts what is already paid. */}
      <PaymentDialog booking={paying ? (list.data?.find((booking) => booking.id === paying.id) ?? paying) : null} onClose={() => setPaying(null)} onDone={invalidate} />

      <SidePanel
        open={Boolean(filters.open)}
        onOpenChange={(open) => !open && setFilters({ open: null })}
        title={openBooking ? `Захиалга ${openBooking.reference}` : "Захиалга"}
        description={openBooking ? `${BOOKING_STATUS_INFO[openBooking.status].label} · ${formatRelative(openBooking.createdAt, now)}` : undefined}
        footer={
          openBooking && (
            <div className="flex flex-wrap justify-end gap-2">
              {canRecordPayment(openBooking.status) && (
                <>
                  <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => cancel(openBooking)}>
                    <XCircle />
                    Цуцлах
                  </Button>
                  <Button onClick={() => setPaying(openBooking)}>
                    <Banknote />
                    Төлбөр бүртгэх
                  </Button>
                </>
              )}
              {openBooking.status === "CONFIRMED" && (
                <>
                  <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => cancel(openBooking)}>
                    <XCircle />
                    Цуцлах
                  </Button>
                  <Button onClick={() => complete(openBooking)}>
                    <Flag />
                    Аялал дууссан
                  </Button>
                </>
              )}
            </div>
          )
        }
      >
        {!openBooking ? (
          list.isPending ? (
            <LoadingRows rows={6} />
          ) : (
            <EmptyState compact icon={Ticket} title="Захиалга олдсонгүй" description="Шүүлтүүрээ арилгаад дахин нээж үзнэ үү." />
          )
        ) : (
          <BookingDetail booking={openBooking} locale={locale} now={now} />
        )}
      </SidePanel>
    </>
  );
}

function BookingDetail({ booking, locale, now }: { booking: Booking; locale: string; now: Date }) {
  const balance = balanceOf(booking);
  const holdLeft = booking.status === "HELD" && booking.holdExpiresAt ? formatTimeLeft(booking.holdExpiresAt, now) : null;

  function copy(text: string, label: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${label} хууллаа`))
      .catch(() => toast.error("Хуулж чадсангүй"));
  }

  return (
    <div className="space-y-6">
      {holdLeft && (
        <Notice tone="warning" icon={Clock} title={`Суудал суллагдахад ${holdLeft} үлдсэн`}>
          Банкны шилжүүлэг энэ хугацаанд орохгүй бол захиалга «Хугацаа дууссан» болж, суудал нь буцаж зарагдана.
        </Notice>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button asChild size="lg" className="h-11">
          <a href={telHref(booking.phone)}>
            <Phone />
            Залгах · {booking.phone}
          </a>
        </Button>
        <Button variant="outline" size="lg" className="h-11" onClick={() => copy(booking.reference, "Захиалгын дугаар")}>
          <Copy />
          Дугаар хуулах
        </Button>
      </div>

      <section>
        <h3 className="mb-1 text-sm font-semibold">Төлбөр</h3>
        <dl className="divide-y divide-border">
          <DetailRow label="Нийт үнэ">{formatMoney(booking.totalPrice)}</DetailRow>
          <DetailRow label="Төлсөн">{formatMoney(booking.paidAmount)}</DetailRow>
          <DetailRow label="Үлдэгдэл">
            {balance === 0 ? (
              <span className="text-emerald-700 dark:text-emerald-400">Үлдэгдэлгүй</span>
            ) : (
              <span className="text-red-700 dark:text-red-400">{formatMoney(balance)}</span>
            )}
          </DetailRow>
          <DetailRow label="Гүйлгээний утга">
            <span className="font-mono">{booking.reference}</span>
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Үйлчлүүлэгч шилжүүлэг дээрээ энэ дугаарыг бичнэ.</span>
          </DetailRow>
        </dl>
        {booking.payments.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Арга</th>
                  <th className="px-3 py-2 font-medium">Төлөв</th>
                  <th className="px-3 py-2 text-right font-medium">Дүн</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {booking.payments.map((payment) => {
                  const status = PAYMENT_STATUS[payment.status] ?? { label: payment.status, tone: "neutral" as const };
                  return (
                    <tr key={payment.id}>
                      <td className="px-3 py-2">
                        {PAYMENT_METHOD[payment.method] ?? payment.method}
                        {payment.paidAt && <span className="block text-xs text-muted-foreground">{formatDateTime(payment.paidAt, now)}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(payment.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold">Аялал</h3>
        <dl className="divide-y divide-border">
          <DetailRow label="Аялал">
            <span className="block">{booking.trip.title}</span>
            <span className="mt-1 flex flex-wrap gap-x-3 text-xs font-normal">
              <Link href={`/${locale}/admin/trips/${booking.trip.id}/edit`} className="text-primary hover:underline">
                Аяллыг засах
              </Link>
              <a href={`/${locale}/trips/${booking.trip.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                Сайт дээр харах
                <ExternalLink className="h-3 w-3" />
              </a>
            </span>
          </DetailRow>
          <DetailRow label="Гарах өдөр">
            {departureDay(booking.departure.startDate)}
            {booking.departure.endDate && ` – ${departureDay(booking.departure.endDate)}`}
          </DetailRow>
          <DetailRow label="Хүний тоо">
            {formatPeople(booking)} <span className="font-normal text-muted-foreground">(нийт {totalPeople(booking)})</span>
          </DetailRow>
        </dl>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold">Захиалагч</h3>
        <dl className="divide-y divide-border">
          <DetailRow label="Нэр">{fullName(booking.firstName, booking.lastName)}</DetailRow>
          <DetailRow label="Утас">
            <a href={telHref(booking.phone)} className="text-primary hover:underline">
              {booking.phone}
            </a>
          </DetailRow>
          <DetailRow label="И-мэйл">
            {booking.email ? (
              <a href={`mailto:${booking.email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                <Mail className="h-3.5 w-3.5" />
                {booking.email}
              </a>
            ) : (
              <span className="font-normal text-muted-foreground">Үлдээгээгүй</span>
            )}
          </DetailRow>
          <DetailRow label="Захиалсан">{formatDateTime(booking.createdAt, now)}</DetailRow>
          {booking.handledBy && (
            <DetailRow label="Сүүлд шийдсэн">
              {[booking.handledBy.firstName, booking.handledBy.lastName].filter(Boolean).join(" ") || booking.handledBy.email}
            </DetailRow>
          )}
        </dl>
        {booking.notes && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Захиалагчийн тэмдэглэл</p>
            <p className="whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-sm leading-relaxed">{booking.notes}</p>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold">Аялагчид</h3>
        {booking.travelers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Аялагч бүрийн паспортын мэдээллийг хараахан оруулаагүй байна.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {booking.travelers.map((traveler) => (
              <li key={traveler.id} className="px-3 py-2.5 text-sm">
                <p className="font-medium">
                  {fullName(traveler.firstName, traveler.lastName)}{" "}
                  <span className="font-normal text-muted-foreground">· {TRAVELER_TYPE[traveler.type]}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[
                    traveler.dateOfBirth && `Төрсөн: ${formatDate(traveler.dateOfBirth, now)}`,
                    traveler.nationality,
                    traveler.passportNumber && `Паспорт: ${traveler.passportNumber}`,
                    traveler.passportExpiry && `Хүчинтэй: ${formatDate(traveler.passportExpiry, now)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Нэмэлт мэдээлэлгүй"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Records money that has reached the bank. The full balance confirms the
 * booking, exactly as the old one-tap "Төлбөр орсон" did; a part payment
 * (deposit) leaves it «Урьдчилгаа төлсөн» with the rest still owed.
 */
function PaymentDialog({ booking, onClose, onDone }: { booking: Booking | null; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const balance = booking ? balanceOf(booking) : 0;

  const record = useMutation({
    mutationFn: async (payload: { reference: string; paidAmount: number; status: BookingStatus }) =>
      api.patch(`/bookings/${payload.reference}`, { paidAmount: payload.paidAmount, status: payload.status }),
    onSuccess: (_, payload) => {
      onDone();
      toast.success(
        payload.status === "CONFIRMED"
          ? `${payload.reference}: төлбөр бүрэн орж, захиалга баталгаажлаа`
          : `${payload.reference}: урьдчилгаа бүртгэгдлээ`,
      );
      close();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Төлбөр бүртгэхэд алдаа гарлаа")),
  });

  function close() {
    setMode("full");
    setAmount("");
    setError(null);
    onClose();
  }

  function submit() {
    if (!booking) return;
    if (mode === "full") {
      record.mutate({ reference: booking.reference, paidAmount: booking.totalPrice, status: "CONFIRMED" });
      return;
    }
    const value = Number(amount.replace(/[\s,]/g, ""));
    if (!Number.isFinite(value) || value <= 0) return setError("Орсон дүнгээ оруулна уу");
    if (value > balance) return setError(`Үлдэгдлээс (${formatMoney(balance)}) их байж болохгүй`);
    const paid = booking.paidAmount + value;
    record.mutate({
      reference: booking.reference,
      paidAmount: paid,
      status: paid >= booking.totalPrice ? "CONFIRMED" : "PARTIALLY_PAID",
    });
  }

  const partialValue = Number(amount.replace(/[\s,]/g, ""));
  const partialValid = Number.isFinite(partialValue) && partialValue > 0 && partialValue <= balance;

  return (
    <Dialog open={Boolean(booking)} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>Төлбөр бүртгэх</DialogTitle>
          <DialogDescription>
            Банкны хуулгад <span className="font-mono font-semibold text-foreground">{booking?.reference}</span> гэсэн гүйлгээ орсныг шалгаад бүртгэнэ.
          </DialogDescription>
        </DialogHeader>

        {booking && (
          <div className="space-y-4">
            <dl className="rounded-lg bg-muted/50 px-3">
              <DetailRow label="Нийт үнэ">{formatMoney(booking.totalPrice)}</DetailRow>
              <DetailRow label="Өмнө төлсөн" className="border-t border-border">
                {formatMoney(booking.paidAmount)}
              </DetailRow>
              <DetailRow label="Үлдэгдэл" className="border-t border-border">
                {formatMoney(balance)}
              </DetailRow>
            </dl>

            <div role="radiogroup" aria-label="Хэдэн төгрөг орсон бэ" className="grid gap-2">
              {(
                [
                  { value: "full", title: `Үлдэгдэл бүтэн орсон — ${formatMoney(balance)}`, text: "Захиалга «Баталгаажсан» болно." },
                  { value: "partial", title: "Хэсэгчлэн (урьдчилгаа) орсон", text: "Орсон дүнгээ оруулна. Үлдэгдэл нь дараа нь бүртгэгдэнэ." },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === option.value}
                  onClick={() => {
                    setMode(option.value);
                    setError(null);
                  }}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    mode === option.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      mode === option.value ? "border-primary bg-primary" : "border-muted-foreground/40",
                    )}
                  >
                    {mode === option.value && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                  </span>
                  <span>
                    <span className="block font-medium">{option.title}</span>
                    <span className="block text-xs text-muted-foreground">{option.text}</span>
                  </span>
                </button>
              ))}
            </div>

            {mode === "partial" && (
              <FormField
                label="Орсон дүн (₮)"
                error={error}
                hint={
                  partialValid
                    ? partialValue >= balance
                      ? "Үлдэгдэл бүтэн орсон тул захиалга «Баталгаажсан» болно."
                      : `Бүртгэсний дараа ${formatMoney(balance - partialValue)} үлдэгдэлтэй үлдэнэ.`
                    : undefined
                }
              >
                <Input
                  inputMode="numeric"
                  autoFocus
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setError(null);
                  }}
                  placeholder="ж: 1000000"
                />
              </FormField>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:space-x-0">
          <Button variant="outline" onClick={close} disabled={record.isPending}>
            Болих
          </Button>
          <Button onClick={submit} disabled={record.isPending || (mode === "partial" && !amount.trim())}>
            {record.isPending ? <Loader2 className="animate-spin" /> : <Check />}
            Төлбөрийг бүртгэх
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
