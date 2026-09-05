"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  Facebook,
  Loader2,
  MessageCircle,
  Minus,
  Phone,
  Plus,
  Users,
} from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { CONTACT, hasLink } from "@/lib/contact";
import { getVisitorId, track } from "@/lib/analytics";
import { formatFare, formatMnt, formatTripStartingPrice, hasKnownTripPrice, lineTotal, resolvePrices } from "@/lib/pricing";
import { availability, upcomingDepartures } from "@/lib/departures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Departure, Trip } from "@/types/trip";
import { cn } from "@/lib/utils";

function formatRange(departure: Departure) {
  const start = new Date(departure.startDate);
  const startText = start.toLocaleDateString("mn-MN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (!departure.endDate) return startText;

  const end = new Date(departure.endDate);
  return `${startText} — ${end.toLocaleDateString("mn-MN", { month: "long", day: "numeric" })}`;
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
export default function EnquiryPanel({ trip }: { trip: Trip }) {
  const [departureId, setDepartureId] = useState<string | null>(null);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);

  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const [busy, setBusy] = useState(false);
  const [sentReference, setSentReference] = useState<string | null>(null);

  // Frozen at mount: reading the clock during render makes the component
  // impure, and departures shouldn't vanish while someone is filling the form.
  const [now] = useState(() => Date.now());

  const openDepartures = useMemo(() => upcomingDepartures(trip, now), [trip, now]);

  const selected = openDepartures.find((departure) => departure.id === departureId) ?? null;
  const prices = resolvePrices(trip, selected);
  const estimate = lineTotal({ adults, children, infants }, prices);
  const hasPrice = hasKnownTripPrice(prices.adult);

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
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-end justify-between">
        <div>
          {hasKnownTripPrice(trip.price) && trip.oldPrice && trip.oldPrice > trip.price && (
            <div className="text-sm text-muted-foreground line-through">
              {formatMnt(trip.oldPrice)}
            </div>
          )}
          <div className="text-2xl font-bold text-primary">{formatTripStartingPrice(prices.adult)}</div>
          <div className="text-xs text-muted-foreground">
            {hasPrice ? "нэг том хүн" : "ажилтнаас тодруулна"}
          </div>
        </div>
        {typeof trip.discount === "number" && trip.discount > 0 && (
          <span className="rounded-full bg-destructive px-2.5 py-1 text-xs font-bold text-destructive-foreground">
            -{trip.discount}%
          </span>
        )}
      </div>

      <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
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
      </div>
      {trip.excluded.length > 0 && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Дээрх үнэнд юу ороогүйг доорх &ldquo;Багцад ороогүй&rdquo; жагсаалтаас нягтална уу — виз, хувийн зардал зэрэг зарим зүйл ихэвчлэн үнэд ороогүй байдаг.
        </p>
      )}

      <form onSubmit={submit} className="mt-5">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarDays className="h-4 w-4 text-primary" />
          Хөдлөх огноо
        </div>

        {openDepartures.length === 0 ? (
          <p className="mt-2 rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
            Тогтсон огноо байхгүй. Хүссэн өдрөө доор бичвэл бид тохируулж өгнө.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {openDepartures.map((departure) => {
              const seats = availability(departure);
              const soldOut = !seats.selectable;
              const active = departure.id === departureId;

              return (
                <button
                  key={departure.id}
                  type="button"
                  disabled={soldOut}
                  onClick={() => {
                    const next = active ? null : departure.id;
                    setDepartureId(next);
                    if (next) track("departure_select", { tripId: trip.id, properties: { departureId: next } });
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors",
                    active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                    soldOut && "cursor-not-allowed opacity-50",
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{formatRange(departure)}</div>
                    <div
                      className={cn(
                        "mt-0.5 flex items-center gap-1 text-xs text-muted-foreground",
                        seats.tone === "tight" && "font-semibold text-destructive",
                      )}
                    >
                      <Users className="h-3 w-3" />
                      {seats.label}
                    </div>
                  </div>
                  {departure.price != null && departure.price !== trip.price && (
                    <span className="shrink-0 text-sm font-semibold text-primary">
                      {formatMnt(departure.price)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4 divide-y divide-border border-t border-border">
          <Counter label="Том хүн" hint="12+ нас" value={adults} onChange={setAdults} min={1} />
          <Counter label="Хүүхэд" hint="2-11 нас" value={children} onChange={setChildren} />
          <Counter label="Нярай" hint="0-2 нас" value={infants} onChange={setInfants} />
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">Ойролцоо дүн</span>
          <span className="text-xl font-bold text-primary">{hasPrice ? formatMnt(estimate) : "Үнэ лавлах"}</span>
        </div>
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
