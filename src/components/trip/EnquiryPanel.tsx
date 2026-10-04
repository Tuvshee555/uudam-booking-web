"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Facebook,
  Loader2,
  MessageCircle,
  Minus,
  Phone,
  Plus,
} from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { CONTACT, hasLink } from "@/lib/contact";
import { getVisitorId, track } from "@/lib/analytics";
import { ageBandsFor, formatFare, formatMnt, formatTripStartingPrice, hasKnownTripPrice, lineTotal, resolvePrices } from "@/lib/pricing";
import { availability, upcomingDepartures } from "@/lib/departures";
import { saleBadgeLabel } from "@/lib/tripMarketing";
import { datePriceOptions, formatAdultOption } from "@/lib/tripPriceOptions";
import DepartureDatePicker from "./DepartureDatePicker";
import { departureDateKey } from "@/lib/departureDate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Trip } from "@/types/trip";

function pricedHint(age: string, price: number | null | undefined) {
  return [age, price == null ? "Үнэ лавлах" : formatMnt(price)].filter(Boolean).join(" · ");
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
 * The trip page's conversion panel.
 *
 * The agency sells on the phone, so this collects just enough to make a good
 * call-back — who, what trip, when, how many — and never pretends to be a
 * checkout. The price shown is explicitly an estimate.
 */
export default function EnquiryPanel({ trip, initialSelection, variablePricing = false, selectedDate, onDepartureChange }: {
  trip: Trip;
  selectedDate?: string;
  onDepartureChange: (date: string) => void;
  initialSelection?: { departureId: string; message: string; adults: number; children: number; infants: number } | null;
  variablePricing?: boolean;
}) {
  const [departureId, setDepartureId] = useState<string | null>(initialSelection?.departureId ??
    trip.departures.find((departure) => departureDateKey(departure.startDate) === selectedDate)?.id ?? null);
  const [adults, setAdults] = useState(initialSelection?.adults ?? 2);
  const [children, setChildren] = useState(initialSelection?.children ?? 0);
  const [infants, setInfants] = useState(initialSelection?.infants ?? 0);

  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(initialSelection?.message ?? "");

  const [busy, setBusy] = useState(false);
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
  const option = options.find((item) => item.hotel === selectedHotel || item.packageId === selectedPackage) ?? options[0];
  const optionPrices = options.flatMap((item) => [item.adult, item.adultMax].filter((value): value is number => value != null));
  const optionLabel = (selectedHotel || selectedPackage) && option ? formatAdultOption(option)
    : optionPrices.length > 1 ? `${formatMnt(Math.min(...optionPrices))}–${formatMnt(Math.max(...optionPrices))}`
    : option ? formatAdultOption(option) : "Үнэ огноо, буудлаас хамаарна";
  const ageBands = ageBandsFor(trip.sourceMetadata);
  const estimate = lineTotal({ adults, children, infants }, prices);
  const hasPrice = hasKnownTripPrice(prices.adult);
  const saleLabel = saleBadgeLabel(trip);
  const adultHint = option?.adultMax != null && option.adultMax > (option.adult ?? 0)
    ? [ageBands.adult, `${formatAdultOption(option)} / хүн`].filter(Boolean).join(" · ")
    : pricedHint(ageBands.adult, option?.adult ?? prices.adult);

  const submit = async (event: React.FormEvent) => {
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
      const { data } = await api.post("/enquiries", {
        tripId: trip.id,
        departureId: selected?.id ?? null,
        firstName: firstName.trim(),
        phone: phone.trim(),
        adults,
        children,
        infants,
        message: message.trim() || undefined,
        source: typeof window !== "undefined" ? window.location.pathname : undefined,
        // Ties the lead back to its page views, so the admin can see how many
        // people looked at this trip for every one who actually called.
        visitorId: getVisitorId(),
        referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
      });

      setSentReference(data.reference);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Илгээхэд алдаа гарлаа"));
    } finally {
      setBusy(false);
    }
  };

  if (sentReference) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
          <Check className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-lg font-bold">Хүсэлт илгээгдлээ</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Манай ажилтан удахгүй тантай холбогдоно. Хүсэлтийн дугаар:
        </p>
        <div className="mt-2 text-lg font-bold tracking-wider text-primary">{sentReference}</div>

        <div className="mt-5 grid gap-2">
          {hasLink(CONTACT.phone) && (
            <Button asChild variant="outline">
              <a href={CONTACT.phoneHref} onClick={() => track("phone_click", { tripId: trip.id })}>
                <Phone className="mr-2 h-4 w-4" />
                {CONTACT.phone}
              </a>
            </Button>
          )}
          {hasLink(CONTACT.messenger) && (
            <Button asChild variant="ghost">
              <a
                href={CONTACT.messenger}
                target="_blank"
                rel="noreferrer"
                onClick={() => track("messenger_click", { tripId: trip.id })}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Messenger-ээр бичих
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-end justify-between">
        <div>
          {hasKnownTripPrice(trip.price) && trip.oldPrice && trip.oldPrice > trip.price && (
            <div className="text-sm text-muted-foreground line-through">
              {formatMnt(trip.oldPrice)}
            </div>
          )}
          {option?.packageId && (
            <div className="mb-1 inline-flex rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground">
              {option.packageId}
            </div>
          )}
          <div className="text-xl font-bold text-primary">{variablePricing
            ? optionLabel
            : formatTripStartingPrice(prices.adult)}</div>
          <div className="text-xs text-muted-foreground">
            {variablePricing ? "нэг том хүний үнэ" : hasPrice ? "нэг том хүн" : "ажилтнаас тодруулна"}
          </div>
        </div>
        {saleLabel && (
          <span className="rounded-full bg-destructive px-2.5 py-1 text-xs font-bold text-destructive-foreground">
            {saleLabel}
          </span>
        )}
      </div>

      {!variablePricing && <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Хүүхэд</span>
          <span className="font-medium text-foreground">{formatFare(prices.child)}</span>
        </div>
        <div className="flex justify-between">
          <span>Нярай</span>
          <span className="font-medium text-foreground">{formatFare(prices.infant)}</span>
        </div>
        {typeof trip.singleSupplement === "number" && trip.singleSupplement > 0 && (
          <div className="flex justify-between">
            <span>Ганц хүний өрөөний нэмэгдэл</span>
            <span className="font-medium text-foreground">{formatMnt(trip.singleSupplement)}</span>
          </div>
        )}
      </div>}
      {trip.excluded.length > 0 && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Дээрх үнэнд юу ороогүйг доорх &ldquo;Багцад ороогүй&rdquo; жагсаалтаас нягтална уу — виз, хувийн зардал зэрэг зарим зүйл ихэвчлэн үнэд ороогүй байдаг.
        </p>
      )}
      {option?.packageId && option.packageNote && (
        <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3">
          <div className="text-xs font-bold uppercase tracking-wide text-primary">Сонгосон аяллын төрөл</div>
          <div className="mt-1 text-sm font-semibold">{option.packageId}</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{option.packageNote}</p>
        </div>
      )}

      <form onSubmit={submit} className="mt-5">
        <DepartureDatePicker key={selectedDepartureId ?? "no-departure"} departures={openDepartures} selectedId={selectedDepartureId} basePrice={trip.price}
          onSelect={(departure) => {
            setDepartureId(departure.id);
            onDepartureChange(departureDateKey(departure.startDate));
            if (message === initialSelection?.message) setMessage("");
            track("departure_select", { tripId: trip.id, properties: { departureId: departure.id } });
          }} />

        <div className="mt-4 divide-y divide-border border-t border-border">
          <Counter label="Том хүн" hint={adultHint} value={adults} onChange={setAdults} min={1} />
          <Counter label="Хүүхэд" hint={pricedHint(ageBands.child, option?.child ?? prices.child)} value={children} onChange={setChildren} />
          <Counter label="Нярай" hint={pricedHint(ageBands.infant, option?.infant ?? prices.infant)} value={infants} onChange={setInfants} />
        </div>

        {!variablePricing && <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">Ойролцоо дүн</span>
          <span className="text-xl font-bold text-primary">{hasPrice ? formatMnt(estimate) : "Үнэ лавлах"}</span>
        </div>}
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Урьдчилсан тооцоо. Эцсийн үнийг ажилтан тодруулж хэлнэ.
        </p>

        <div className="mt-5 space-y-3 border-t border-border pt-4">
          <div>
            <Label htmlFor="enq-name">Таны нэр *</Label>
            <Input
              id="enq-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="Болд"
            />
          </div>
          <div>
            <Label htmlFor="enq-phone">Утасны дугаар *</Label>
            <Input
              id="enq-phone"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="9911 2233"
            />
          </div>
          <div>
            <Label htmlFor="enq-message">Нэмэлт мэдээлэл</Label>
            <Input
              id="enq-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Хүссэн огноо, асуулт..."
            />
          </div>
        </div>

        <Button type="submit" size="lg" disabled={busy} className="mt-4 w-full">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Захиалгын хүсэлт илгээх
        </Button>
      </form>

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-center text-xs text-muted-foreground">Эсвэл шууд холбогдоорой</p>
        <div className="mt-2 grid gap-2">
          {hasLink(CONTACT.phone) && (
            <Button asChild variant="outline" className="w-full">
              <a href={CONTACT.phoneHref}>
                <Phone className="mr-2 h-4 w-4" />
                {CONTACT.phone}
              </a>
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            {hasLink(CONTACT.messenger) && (
              <Button asChild variant="ghost" size="sm">
                <a href={CONTACT.messenger} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-1.5 h-4 w-4" />
                  Messenger
                </a>
              </Button>
            )}
            {hasLink(CONTACT.facebook) && (
              <Button asChild variant="ghost" size="sm">
                <a href={CONTACT.facebook} target="_blank" rel="noreferrer">
                  <Facebook className="mr-1.5 h-4 w-4" />
                  Facebook
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
