"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Loader2, Minus, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { api, apiErrorMessage } from "@/lib/api";
import { getVisitorId, track } from "@/lib/analytics";
import { ageBandsFor, fareFor, formatMnt, hasKnownTripPrice, hasMissingPassengerFare, lineTotal, passengerFareLabel, resolvePrices } from "@/lib/pricing";
import { availability, formatFullDate, formatDepartureDate, startingPrice, upcomingDepartures } from "@/lib/departures";
import { saleBadgeLabel } from "@/lib/tripMarketing";
import { datePriceOptions, formatAdultOption, formatPriceDelta, hasVariablePricing, priceDimensionOptions } from "@/lib/tripPriceOptions";
import { roundTemp, shortDate, weatherIcon, weatherLabel, type TripWeatherReport } from "@/lib/weather";
import { emailError, formatPhoneInput, nameError, phoneError } from "@/lib/formValidation";
import { canonicalPath } from "@/lib/locales";
import { formatTripTitle } from "@/lib/tripDisplay";
import DepartureDatePicker from "./DepartureDatePicker";
import { departureDateKey } from "@/lib/departureDate";
import { useTripWeather } from "./TripWeather";
import QpayPayButton, { QpayPaidBadge } from "./QpayPayButton";
import FormField, { inputClass, revealConfirmation, useSubmitGuard } from "@/components/site/FormField";
import Honeypot from "@/components/site/Honeypot";
import { ChannelLink } from "@/components/site/channels";
import { channel } from "@/lib/channels";
import { cn } from "@/lib/utils";
import type { Departure, Trip } from "@/types/trip";

type Step = "select" | "details" | "done";

type BookingResult = {
  reference: string;
  totalPrice: number;
  holdExpiresAt: string | null;
  duplicate: boolean;
  payment: { qpay: boolean; bankDetails: string | null };
};

function formatRange(departure: Departure) {
  const startText = formatFullDate(departure.startDate);
  if (!departure.endDate) return startText;
  return `${startText} — ${formatDepartureDate(departure.endDate)}`;
}

function pricedHint(age: string, price: number | null | undefined) {
  return [age, !hasKnownTripPrice(price) ? "Үнэ лавлах" : formatMnt(price)].filter(Boolean).join(" · ");
}

function ulaanbaatarTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-GB", { timeZone: "Asia/Ulaanbaatar", hour: "2-digit", minute: "2-digit" });
}

function BookingWeatherSummary({ report }: { report: TripWeatherReport }) {
  const days = report.days.filter((day) => day.hi !== null && day.lo !== null);
  if (!days.length) return null;
  const avgHi = days.reduce((sum, day) => sum + (day.hi ?? 0), 0) / days.length;
  const avgLo = days.reduce((sum, day) => sum + (day.lo ?? 0), 0) / days.length;
  const wetDays = days.filter((day) =>
    day.source === "typical" ? (day.rainChance ?? 0) >= 30 : (day.precipMm ?? 0) >= 1,
  ).length;
  const iconDay = days.find((day) => day.symbol) ?? days[0];
  const typical = days.some((day) => day.source === "typical");
  const places = [...new Set(days.flatMap((day) => day.place !== null ? [report.places[day.place]?.name] : []).filter(Boolean))]
    .slice(0, 2)
    .join(", ");

  return (
    <div className="mt-4 flex items-start gap-3 rounded-lg bg-secondary/70 p-3.5">
      {iconDay.symbol && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={weatherIcon(iconDay.symbol)} alt={weatherLabel(iconDay.symbol)} className="h-11 w-11 shrink-0" draggable={false} />
      )}
      <div className="min-w-0 text-[12.5px] leading-relaxed text-muted-foreground">
        <p className="font-semibold text-foreground">
          {typical ? "Аялах үеийн дундаж цаг агаар" : "Аялах үеийн цаг агаар"}
          <span className="font-normal text-muted-foreground"> · {shortDate(days[0].date)}–{shortDate(days[days.length - 1].date)}{places ? ` · ${places}` : ""}</span>
        </p>
        <p className="mt-0.5">
          Өдөртөө дунджаар <span className="font-semibold text-foreground">{roundTemp(avgHi)}°C</span>, шөнөдөө{" "}
          <span className="font-semibold text-foreground">{roundTemp(avgLo)}°C</span>.
          {wetDays > 0 ? ` Бороо орох магадлалтай ${wetDays} өдөр.` : " Бороо бага магадлалтай."}
          {typical ? " Олон жилийн дундаж; ойртоход бодит мэдээгээр солигдоно." : ""}
        </p>
      </div>
    </div>
  );
}

export function Counter({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 30,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-foreground">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] text-muted-foreground">{hint}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-3" role="group" aria-label={label}>
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-foreground/40 focus-ring disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={`${label} хасах`}
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="w-6 text-center text-[15px] font-semibold tabular-nums text-foreground" aria-live="polite">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-foreground/40 focus-ring disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={`${label} нэмэх`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps = [
    { key: "select", label: "Огноо, хүн" },
    { key: "details", label: "Холбоо барих" },
  ];
  const index = step === "select" ? 0 : 1;
  return (
    <ol className="mt-5 grid grid-cols-2 gap-2" aria-label="Захиалгын алхам">
      {steps.map((entry, position) => (
        <li key={entry.key} aria-current={position === index ? "step" : undefined} className="flex flex-col gap-1.5">
          <span className={cn("h-[3px] rounded-full", position <= index ? "bg-gold" : "bg-border")} />
          <span className={cn("text-[11.5px] font-semibold", position === index ? "text-foreground" : "text-muted-foreground")}>
            {position + 1}. {entry.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Online booking, alongside (not instead of) the callback enquiry.
 *
 * Booking here holds the seats for an hour and gives the customer a
 * reference; nothing is charged, and a member of staff confirms the booking
 * by phone. Every figure shown is a preview: the server recomputes the total
 * from the database at submit.
 */
export default function BookingPanel({
  trip,
  onAsk,
  selectedDate,
  onDepartureChange,
}: {
  trip: Trip;
  bankDetails?: string | null;
  selectedDate?: string;
  onDepartureChange: (date: string) => void;
  onAsk: (selection: { departureId: string; message: string; adults: number; children: number; infants: number }) => void;
}) {
  // The page mounts one panel for phones and one for the desktop column.
  const uid = useId();
  const fieldId = (name: string) => `${uid}-bk-${name}`;
  const [step, setStep] = useState<Step>("select");
  const [departureId, setDepartureId] = useState<string | null>(() =>
    trip.departures.find((departure) => departureDateKey(departure.startDate) === selectedDate)?.id ?? null);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [selectedOptionKey, setSelectedOptionKey] = useState("");
  const [tierCounts, setTierCounts] = useState<Record<string, number>>({});

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const { busy, run } = useSubmitGuard();
  const [result, setResult] = useState<BookingResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [paidViaQpay, setPaidViaQpay] = useState(false);

  // Frozen at mount: reading the clock during render makes the component
  // impure, and departures shouldn't vanish while someone is mid-booking.
  const [now] = useState(() => Date.now());
  const openDepartures = useMemo(() => upcomingDepartures(trip, now), [trip, now]);
  const selectedDepartureId = selectedDate
    ? openDepartures.find((departure) => departureDateKey(departure.startDate) === selectedDate)?.id ?? departureId
    : departureId;
  const selected = openDepartures.find((d) => d.id === selectedDepartureId && availability(d).selectable) ?? null;
  const selectedWeatherDate = selected ? departureDateKey(selected.startDate) : selectedDate ?? null;
  const { data: bookingWeather } = useTripWeather(trip.slug, selectedWeatherDate);
  const options = selected ? datePriceOptions(trip, selected) : [];
  const choiceOptions = options.filter((option) => option.hotel || option.packageId || options.length > 1)
    .sort((a, b) => (a.adult ?? Number.POSITIVE_INFINITY) - (b.adult ?? Number.POSITIVE_INFINITY));
  const option = choiceOptions.find((item) => item.key === selectedOptionKey) ?? choiceOptions[0] ?? options[0] ?? null;
  const packageChoices = priceDimensionOptions(choiceOptions, "package", option);
  const hotelChoices = priceDimensionOptions(choiceOptions, "hotel", option);
  const quoteOnly = hasVariablePricing(trip);
  const prices = resolvePrices(trip, selected);
  const ageBands = ageBandsFor(trip.sourceMetadata);
  const childFareLabel = passengerFareLabel(trip.sourceMetadata, "child", prices.child);
  const infantFareLabel = passengerFareLabel(trip.sourceMetadata, "infant", prices.infant);
  const total = lineTotal({ adults, children, infants }, prices);
  const specialTiers = option?.passengers ?? [];
  // A detailed passenger tier is an offer that needs a human quote until the
  // booking API accepts each individual age band. Never collapse it into the
  // old generic child/infant counters: that hides valid prices such as 2-5.
  const missingMinorFare = hasMissingPassengerFare({ children, infants }, prices);
  const requiresQuote = quoteOnly || specialTiers.length > 0 || missingMinorFare;
  const tierKey = (item: typeof specialTiers[number]) => `${item.label}|${item.ageRange}`;
  const tierTotal = specialTiers.reduce((sum, item) => sum + (tierCounts[tierKey(item)] || 0) * (item.price || 0), 0);
  const missingTierPrice = specialTiers.some((item) => (tierCounts[tierKey(item)] || 0) > 0 && item.price == null);
  const quoteMin = missingTierPrice || missingMinorFare ? null : adults * (option?.adult ?? prices.adult) + tierTotal;
  const quoteMax = option?.adultMax != null ? adults * option.adultMax + tierTotal : quoteMin;
  const saleLabel = saleBadgeLabel(trip);
  const adultHint = option?.adultMax != null && option.adultMax > (option.adult ?? 0)
    ? [ageBands.adult, `${formatAdultOption(option)} / хүн`].filter(Boolean).join(" · ")
    : pricedHint(ageBands.adult, option?.adult ?? prices.adult);
  const fromPrice = startingPrice(trip, now);
  const multiplePrices = fromPrice !== trip.price || new Set(openDepartures.filter((d) => availability(d).selectable).map((d) => d.price ?? trip.price)).size > 1;

  const errors = {
    firstName: nameError(firstName),
    phone: phoneError(phone),
    email: emailError(email),
  };
  const visibleError = (key: keyof typeof errors) => (showErrors ? errors[key] : null);

  const breakdown = [
    { label: "Том хүн", count: adults, fare: fareFor("adult", prices) },
    ...(children > 0 ? [{ label: "Хүүхэд", count: children, fare: fareFor("child", prices) }] : []),
    ...(infants > 0 ? [{ label: "Нярай", count: infants, fare: fareFor("infant", prices) }] : []),
  ];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (errors.firstName || errors.phone || errors.email) {
      setShowErrors(true);
      const first = errors.firstName ? "first" : errors.phone ? "phone" : "email";
      document.getElementById(fieldId(first))?.focus();
      return;
    }

    await run(async () => {
      try {
        const { data } = await api.post<BookingResult>("/bookings", {
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
          website,
          source: typeof window !== "undefined" ? window.location.pathname : undefined,
          visitorId: getVisitorId(),
        });

        track("booking_submit", { tripId: trip.id, properties: { duplicate: data.duplicate } });
        setResult(data);
        setStep("done");
      } catch (err) {
        toast.error(apiErrorMessage(err, "Захиалга илгээхэд алдаа гарлаа. Дахин оролдоно уу."));
      }
    });
  }

  if (step === "done" && result) {
    const phoneChannel = channel("phone");
    return (
      <div ref={revealConfirmation} className="scroll-mt-24 rounded-xl border border-border bg-card p-6 shadow-panel">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
          <Check className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 tabIndex={-1} className="display-3 mt-5 text-foreground focus:outline-none">{result.duplicate ? "Энэ захиалга аль хэдийн илгээгдсэн" : "Захиалгыг хүлээн авлаа"}</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          {result.holdExpiresAt
            ? `Суудал ${ulaanbaatarTime(result.holdExpiresAt)} цаг хүртэл таны нэр дээр түр хадгалагдана.`
            : "Захиалгын дугаараа хадгалаарай."}{" "}
          Захиалга ажилтан баталгаажуулсны дараа хүчинтэй болно.
        </p>

        <div className="mt-5 rounded-lg bg-secondary/80 p-4">
          <div className="text-[12px] text-muted-foreground">Захиалгын дугаар</div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="text-[1.6rem] font-bold tracking-[0.08em] text-foreground">{result.reference}</span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(result.reference);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  toast.error("Хуулж чадсангүй");
                }
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[12px] font-semibold text-foreground focus-ring"
            >
              {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
              {copied ? "Хуулсан" : "Хуулах"}
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-[14px]">
            <span className="text-muted-foreground">Нийт дүн</span>
            <span className="font-bold tabular-nums text-foreground">{formatMnt(result.totalPrice)}</span>
          </div>
        </div>

        <h3 className="mt-6 text-[13px] font-semibold uppercase tracking-[0.14em] text-foreground">Дараа нь юу болох вэ</h3>
        <ol className="mt-3 space-y-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
          <li className="flex gap-3"><span className="font-semibold text-gold-text">1</span>Манай ажилтан ажлын цагаар тантай холбогдоно.</li>
          <li className="flex gap-3"><span className="font-semibold text-gold-text">2</span>Хүний тоо, нөхцөл, төлбөрийн мэдээллийг тантай тохирно.</li>
          <li className="flex gap-3"><span className="font-semibold text-gold-text">3</span>Төлбөр төлөгдсөний дараа захиалга баталгаажна.</li>
        </ol>

        {paidViaQpay ? (
          <div className="mt-5"><QpayPaidBadge /></div>
        ) : (
          <div className="mt-5 space-y-3">
            {result.payment.qpay && <QpayPayButton reference={result.reference} onPaid={() => setPaidViaQpay(true)} />}
            {result.payment.bankDetails ? (
              <div className="whitespace-pre-line rounded-lg border border-gold/40 bg-gold/10 p-4 text-[13px] leading-relaxed text-foreground">
                <div className="font-semibold">Банкаар шилжүүлэх бол</div>
                {result.payment.bankDetails}
                <div className="mt-2 text-muted-foreground">Гүйлгээний утга: {result.reference}</div>
              </div>
            ) : (
              <p className="rounded-lg bg-secondary/70 p-3.5 text-[13px] leading-relaxed text-muted-foreground">
                Төлбөрийн мэдээллийг ажилтан тантай холбогдохдоо хэлнэ. Одоо юу ч төлөх шаардлагагүй.
              </p>
            )}
          </div>
        )}

        <div className="mt-5 grid gap-2">
          <Link
            href={canonicalPath(`/booking/${result.reference}`)}
            className="flex h-11 items-center justify-center rounded-full bg-primary text-[14px] font-semibold text-primary-foreground focus-ring"
          >
            Захиалгаа харах
          </Link>
          {phoneChannel && (
            <ChannelLink channelKey="phone" tripId={trip.id} from="booking-done" className="flex h-11 items-center justify-center rounded-full border border-border text-[14px] font-semibold text-foreground focus-ring">
              Одоо залгах · {phoneChannel.value}
            </ChannelLink>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-panel sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-text">{requiresQuote ? "Үнийн санал" : "Онлайн захиалга"}</p>
          {option?.packageId && (
            <div className="mt-2 inline-flex rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground">{option.packageId}</div>
          )}
          {/* Without a chosen date this is the cheapest bookable fare, said so
              out loud: quoting the base fare showed 4,590,000₮ on a trip whose
              every open date cost 4,790,000₮. */}
          <div className="mt-2 text-[1.7rem] font-bold leading-none tabular-nums text-foreground">
            {requiresQuote && option ? formatAdultOption(option) : formatMnt(selected ? prices.adult : fromPrice)}
          </div>
          <div className="mt-1.5 text-[12.5px] text-muted-foreground">
            {requiresQuote
              ? "нэг том хүний үнэ"
              : selected
                ? `нэг том хүн · ${formatDepartureDate(selected.startDate)}-ний үнэ`
                : multiplePrices ? "нэг том хүн · хамгийн хямд огноо" : "нэг том хүн"}
          </div>
        </div>
        {saleLabel && (
          <span className="shrink-0 rounded-full bg-destructive px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">{saleLabel}</span>
        )}
      </div>

      {!requiresQuote && (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-3 text-[12.5px]">
          <dt className="text-muted-foreground">Хүүхэд{ageBands.child ? ` (${ageBands.child})` : ""}</dt>
          <dd className="text-right font-semibold text-foreground">{childFareLabel}</dd>
          <dt className="text-muted-foreground">Нярай{ageBands.infant ? ` (${ageBands.infant})` : ""}</dt>
          <dd className="text-right font-semibold text-foreground">{infantFareLabel}</dd>
          {option?.singleSupplement != null && (
            <>
              <dt className="text-muted-foreground">Ганц хүний өрөө</dt>
              <dd className="text-right font-semibold text-foreground">+{formatMnt(option.singleSupplement)}</dd>
            </>
          )}
        </dl>
      )}

      {step !== "done" && <StepIndicator step={step} />}

      {step === "select" && (
        <div className="mt-5">
          <DepartureDatePicker key={selectedDepartureId ?? "no-departure"} departures={openDepartures} selectedId={selectedDepartureId} basePrice={trip.price}
            onSelect={(departure) => {
              setDepartureId(departure.id);
              onDepartureChange(departureDateKey(departure.startDate));
              setSelectedOptionKey("");
              setTierCounts({});
              track("departure_select", { tripId: trip.id, properties: { departureId: departure.id } });
            }} />

          {bookingWeather && <BookingWeatherSummary report={bookingWeather} />}

          {packageChoices.length > 1 && <div className="mt-5 border-t border-border pt-4">
            <h3 className="text-[13px] font-semibold text-foreground">Багц</h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {packageChoices.map((item) => <button key={item.id} type="button" aria-pressed={option?.packageId === item.id}
                onClick={() => { setSelectedOptionKey(item.optionKey); setTierCounts({}); }}
                className={cn("rounded-lg border px-3 py-3 text-left transition-colors focus-ring", option?.packageId === item.id ? "border-primary bg-primary/5" : "border-border hover:border-foreground/35")}>
                <span className="block text-[13px] font-semibold text-foreground">{item.label}</span>
                <span className="mt-1 block text-[12px] text-muted-foreground">{formatPriceDelta(item)}</span>
              </button>)}
            </div>
          </div>}

          {hotelChoices.length > 1 && <div className="mt-5 border-t border-border pt-4">
            <h3 className="text-[13px] font-semibold text-foreground">Буудал</h3>
            <div className="mt-2 space-y-1.5">
              {hotelChoices.map((item) => <button key={item.id} type="button" aria-pressed={option?.hotel === item.id}
                onClick={() => { setSelectedOptionKey(item.optionKey); setTierCounts({}); }}
                className={cn("w-full rounded-lg border px-3 py-2.5 text-left transition-colors focus-ring", option?.hotel === item.id ? "border-primary bg-primary/5" : "border-border hover:border-foreground/35")}>
                <span className="flex items-center justify-between gap-2">
                  <span className="min-w-0 text-[13px] font-semibold text-foreground">{item.label}</span>
                  <span className="shrink-0 text-[12px] font-bold tabular-nums text-foreground">{formatPriceDelta(item)}</span>
                </span>
              </button>)}
            </div>
          </div>}

          <div className="mt-5 divide-y divide-border border-t border-border">
            <Counter label="Том хүн" hint={adultHint} value={adults} onChange={setAdults} min={1} />
            {requiresQuote && specialTiers.length > 0 ? specialTiers.map((item) =>
              <Counter key={tierKey(item)} label={item.label} hint={[item.ageRange, item.price === 0 ? "Үнэгүй" : !hasKnownTripPrice(item.price) ? "Үнэ лавлах" : formatMnt(item.price)].filter(Boolean).join(" · ")}
                value={tierCounts[tierKey(item)] || 0} onChange={(value) => setTierCounts((current) => ({ ...current, [tierKey(item)]: value }))} />
            ) : <>
              <Counter label="Хүүхэд" hint={[ageBands.child, childFareLabel].filter(Boolean).join(" · ")} value={children} onChange={setChildren} />
              <Counter label="Нярай" hint={[ageBands.infant, infantFareLabel].filter(Boolean).join(" · ")} value={infants} onChange={setInfants} />
            </>}
          </div>

          <div className="mt-2 rounded-lg bg-secondary/70 p-4">
            {requiresQuote ? (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] text-muted-foreground">Тооцоолсон үнэ</span>
                  <span className="text-[17px] font-bold tabular-nums text-foreground">
                    {quoteMin == null ? "Үнэ лавлах" : quoteMax != null && quoteMax > quoteMin ? `${formatMnt(quoteMin)}–${formatMnt(quoteMax)}` : formatMnt(quoteMin)}
                  </span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                  Энэ аяллын үнэ {quoteOnly ? "буудал, багц, огнооноос" : "насны ангиллаас"} хамаарна. Эцсийн үнэ, өрөөний сонголтыг ажилтан баталгаажуулна.
                </p>
              </>
            ) : selected ? (
              <>
                <ul className="space-y-1.5 text-[13px]">
                  {breakdown.map((line) => (
                    <li key={line.label} className="flex items-baseline justify-between gap-3">
                      <span className="text-muted-foreground">
                        {line.label} {line.count} × {line.fare === 0 ? "Үнэгүй" : formatMnt(line.fare)}
                      </span>
                      <span className="tabular-nums text-foreground">{line.fare === 0 ? "0₮" : formatMnt(line.count * line.fare)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-3">
                  <span className="text-[13px] font-semibold text-foreground">Нийт дүн</span>
                  <span className="text-[1.25rem] font-bold tabular-nums text-foreground">{formatMnt(total)}</span>
                </div>
              </>
            ) : (
              <p className="text-[13px] text-muted-foreground">Огноогоо сонгоход тухайн өдрийн үнээр нийт дүн бодогдоно.</p>
            )}
          </div>

          <button
            type="button"
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gold text-[15px] font-semibold text-navy-night transition-colors hover:bg-[hsl(41_88%_55%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!selected}
            onClick={() => {
              if (requiresQuote && selected) {
                const counts = specialTiers.map((item) => `${item.label}: ${tierCounts[tierKey(item)] || 0}`).join(", ");
                onAsk({ departureId: selected.id, adults,
                  children: specialTiers.length > 0 ? specialTiers.filter((item) => !/нярай|infant/i.test(item.label)).reduce((sum, item) => sum + (tierCounts[tierKey(item)] || 0), 0) : children,
                  infants: specialTiers.length > 0 ? specialTiers.filter((item) => /нярай|infant/i.test(item.label)).reduce((sum, item) => sum + (tierCounts[tierKey(item)] || 0), 0) : infants,
                  message: [
                    option?.hotel ? `Буудал: ${option.hotel}` : "",
                    option?.packageId ? `Аяллын төрөл: ${option.packageId}` : "",
                    missingMinorFare ? "Хүүхэд/нярайн үнийг ажилтнаас тодруулна" : "",
                    counts,
                  ].filter(Boolean).join("; ") });
              } else {
                setStep("details");
                track("booking_start", { tripId: trip.id });
              }
            }}
          >
            {selected ? requiresQuote ? "Үнийн санал авах" : "Үргэлжлүүлэх" : "Огноогоо сонгоно уу"}
          </button>
          <p className="mt-2.5 text-center text-[12px] text-muted-foreground">Энэ алхамд мөнгө төлөхгүй.</p>
        </div>
      )}

      {step === "details" && selected && (
        <form onSubmit={submit} noValidate className="relative mt-5">
          <button
            type="button"
            onClick={() => setStep("select")}
            className="inline-flex items-center gap-1.5 rounded-sm text-[13px] font-semibold text-muted-foreground hover:text-foreground focus-ring"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Огноо, хүн солих
          </button>

          <div className="mt-3 rounded-lg bg-secondary/70 p-4 text-[13px]">
            <p className="line-clamp-2 font-semibold text-foreground">{formatTripTitle(trip.title)}</p>
            <p className="mt-1 text-muted-foreground">{formatRange(selected)}</p>
            <p className="mt-0.5 text-muted-foreground">
              {adults} том хүн{children > 0 && `, ${children} хүүхэд`}{infants > 0 && `, ${infants} нярай`}
            </p>
            <p className="mt-2 flex items-baseline justify-between border-t border-border pt-2">
              <span className="font-semibold text-foreground">Нийт дүн</span>
              <span className="text-[16px] font-bold tabular-nums text-foreground">{formatMnt(total)}</span>
            </p>
          </div>

          <div className="mt-5 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id={fieldId("first")} label="Нэр" required error={visibleError("firstName")}>
                {(props) => <input {...props} value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" className={inputClass} />}
              </FormField>
              <FormField id={fieldId("last")} label="Овог">
                {(props) => <input {...props} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" className={inputClass} />}
              </FormField>
            </div>
            <FormField id={fieldId("phone")} label="Утасны дугаар" required error={visibleError("phone")} hint="Ажилтан энэ дугаараар холбогдоно.">
              {(props) => (
                <input
                  {...props}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                  placeholder="9911 2233"
                  className={inputClass}
                />
              )}
            </FormField>
            <FormField id={fieldId("email")} label="И-мэйл" error={visibleError("email")} hint="Захиалгын дугаар, мэдээллийг и-мэйлээр илгээнэ.">
              {(props) => <input {...props} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />}
            </FormField>
            <FormField id={fieldId("notes")} label="Нэмэлт хүсэлт">
              {(props) => (
                <textarea
                  {...props}
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Өрөөний хүсэлт, хүүхдийн нас гэх мэт"
                  className={cn(inputClass, "h-auto py-3")}
                />
              )}
            </FormField>
          </div>
          <Honeypot value={website} onChange={setWebsite} />

          <p className="mt-5 flex gap-2.5 rounded-lg border border-border p-3.5 text-[12.5px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            <span>
              Илгээсний дараа суудал 60 минут таны нэр дээр түр хадгалагдана. Одоо мөнгө төлөхгүй — ажилтан холбогдож захиалгыг баталгаажуулна.
              Таны мэдээллийг зөвхөн энэ захиалгын талаар холбогдоход ашиглана (<Link href={canonicalPath("/terms")} className="underline underline-offset-2 hover:text-foreground">нөхцөл</Link>).
            </span>
          </p>

          <button
            type="submit"
            disabled={busy}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gold text-[15px] font-semibold text-navy-night transition-colors hover:bg-[hsl(41_88%_55%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? "Илгээж байна…" : "Захиалга илгээх"}
          </button>
        </form>
      )}
    </div>
  );
}
