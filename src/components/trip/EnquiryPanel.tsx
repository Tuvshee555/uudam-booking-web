"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Loader2, ShieldCheck } from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { getVisitorId, track } from "@/lib/analytics";
import { ageBandsFor, formatMnt, formatTripStartingPrice, hasKnownTripPrice, hasMissingPassengerFare, lineTotal, passengerFareLabel, resolvePrices } from "@/lib/pricing";
import { availability, upcomingDepartures } from "@/lib/departures";
import { saleBadgeLabel } from "@/lib/tripMarketing";
import { datePriceOptions, formatAdultOption } from "@/lib/tripPriceOptions";
import { formatPhoneInput, nameError, phoneError } from "@/lib/formValidation";
import { canonicalPath } from "@/lib/locales";
import { channel } from "@/lib/channels";
import DepartureDatePicker from "./DepartureDatePicker";
import { Counter } from "./BookingPanel";
import { departureDateKey } from "@/lib/departureDate";
import FormField, { inputClass, revealConfirmation, useSubmitGuard } from "@/components/site/FormField";
import Honeypot from "@/components/site/Honeypot";
import { ChannelLink } from "@/components/site/channels";
import { cn } from "@/lib/utils";
import type { Trip } from "@/types/trip";

function pricedHint(age: string, price: number | null | undefined) {
  return [age, !hasKnownTripPrice(price) ? "Үнэ лавлах" : formatMnt(price)].filter(Boolean).join(" · ");
}

/**
 * "Ask a person": who, which trip, when, how many — enough for a good call
 * back, and never presented as a booking. The estimate is labelled as one.
 */
export default function EnquiryPanel({ trip, initialSelection, variablePricing = false, selectedDate, onDepartureChange }: {
  trip: Trip;
  selectedDate?: string;
  onDepartureChange: (date: string) => void;
  initialSelection?: { departureId: string; message: string; adults: number; children: number; infants: number } | null;
  variablePricing?: boolean;
}) {
  // The page mounts one panel for phones and one for the desktop column.
  const uid = useId();
  const fieldId = (name: string) => `${uid}-enq-${name}`;
  const [departureId, setDepartureId] = useState<string | null>(initialSelection?.departureId ??
    trip.departures.find((departure) => departureDateKey(departure.startDate) === selectedDate)?.id ?? null);
  const [adults, setAdults] = useState(initialSelection?.adults ?? 2);
  const [children, setChildren] = useState(initialSelection?.children ?? 0);
  const [infants, setInfants] = useState(initialSelection?.infants ?? 0);

  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(initialSelection?.message ?? "");
  const [website, setWebsite] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const { busy, run } = useSubmitGuard();
  const [sentReference, setSentReference] = useState<string | null>(null);

  // Frozen at mount: reading the clock during render makes the component
  // impure, and departures shouldn't vanish while someone is filling the form.
  const [now] = useState(() => Date.now());

  const openDepartures = useMemo(() => upcomingDepartures(trip, now), [trip, now]);
  const selectedDepartureId = selectedDate
    ? openDepartures.find((departure) => departureDateKey(departure.startDate) === selectedDate)?.id ?? departureId
    : departureId;
  const selected = openDepartures.find((departure) => departure.id === selectedDepartureId && availability(departure).selectable) ?? null;
  const prices = resolvePrices(trip, selected);
  const options = selected ? datePriceOptions(trip, selected) : [];
  const selectedHotel = initialSelection?.message.match(/Буудал: ([^;]+)/)?.[1];
  const selectedPackage = initialSelection?.message.match(/Аяллын төрөл: ([^;]+)/)?.[1];
  // The hotel AND package the visitor chose; one of them alone only when that is all they picked.
  const option = options.find((item) => (!selectedHotel || item.hotel === selectedHotel) && (!selectedPackage || item.packageId === selectedPackage) && Boolean(selectedHotel || selectedPackage))
    ?? options.find((item) => item.hotel === selectedHotel || item.packageId === selectedPackage) ?? options[0];
  const optionPrices = options.flatMap((item) => [item.adult, item.adultMax].filter((value): value is number => value != null));
  const optionLabel = (selectedHotel || selectedPackage) && option ? formatAdultOption(option)
    : optionPrices.length > 1 ? `${formatMnt(Math.min(...optionPrices))}–${formatMnt(Math.max(...optionPrices))}`
    : option ? formatAdultOption(option) : "Үнэ огноо, буудлаас хамаарна";
  const ageBands = ageBandsFor(trip.sourceMetadata);
  const childFareLabel = passengerFareLabel(trip.sourceMetadata, "child", option?.child ?? prices.child);
  const infantFareLabel = passengerFareLabel(trip.sourceMetadata, "infant", option?.infant ?? prices.infant);
  const estimate = hasMissingPassengerFare({ children, infants }, prices)
    ? null : lineTotal({ adults, children, infants }, prices);
  const hasPrice = hasKnownTripPrice(prices.adult);
  const saleLabel = saleBadgeLabel(trip);
  const adultHint = option?.adultMax != null && option.adultMax > (option.adult ?? 0)
    ? [ageBands.adult, `${formatAdultOption(option)} / хүн`].filter(Boolean).join(" · ")
    : pricedHint(ageBands.adult, option?.adult ?? prices.adult);

  const errors = { firstName: nameError(firstName), phone: phoneError(phone) };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (errors.firstName || errors.phone) {
      setShowErrors(true);
      document.getElementById(fieldId(errors.firstName ? "name" : "phone"))?.focus();
      return;
    }

    await run(async () => {
      try {
        const { data } = await api.post("/enquiries", {
          tripId: trip.id,
          departureId: selected?.id ?? null,
          firstName: firstName.trim(),
          phone: phone.trim(),
          adults,
          children,
          infants,
          message: message.trim() || undefined,
          website,
          source: typeof window !== "undefined" ? window.location.pathname : undefined,
          // Ties the lead back to its page views, so the admin can see how many
          // people looked at this trip for every one who actually called.
          visitorId: getVisitorId(),
          referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
        });
        track("enquiry_submit", { tripId: trip.id });
        setSentReference(data.reference);
      } catch (err) {
        toast.error(apiErrorMessage(err, "Илгээхэд алдаа гарлаа. Дахин оролдоно уу."));
      }
    });
  };

  if (sentReference) {
    const phoneChannel = channel("phone");
    return (
      <div ref={revealConfirmation} className="scroll-mt-24 rounded-xl border border-border bg-card p-6 shadow-panel">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
          <Check className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 tabIndex={-1} className="display-3 mt-5 text-foreground focus:outline-none">Хүсэлт илгээгдлээ</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          Манай ажилтан ажлын цагаар тантай холбогдож огноо, үнэ, нөхцөлийг тодруулна. Энэ нь захиалга биш — суудал ажилтантай ярьсны дараа баталгаажна.
        </p>
        <div className="mt-5 rounded-lg bg-secondary/80 p-4">
          <div className="text-[12px] text-muted-foreground">Хүсэлтийн дугаар</div>
          <div className="mt-1 text-[1.5rem] font-bold tracking-[0.08em] text-foreground">{sentReference}</div>
        </div>
        <div className="mt-5 grid gap-2">
          {phoneChannel && (
            <ChannelLink channelKey="phone" tripId={trip.id} from="enquiry-done" className="flex h-11 items-center justify-center rounded-full bg-primary text-[14px] font-semibold text-primary-foreground focus-ring">
              Одоо залгах · {phoneChannel.value}
            </ChannelLink>
          )}
          <ChannelLink channelKey="messenger" tripId={trip.id} from="enquiry-done" className="flex h-11 items-center justify-center rounded-full border border-border text-[14px] font-semibold text-foreground focus-ring">
            Messenger-ээр бичих
          </ChannelLink>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-panel sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-text">Ажилтанд хүсэлт</p>
          {hasKnownTripPrice(trip.price) && trip.oldPrice && trip.oldPrice > trip.price && (
            <div className="mt-2 text-[13px] text-muted-foreground line-through">{formatMnt(trip.oldPrice)}</div>
          )}
          {option?.packageId && (
            <div className="mt-2 inline-flex rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground">{option.packageLabel || option.packageId}</div>
          )}
          <div className="mt-2 text-[1.6rem] font-bold leading-none tabular-nums text-foreground">
            {variablePricing ? optionLabel : formatTripStartingPrice(prices.adult)}
          </div>
          <div className="mt-1.5 text-[12.5px] text-muted-foreground">
            {variablePricing ? "нэг том хүний үнэ" : hasPrice ? "нэг том хүн" : "ажилтнаас тодруулна"}
          </div>
        </div>
        {saleLabel && <span className="shrink-0 rounded-full bg-destructive px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">{saleLabel}</span>}
      </div>

      {!variablePricing && (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-3 text-[12.5px]">
          <dt className="text-muted-foreground">Хүүхэд{ageBands.child ? ` (${ageBands.child})` : ""}</dt>
          <dd className="text-right font-semibold text-foreground">{childFareLabel}</dd>
          <dt className="text-muted-foreground">Нярай{ageBands.infant ? ` (${ageBands.infant})` : ""}</dt>
          <dd className="text-right font-semibold text-foreground">{infantFareLabel}</dd>
          {typeof trip.singleSupplement === "number" && trip.singleSupplement > 0 && (
            <>
              <dt className="text-muted-foreground">Ганц хүний өрөө</dt>
              <dd className="text-right font-semibold text-foreground">+{formatMnt(trip.singleSupplement)}</dd>
            </>
          )}
        </dl>
      )}
      {variablePricing && option?.singleSupplement != null && (
        <p className="mt-3 flex justify-between gap-3 text-[12.5px] text-muted-foreground">
          <span>Ганц хүний өрөө</span>
          <span className="font-semibold text-foreground">+{formatMnt(option.singleSupplement)}</span>
        </p>
      )}
      {option?.packageId && option.packageNote && (
        <div className="mt-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-primary">Сонгосон аяллын төрөл</div>
          <div className="mt-1 text-[13px] font-semibold text-foreground">{option.packageLabel || option.packageId}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{option.packageNote}</p>
        </div>
      )}

      <form onSubmit={submit} noValidate className="relative mt-5">
        <DepartureDatePicker key={selectedDepartureId ?? "no-departure"} departures={openDepartures} selectedId={selectedDepartureId} basePrice={trip.price}
          onSelect={(departure) => {
            setDepartureId(departure.id);
            onDepartureChange(departureDateKey(departure.startDate));
            if (message === initialSelection?.message) setMessage("");
            track("departure_select", { tripId: trip.id, properties: { departureId: departure.id } });
          }} />

        <div className="mt-5 divide-y divide-border border-t border-border">
          <Counter label="Том хүн" hint={adultHint} value={adults} onChange={setAdults} min={1} />
          <Counter label="Хүүхэд" hint={[ageBands.child, childFareLabel].filter(Boolean).join(" · ")} value={children} onChange={setChildren} />
          <Counter label="Нярай" hint={[ageBands.infant, infantFareLabel].filter(Boolean).join(" · ")} value={infants} onChange={setInfants} />
        </div>

        {!variablePricing && (
          <div className="mt-2 flex items-baseline justify-between gap-3 rounded-lg bg-secondary/70 p-4">
            <span className="text-[13px] text-muted-foreground">Ойролцоо дүн</span>
            <span className="text-[17px] font-bold tabular-nums text-foreground">{hasPrice && estimate !== null ? formatMnt(estimate) : "Үнэ лавлах"}</span>
          </div>
        )}
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">Урьдчилсан тооцоо. Эцсийн үнийг ажилтан тодруулна.</p>

        <div className="mt-5 grid gap-4 border-t border-border pt-5">
          <FormField id={fieldId("name")} label="Таны нэр" required error={showErrors ? errors.firstName : null}>
            {(props) => <input {...props} value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" className={inputClass} />}
          </FormField>
          <FormField id={fieldId("phone")} label="Утасны дугаар" required error={showErrors ? errors.phone : null}>
            {(props) => (
              <input
                {...props}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(formatPhoneInput(event.target.value))}
                placeholder="9911 2233"
                className={inputClass}
              />
            )}
          </FormField>
          <FormField id={fieldId("message")} label="Асуух зүйл">
            {(props) => (
              <textarea
                {...props}
                rows={3}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Хүссэн огноо, асуулт…"
                className={cn(inputClass, "h-auto py-3")}
              />
            )}
          </FormField>
        </div>
        <Honeypot value={website} onChange={setWebsite} />

        <p className="mt-4 flex gap-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          <span>
            Нэр, утсыг зөвхөн энэ хүсэлтийн талаар холбогдоход ашиглана (<Link href={canonicalPath("/terms")} className="underline underline-offset-2 hover:text-foreground">нөхцөл</Link>).
          </span>
        </p>

        <button
          type="submit"
          disabled={busy}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-ring disabled:cursor-wait disabled:opacity-70"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {busy ? "Илгээж байна…" : "Хүсэлт илгээх"}
        </button>
      </form>
    </div>
  );
}
