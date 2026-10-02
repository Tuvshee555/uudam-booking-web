"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { api, apiErrorMessage } from "@/lib/api";
import { getVisitorId, track } from "@/lib/analytics";
import { ageBandsFor, formatFare, formatMnt, lineTotal, resolvePrices } from "@/lib/pricing";
import { availability, formatFullDate, formatDepartureDate, upcomingDepartures } from "@/lib/departures";
import { saleBadgeLabel } from "@/lib/tripMarketing";
import { datePriceOptions, formatAdultOption, hasVariablePricing } from "@/lib/tripPriceOptions";
import DepartureDatePicker from "./DepartureDatePicker";
import { departureDateKey } from "@/lib/departureDate";
import { announceDepartureSelect } from "./TripWeather";
import QpayPayButton, { QpayPaidBadge } from "./QpayPayButton";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Departure, Trip } from "@/types/trip";

type Step = "select" | "details" | "done";

function formatRange(departure: Departure) {
  const startText = formatFullDate(departure.startDate);
  if (!departure.endDate) return startText;
  return `${startText} — ${formatDepartureDate(departure.endDate)}`;
}

function Counter({
  label,
  hint,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-40"
          aria-label={`${label} хасах`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-6 text-center text-sm font-semibold tabular-nums">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border"
          aria-label={`${label} нэмэх`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Online booking, alongside (not instead of) the callback enquiry.
 *
 * The site still takes no money: this holds seats and hands the customer a
 * reference to quote on a bank transfer, which is how the agency already
 * gets paid. Every figure shown here is recomputed server-side at submit —
 * this panel's total is a preview, never the authority.
 */
export default function BookingPanel({
  trip,
  bankDetails,
  onAsk,
  selectedDate,
}: {
  trip: Trip;
  bankDetails?: string | null;
  selectedDate?: string;
  onAsk: (selection: { departureId: string; message: string; adults: number; children: number; infants: number }) => void;
}) {
  const { locale } = useI18n();

  const [step, setStep] = useState<Step>("select");
  const [departureId, setDepartureId] = useState<string | null>(() =>
    trip.departures.find((departure) => departureDateKey(departure.startDate) === selectedDate)?.id ?? null);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [hotel, setHotel] = useState("");
  const [tierCounts, setTierCounts] = useState<Record<string, number>>({});

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ reference: string; totalPrice: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [paidViaQpay, setPaidViaQpay] = useState(false);

  // Frozen at mount: reading the clock during render makes the component
  // impure, and departures shouldn't vanish while someone is mid-booking.
  const [now] = useState(() => Date.now());
  const openDepartures = useMemo(() => upcomingDepartures(trip, now), [trip, now]);

  const selected = openDepartures.find((d) => d.id === departureId && availability(d).selectable) ?? null;
  const options = selected ? datePriceOptions(trip, selected) : [];
  const hotelOptions = options.filter((option) => option.hotel)
    .sort((a, b) => (a.adult ?? Number.POSITIVE_INFINITY) - (b.adult ?? Number.POSITIVE_INFINITY));
  const option = hotelOptions.find((item) => item.hotel === hotel) ?? hotelOptions[0] ?? options[0] ?? null;
  const quoteOnly = hasVariablePricing(trip);
  const prices = resolvePrices(trip, selected);
  const ageBands = ageBandsFor(trip.sourceMetadata);
  const total = lineTotal({ adults, children, infants }, prices);
  const specialTiers = option?.passengers ?? [];
  const tierTotal = specialTiers.reduce((sum, item) => sum + (tierCounts[item.label] || 0) * (item.price || 0), 0);
  const missingTierPrice = specialTiers.some((item) => (tierCounts[item.label] || 0) > 0 && item.price == null);
  const quoteMin = missingTierPrice ? null : adults * (option?.adult ?? prices.adult) + tierTotal;
  const quoteMax = option?.adultMax != null ? adults * option.adultMax + tierTotal : quoteMin;
  const saleLabel = saleBadgeLabel(trip);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (!firstName.trim()) {
      toast.error("Нэрээ оруулна уу");
      return;
    }
    if (phone.replace(/\D/g, "").length < 6) {
      toast.error("Утасны дугаараа зөв оруулна уу");
      return;
    }

    setBusy(true);
    try {
      const { data } = await api.post("/bookings", {
        tripId: trip.id,
        departureId: selected?.id,
        adults,
        children,
        infants,
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: phone.trim(),
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
        source: typeof window !== "undefined" ? window.location.pathname : undefined,
        visitorId: getVisitorId(),
      });

      track("booking_submit", { tripId: trip.id });
      setResult({ reference: data.reference, totalPrice: data.totalPrice });
      setStep("done");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Захиалга үүсгэхэд алдаа гарлаа"));
    } finally {
      setBusy(false);
    }
  }

  if (step === "done" && result) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
          <Check className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-center text-lg font-bold">Захиалга үүслээ</h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
          Суудлыг түр барьлаа. Доорх дугаарыг гүйлгээний утга дээр бичиж
          шилжүүлэг хийнэ үү.
        </p>

        <div className="mt-4 rounded-xl bg-secondary p-4 text-center">
          <div className="text-xs text-muted-foreground">Захиалгын дугаар</div>
          <div className="mt-1 text-2xl font-bold tracking-wider text-primary">
            {result.reference}
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(result.reference);
                setCopied(true);
                toast.success("Хуулагдлаа");
                setTimeout(() => setCopied(false), 2000);
              } catch {
                toast.error("Хуулж чадсангүй");
              }
            }}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            Дугаар хуулах
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">Нийт төлөх дүн</span>
          <span className="text-xl font-bold text-primary">{formatMnt(result.totalPrice)}</span>
        </div>

        {paidViaQpay ? (
          <div className="mt-4">
            <QpayPaidBadge />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <QpayPayButton reference={result.reference} onPaid={() => setPaidViaQpay(true)} />

            {bankDetails ? (
              <div className="whitespace-pre-line rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm leading-relaxed">
                <div className="font-semibold">Эсвэл банкаар шилжүүлэх</div>
                {bankDetails}
              </div>
            ) : (
              <p className="rounded-xl bg-secondary p-3 text-xs leading-relaxed text-muted-foreground">
                Банкны шилжүүлгийн мэдээллийг ажилтан тантай холбогдож хэлнэ.
              </p>
            )}
          </div>
        )}

        <Button asChild variant="outline" className="mt-4 w-full">
          <Link href={`/${locale}/booking/${result.reference}`}>Захиалгаа харах</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xl font-bold text-primary">{quoteOnly && option ? formatAdultOption(option) : formatMnt(prices.adult)}</div>
          <div className="text-xs text-muted-foreground">{quoteOnly ? "нэг том хүний үнэ" : "нэг том хүн"}</div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {saleLabel && (
            <span className="rounded-full bg-destructive px-2.5 py-1 text-[11px] font-bold text-destructive-foreground">
              {saleLabel}
            </span>
          )}
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
            Онлайн захиалга
          </span>
        </div>
      </div>

      {!quoteOnly && <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Хүүхэд</span>
          <span className="font-medium text-foreground">{formatFare(prices.child)}</span>
        </div>
        <div className="flex justify-between">
          <span>Нярай</span>
          <span className="font-medium text-foreground">{formatFare(prices.infant)}</span>
        </div>
      </div>}

      {step === "select" && (
        <div className="mt-5">
          <DepartureDatePicker departures={openDepartures} selectedId={departureId} basePrice={trip.price}
            onSelect={(departure) => {
              setDepartureId(departure.id);
              announceDepartureSelect(departureDateKey(departure.startDate));
              setHotel("");
              setTierCounts({});
              track("departure_select", { tripId: trip.id, properties: { departureId: departure.id } });
            }} />

          {hotelOptions.length > 0 && <div className="mt-4 border-t border-border pt-4">
            <h3 className="text-sm font-semibold">Буудал</h3>
            <div className="mt-2 space-y-1.5">
              {hotelOptions.map((item) => <button key={item.hotel} type="button" aria-pressed={option?.hotel === item.hotel}
                onClick={() => { setHotel(item.hotel); setTierCounts({}); }}
                className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm ${option?.hotel === item.hotel ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                <span className="min-w-0 truncate font-medium">{item.hotel}</span>
                <span className="shrink-0 text-xs tabular-nums">{item === hotelOptions[0] ? "Хамгийн хямд"
                  : item.adult != null && hotelOptions[0].adult != null
                    ? `+${formatMnt(item.adult - hotelOptions[0].adult)}` : formatAdultOption(item)}</span>
              </button>)}
            </div>
          </div>}

          <div className="mt-4 divide-y divide-border border-t border-border">
            <Counter label="Том хүн" hint={ageBands.adult} value={adults} onChange={setAdults} min={1} />
            {quoteOnly && specialTiers.length > 0 ? specialTiers.map((item) =>
              <Counter key={item.label} label={item.label} hint={`${item.ageRange} · ${item.price == null ? "Үнэ лавлах" : formatMnt(item.price)}`}
                value={tierCounts[item.label] || 0} onChange={(value) => setTierCounts((current) => ({ ...current, [item.label]: value }))} />
            ) : <>
              <Counter label="Хүүхэд" hint={ageBands.child} value={children} onChange={setChildren} />
              <Counter label="Нярай" hint={ageBands.infant} value={infants} onChange={setInfants} />
            </>}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">{quoteOnly ? "Тооцоолсон үнэ" : "Нийт дүн"}</span>
            <span className="text-lg font-bold text-primary">{quoteOnly
              ? quoteMin == null ? "Үнэ лавлах" : quoteMax != null && quoteMax > quoteMin
                ? `${formatMnt(quoteMin)}–${formatMnt(quoteMax)}` : formatMnt(quoteMin)
              : formatMnt(total)}</span>
          </div>

          {quoteOnly && <p className="mt-1 text-xs text-muted-foreground">Эцсийн үнэ, өрөөний сонголтыг ажилтан баталгаажуулна.</p>}

          <Button
            className="mt-4 w-full"
            disabled={!selected}
            onClick={() => {
              if (quoteOnly && selected) {
                const counts = specialTiers.map((item) => `${item.label}: ${tierCounts[item.label] || 0}`).join(", ");
                onAsk({ departureId: selected.id, adults,
                  children: specialTiers.filter((item) => !/нярай|infant/i.test(item.label)).reduce((sum, item) => sum + (tierCounts[item.label] || 0), 0),
                  infants: specialTiers.filter((item) => /нярай|infant/i.test(item.label)).reduce((sum, item) => sum + (tierCounts[item.label] || 0), 0),
                  message: [option?.hotel ? `Буудал: ${option.hotel}` : "", counts].filter(Boolean).join("; ") });
              } else {
                setStep("details");
                track("booking_start", { tripId: trip.id });
              }
            }}
          >
            {selected ? quoteOnly ? "Үнийн санал авах" : "Захиалах" : "Огноогоо сонгоно уу"}
          </Button>
        </div>
      )}

      {step === "details" && (
        <form onSubmit={submit} className="mt-5">
          <button
            type="button"
            onClick={() => setStep("select")}
            className="text-xs font-semibold text-muted-foreground hover:text-primary"
          >
            ← Огноо солих
          </button>

          <div className="mt-3 rounded-xl bg-secondary p-3 text-xs">
            <div className="font-semibold">{selected && formatRange(selected)}</div>
            <div className="mt-0.5 text-muted-foreground">
              {adults} том хүн
              {children > 0 && `, ${children} хүүхэд`}
              {infants > 0 && `, ${infants} нярай`}
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="bk-first">Нэр *</Label>
                <Input
                  id="bk-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="bk-last">Овог</Label>
                <Input
                  id="bk-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="bk-phone">Утас *</Label>
              <Input
                id="bk-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9911 2233"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="bk-email">И-мэйл</Label>
              <Input
                id="bk-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Захиалгын мэдээлэл илгээнэ"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="bk-notes">Нэмэлт хүсэлт</Label>
              <textarea
                id="bk-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Нийт дүн</span>
            <span className="text-xl font-bold text-primary">{formatMnt(total)}</span>
          </div>

          <Button type="submit" disabled={busy} className="mt-4 w-full">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Захиалга баталгаажуулах
          </Button>

          <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
            Төлбөрийг банкны шилжүүлгээр хийнэ. Одоо мөнгө таталгүй, зөвхөн
            суудал захиална.
          </p>
        </form>
      )}
    </div>
  );
}
