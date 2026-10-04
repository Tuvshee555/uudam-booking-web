"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, Loader2, Plus, Trash2 } from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { departureDateKey } from "@/lib/departureDate";
import { ageBandsFor } from "@/lib/pricing";
import { isAllowedImageHost } from "@/lib/imageHosts";
import { useCategoryTree, useTags, useTrip } from "@/hooks/useTrips";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CategoryNode, Trip } from "@/types/trip";

import StringListField from "./StringListField";
import ImageUploadField from "./ImageUploadField";
import MultiImageField from "./MultiImageField";
import MediaListEditor from "./MediaListEditor";
import WeatherPlacesEditor from "./WeatherPlacesEditor";
import { parseMediaItems, type MediaItem } from "@/lib/media";
import ItineraryEditor, { type ItineraryDraft } from "./ItineraryEditor";
import DepartureEditor, { type DepartureDraft } from "./DepartureEditor";

function flattenCategories(nodes: CategoryNode[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((node) => [
    { id: node.id, label: `${"— ".repeat(depth)}${node.categoryName}` },
    ...flattenCategories(node.children, depth + 1),
  ]);
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return departureDateKey(iso);
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isInfantLabel(label: string, ageRange: string) {
  const value = `${label} ${ageRange}`.toLowerCase();
  return /нярай|infant|сар|month/.test(value) || /\b0\s*[-–]\s*2\b/.test(value);
}

function passengerRowsFromTrip(trip: Trip): PassengerPriceDraft[] {
  const rows = new Map<string, PassengerPriceDraft>();
  const add = (row: PassengerPriceDraft) => {
    const key = `${row.label.trim().toLowerCase()}|${row.ageRange.trim().toLowerCase()}|${row.price}|${row.free}`;
    if (row.label.trim() || row.ageRange.trim() || row.price.trim() || row.free) rows.set(key, row);
  };

  const groups = Array.isArray(trip.sourceMetadata?.price_groups) ? trip.sourceMetadata.price_groups : [];
  for (const group of groups) {
    const prices = object(group).passenger_prices;
    if (!Array.isArray(prices)) continue;
    for (const item of prices) {
      const row = object(item);
      const note = text(row.note);
      const price = typeof row.price === "number" && Number.isFinite(row.price) ? row.price : null;
      add({
        label: text(row.label) || "Хүүхэд",
        ageRange: text(row.age_range),
        price: price !== null ? String(price) : "",
        free: price === 0 && /үнэгүй|free/i.test(note),
      });
    }
  }

  const ageBands = ageBandsFor(trip.sourceMetadata);
  if (rows.size === 0) {
    if (trip.childPrice !== null) {
      add({ label: "Хүүхэд", ageRange: ageBands.child, price: String(trip.childPrice), free: trip.childPrice === 0 });
    }
    if (trip.infantPrice !== null) {
      add({ label: "Нярай", ageRange: ageBands.infant, price: String(trip.infantPrice), free: trip.infantPrice === 0 });
    }
  }

  return [...rows.values()];
}

function passengerSummary(rows: PassengerPriceDraft[]) {
  const clean = rows
    .map((row) => ({ ...row, amount: row.free ? 0 : numOrUndefined(row.price) }))
    .filter((row) => row.label.trim() || row.ageRange.trim() || row.amount !== undefined);
  const infant = clean.find((row) => row.amount !== undefined && isInfantLabel(row.label, row.ageRange));
  const child = clean.find((row) => row.amount !== undefined && row !== infant);
  return {
    childPrice: child?.amount ?? null,
    infantPrice: infant?.amount ?? null,
    childAge: child?.ageRange.trim() || "",
    infantAge: infant?.ageRange.trim() || "",
  };
}

function cleanPassengerRows(rows: PassengerPriceDraft[]) {
  return rows
    .map((row) => {
      const label = row.label.trim();
      const ageRange = row.ageRange.trim();
      const amount = row.free ? 0 : numOrUndefined(row.price);
      if (!label && !ageRange && amount === undefined) return null;
      return {
        label: label || "Хүүхэд",
        age_range: ageRange,
        price: amount ?? null,
        currency: "MNT",
        ...(row.free ? { note: "Үнэгүй" } : {}),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

function groupDateKeys(group: Record<string, unknown>) {
  const values = [group.date_keys, group.dates, group.display_dates]
    .flatMap((value) => Array.isArray(value) ? value : []);
  return values
    .map((value) => text(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0] || "")
    .filter(Boolean);
}

function datedPassengerFares(metadata: unknown, date: string) {
  const rawGroups = object(metadata).price_groups;
  const groups: Record<string, unknown>[] = Array.isArray(rawGroups) ? rawGroups.map(object) : [];
  const group = groups.find((candidate) => groupDateKeys(candidate).includes(date));
  if (!group) return { child: null as number | null, infant: null as number | null };
  const prices = Array.isArray(group.passenger_prices) ? group.passenger_prices.map(object) : [];
  const fareFor = (infant: boolean, flatFare: unknown) => {
    if (typeof flatFare === "number" && Number.isFinite(flatFare)) return flatFare;
    const row = prices.find((price) => isInfantLabel(text(price.label), text(price.age_range)) === infant);
    return typeof row?.price === "number" && Number.isFinite(row.price) ? row.price : null;
  };
  return { child: fareFor(false, group.child_price), infant: fareFor(true, group.infant_price) };
}

function withPassengerPricingMetadata(form: FormState) {
  const passengerPrices = cleanPassengerRows(form.passengerPrices);
  const summary = passengerSummary(form.passengerPrices);
  const sourceMetadata = object(form.sourceMetadata);
  const existingGroups = Array.isArray(sourceMetadata.price_groups)
    ? sourceMetadata.price_groups.map(object)
    : [];
  const departuresByDate = new Map(form.departures.map((departure) => [departure.startDate, departure]));
  const fallbackGroups: Record<string, unknown>[] = form.departures.length
    ? form.departures.map((departure) => ({
      label: departure.startDate,
      dates: [departure.startDate],
      display_dates: [departure.startDate],
      date_keys: [departure.startDate],
    } as Record<string, unknown>))
    : [{ label: "Үндсэн үнэ", dates: [], display_dates: [], date_keys: [] }];
  const groups = (existingGroups.length ? existingGroups : fallbackGroups).map((group) => {
    const departure = groupDateKeys(group).map((date) => departuresByDate.get(date)).find(Boolean);
    const childPrice = departure ? numOrUndefined(departure.childPrice) : undefined;
    const infantPrice = departure ? numOrUndefined(departure.infantPrice) : undefined;
    const adultPrice = departure ? numOrUndefined(departure.price) : undefined;
    const sourceRows = cleanPassengerRows((Array.isArray(group.passenger_prices) ? group.passenger_prices : [])
      .map((row) => {
        const item = object(row);
        const price = typeof item.price === "number" && Number.isFinite(item.price) ? String(item.price) : "";
        return {
          label: text(item.label) || "Хүүхэд",
          ageRange: text(item.age_range),
          price,
          free: item.price === 0 && /үнэгүй|free/i.test(text(item.note)),
        };
      }));
    const rows = sourceRows.length ? sourceRows : passengerPrices;
    const replaceFare = (isInfant: boolean, fare: number | undefined, ageRange: string) => {
      if (fare === undefined) return;
      const index = rows.findIndex((row) => isInfantLabel(row.label, row.age_range) === isInfant);
      const next = { label: isInfant ? "Нярай" : "Хүүхэд", age_range: ageRange, price: fare, currency: "MNT" };
      if (index >= 0) rows[index] = { ...rows[index], ...next };
      else rows.push(next);
    };
    replaceFare(false, childPrice, summary.childAge || text(group.child_age));
    replaceFare(true, infantPrice, summary.infantAge || text(group.infant_age));

    return {
      ...group,
      adult_price: adultPrice ?? (typeof group.adult_price === "number" ? group.adult_price : (numOrUndefined(form.price) ?? null)),
      passenger_prices: rows,
      child_price: childPrice ?? (typeof group.child_price === "number" ? group.child_price : summary.childPrice),
      child_age: summary.childAge || text(group.child_age),
      infant_price: infantPrice ?? (typeof group.infant_price === "number" ? group.infant_price : summary.infantPrice),
      infant_age: summary.infantAge || text(group.infant_age),
      currency: text(group.currency) || "MNT",
    };
  });

  return {
    ...sourceMetadata,
    age_rules: {
      ...object(sourceMetadata.age_rules),
      adult: form.adultAge.trim(),
      child: summary.childAge,
      infant: summary.infantAge,
    },
    price_groups: groups,
  };
}

type FormState = {
  title: string;
  slug: string;
  summary: string;
  description: string;
  categoryIds: string[];
  tagIds: string[];

  country: string;
  city: string;
  region: string;
  destinations: string[];
  meetingPoint: string;
  mapUrl: string;

  durationDays: string;
  durationNights: string;
  minTravelers: string;
  maxTravelers: string;
  difficulty: string;
  transport: string[];
  languages: string[];
  season: string;

  highlights: string[];
  included: string[];
  excluded: string[];
  requirements: string;
  cancellationPolicy: string;
  importantNotes: string[];

  image: string;
  extraImages: string[];
  video: string;
  videos: string[];

  price: string;
  oldPrice: string;
  discount: string;
  childPrice: string;
  infantPrice: string;
  singleSupplement: string;
  adultAge: string;
  passengerPrices: PassengerPriceDraft[];
  sourceMetadata: Record<string, unknown>;

  sourceTripId: string;
  hotel: string;
  foodIncluded: string;
  departureRule: string;
  extraFees: string[];
  roomPrices: string[];
  childPriceNotes: string[];
  brochurePdfUrl: string;
  hotelMedia: MediaItem[];
  travelerMedia: MediaItem[];

  isFeatured: boolean;
  isPublished: boolean;

  itinerary: ItineraryDraft[];
  departures: DepartureDraft[];
};

type PassengerPriceDraft = {
  label: string;
  ageRange: string;
  price: string;
  free: boolean;
};

const EMPTY_FORM: FormState = {
  title: "",
  slug: "",
  summary: "",
  description: "",
  categoryIds: [],
  tagIds: [],
  country: "",
  city: "",
  region: "",
  destinations: [],
  meetingPoint: "",
  mapUrl: "",
  durationDays: "1",
  durationNights: "0",
  minTravelers: "1",
  maxTravelers: "",
  difficulty: "EASY",
  transport: [],
  languages: [],
  season: "",
  highlights: [],
  included: [],
  excluded: [],
  requirements: "",
  cancellationPolicy: "",
  importantNotes: [],
  image: "",
  extraImages: [],
  video: "",
  videos: [],
  price: "",
  oldPrice: "",
  discount: "",
  childPrice: "",
  infantPrice: "",
  singleSupplement: "",
  adultAge: "12+ нас",
  passengerPrices: [],
  sourceMetadata: {},
  sourceTripId: "",
  hotel: "",
  foodIncluded: "",
  departureRule: "",
  extraFees: [],
  roomPrices: [],
  childPriceNotes: [],
  brochurePdfUrl: "",
  hotelMedia: [],
  travelerMedia: [],
  isFeatured: false,
  isPublished: true,
  itinerary: [],
  departures: [],
};

function tripToForm(trip: Trip): FormState {
  const ageBands = ageBandsFor(trip.sourceMetadata);
  return {
    title: trip.title,
    slug: trip.slug,
    summary: trip.summary ?? "",
    description: trip.description,
    categoryIds: trip.categories.length > 0
      ? trip.categories.map((category) => category.id)
      : trip.categoryId ? [trip.categoryId] : [],
    tagIds: trip.tags.map((tag) => tag.id),
    country: trip.country ?? "",
    city: trip.city ?? "",
    region: trip.region ?? "",
    destinations: trip.destinations,
    meetingPoint: trip.meetingPoint ?? "",
    mapUrl: trip.mapUrl ?? "",
    durationDays: String(trip.durationDays),
    durationNights: String(trip.durationNights),
    minTravelers: String(trip.minTravelers),
    maxTravelers: trip.maxTravelers ? String(trip.maxTravelers) : "",
    difficulty: trip.difficulty,
    transport: trip.transport,
    languages: trip.languages,
    season: trip.season ?? "",
    highlights: trip.highlights,
    included: trip.included,
    excluded: trip.excluded,
    requirements: trip.requirements ?? "",
    cancellationPolicy: trip.cancellationPolicy ?? "",
    importantNotes: trip.importantNotes,
    image: trip.image,
    extraImages: trip.extraImages,
    video: trip.video ?? "",
    videos: trip.videos,
    price: String(trip.price),
    oldPrice: trip.oldPrice ? String(trip.oldPrice) : "",
    discount: trip.discount ? String(trip.discount) : "",
    childPrice: trip.childPrice ? String(trip.childPrice) : "",
    infantPrice: trip.infantPrice ? String(trip.infantPrice) : "",
    singleSupplement: trip.singleSupplement ? String(trip.singleSupplement) : "",
    adultAge: ageBands.adult,
    passengerPrices: passengerRowsFromTrip(trip),
    sourceMetadata: trip.sourceMetadata ?? {},
    sourceTripId: trip.sourceTripId ?? "",
    hotel: trip.hotel ?? "",
    foodIncluded:
      trip.foodIncluded === true ? "true" : trip.foodIncluded === false ? "false" : "",
    departureRule: trip.departureRule ?? "",
    extraFees: trip.extraFees,
    roomPrices: trip.roomPrices,
    childPriceNotes: trip.childPriceNotes,
    brochurePdfUrl: trip.brochurePdfUrl ?? "",
    hotelMedia: parseMediaItems(trip.hotelMedia) ?? [],
    travelerMedia: parseMediaItems(trip.travelerMedia) ?? [],
    isFeatured: trip.isFeatured,
    isPublished: trip.isPublished,
    itinerary: trip.itinerary.map((day) => ({
      title: day.title,
      description: day.description ?? "",
      location: day.location ?? "",
      meals: day.meals.join(", "),
      accommodation: day.accommodation ?? "",
      image: day.image ?? "",
      video: day.video ?? "",
    })),
    departures: trip.departures.map((dep) => {
      const startDate = toDateInput(dep.startDate);
      const fares = datedPassengerFares(trip.sourceMetadata, startDate);
      return {
        id: dep.id,
        startDate,
        endDate: toDateInput(dep.endDate),
        seatsTotal: dep.seatsTotal !== null ? String(dep.seatsTotal) : "",
        seatsLeft: dep.seatsLeft !== null ? String(dep.seatsLeft) : "",
        price: dep.price !== null ? String(dep.price) : "",
        childPrice: dep.childPrice !== null ? String(dep.childPrice) : fares.child !== null ? String(fares.child) : "",
        infantPrice: dep.infantPrice !== null ? String(dep.infantPrice) : fares.infant !== null ? String(fares.infant) : "",
        status: dep.status,
      };
    }),
  };
}

function numOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function buildPayload(form: FormState) {
  // JSON drops `undefined`.  Optional text must therefore use null when the
  // editor clears it, otherwise an old database value silently survives.
  const nullableText = (value: string) => value.trim() || null;
  const nullableNumber = (value: string) => numOrUndefined(value) ?? null;
  const passengerFareSummary = passengerSummary(form.passengerPrices);

  return {
    title: form.title.trim(),
    slug: form.slug.trim() || undefined,
    summary: nullableText(form.summary),
    description: form.description.trim(),
    categoryId: form.categoryIds[0] || undefined,
    categoryIds: form.categoryIds,
    tagIds: form.tagIds,

    country: nullableText(form.country),
    city: nullableText(form.city),
    region: nullableText(form.region),
    destinations: form.destinations,
    meetingPoint: nullableText(form.meetingPoint),
    mapUrl: nullableText(form.mapUrl),

    durationDays: numOrUndefined(form.durationDays),
    durationNights: numOrUndefined(form.durationNights),
    minTravelers: numOrUndefined(form.minTravelers),
    maxTravelers: numOrUndefined(form.maxTravelers),
    difficulty: form.difficulty,
    transport: form.transport,
    languages: form.languages,
    season: nullableText(form.season),

    highlights: form.highlights,
    included: form.included,
    excluded: form.excluded,
    requirements: nullableText(form.requirements),
    cancellationPolicy: nullableText(form.cancellationPolicy),
    importantNotes: form.importantNotes,

    image: form.image.trim(),
    extraImages: form.extraImages,
    // null, not undefined — JSON drops undefined, so clearing the video never saved.
    video: form.video.trim() || null,
    videos: form.videos,

    price: numOrUndefined(form.price),
    oldPrice: nullableNumber(form.oldPrice),
    discount: nullableNumber(form.discount),
    childPrice: passengerFareSummary.childPrice,
    infantPrice: passengerFareSummary.infantPrice,
    singleSupplement: nullableNumber(form.singleSupplement),
    sourceTripId: nullableText(form.sourceTripId),
    sourceMetadata: withPassengerPricingMetadata(form),
    hotel: nullableText(form.hotel),
    foodIncluded:
      form.foodIncluded === "true" ? true : form.foodIncluded === "false" ? false : null,
    departureRule: nullableText(form.departureRule),
    extraFees: form.extraFees,
    roomPrices: form.roomPrices,
    childPriceNotes: form.childPriceNotes,
    brochurePdfUrl: nullableText(form.brochurePdfUrl),
    hotelMedia: form.hotelMedia.filter((item) => item.url.trim()),
    travelerMedia: form.travelerMedia.filter((item) => item.url.trim()),

    isFeatured: form.isFeatured,
    isPublished: form.isPublished,

    itinerary: form.itinerary
      .filter((day) => day.title.trim())
      .map((day) => ({
        title: day.title.trim(),
        description: day.description.trim() || undefined,
        location: day.location.trim() || undefined,
        image: day.image.trim() || undefined,
        video: day.video.trim() || undefined,
        meals: day.meals
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean),
        accommodation: day.accommodation.trim() || undefined,
      })),

    departures: form.departures
      .filter((dep) => dep.startDate)
      .map((dep) => ({
        startDate: dep.startDate,
        endDate: dep.endDate || null,
        seatsTotal: nullableNumber(dep.seatsTotal),
        seatsLeft: nullableNumber(dep.seatsLeft),
        price: nullableNumber(dep.price),
        childPrice: nullableNumber(dep.childPrice),
        infantPrice: nullableNumber(dep.infantPrice),
        status: dep.status,
      })),
  };
}

export default function TripForm({ mode, tripId }: { mode: "create" | "edit"; tripId?: string }) {
  const router = useRouter();
  const { locale } = useI18n();
  const queryClient = useQueryClient();

  const { data: existingTrip, isPending: loadingTrip } = useTrip(mode === "edit" ? tripId : undefined);
  const { data: categoryTree } = useCategoryTree();
  const { data: tags } = useTags();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const hydrated = useRef(false);

  useEffect(() => {
    if (mode === "edit" && existingTrip && !hydrated.current) {
      setForm(tripToForm(existingTrip));
      hydrated.current = true;
    }
  }, [mode, existingTrip]);

  const categoryOptions = flattenCategories(categoryTree ?? []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(form);
      if (mode === "create") {
        const { data } = await api.post("/trips", payload);
        return data as Trip;
      }
      const { data } = await api.put(`/trips/${tripId}`, payload);
      return data as Trip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "trips"] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      toast.success(mode === "create" ? "Аялал үүсгэлээ" : "Аялал хадгаллаа");
      router.push(`/${locale}/admin/trips`);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Хадгалахад алдаа гарлаа")),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.delete(`/trips/${tripId}`);
      return data as { success: boolean; archived?: boolean; message?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "trips"] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      toast.success(data.message ?? (data.archived ? "Аяллыг нийтээс нуув" : "Аяллыг устгалаа"));
      router.push(`/${locale}/admin/trips`);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Устгахад алдаа гарлаа")),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.title.trim()) return toast.error("Аяллын нэрээ оруулна уу");
    if (!form.description.trim()) return toast.error("Тайлбар оруулна уу");
    if (!numOrUndefined(form.price)) return toast.error("Үнэ оруулна уу");
    if (!form.image.trim()) return toast.error("Зураг оруулна уу (URL эсвэл байршуулна уу)");
    if (!isAllowedImageHost(form.image)) {
      return toast.error(
        'Үндсэн зургийн домэйн дэмжигдэхгүй. "Байршуулах" товчоор оруулна уу.',
      );
    }

    for (const [index, dep] of form.departures.entries()) {
      if (!dep.startDate) continue; // dropped at submit time anyway, nothing to validate

      if (dep.endDate && dep.endDate < dep.startDate) {
        return toast.error(`Хөдөлгөөн ${index + 1}: дуусах огноо эхлэх огнооноос өмнө байна`);
      }

      const total = numOrUndefined(dep.seatsTotal);
      const left = numOrUndefined(dep.seatsLeft);
      if (total !== undefined && left !== undefined && left > total) {
        return toast.error(`Хөдөлгөөн ${index + 1}: үлдсэн суудал нийт суудлаас их байна`);
      }
    }

    saveMutation.mutate();
  }

  function deleteTrip() {
    if (mode !== "edit" || !tripId || deleteMutation.isPending) return;

    const name = existingTrip?.title ? `"${existingTrip.title}"` : "энэ аяллыг";
    const confirmed = window.confirm(
      `${name} устгах уу?\n\nБаталгаажсан захиалгатай аялал бол бүр устгахгүй, зөвхөн нийтээс нууж chatbot/poster sync хийнэ.`,
    );

    if (!confirmed) return;
    deleteMutation.mutate();
  }

  if (mode === "edit" && loadingTrip) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-secondary" />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-8 pb-16">
      <Section title="Үндсэн мэдээлэл">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Аяллын нэр *</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <Label>Slug (заавал биш)</Label>
            <Input value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="нэрнээс автоматаар үүснэ" />
          </div>
          <div className="sm:col-span-2">
            <Label>Ангилал</Label>
            {categoryOptions.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {categoryOptions.map((opt) => {
                  const active = form.categoryIds.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        set(
                          "categoryIds",
                          active
                            ? form.categoryIds.filter((id) => id !== opt.id)
                            : [...form.categoryIds, opt.id],
                        )
                      }
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-muted-foreground">Ангилал алга байна.</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <Label>Шошго (үнэ, урамшуулал, тээврийн төрөл гэх мэт)</Label>
            {tags && tags.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const active = form.tagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() =>
                        set(
                          "tagIds",
                          active
                            ? form.tagIds.filter((id) => id !== tag.id)
                            : [...form.tagIds, tag.id],
                        )
                      }
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-muted-foreground">
                Шошго алга байна.{" "}
                <Link href={`/${locale}/admin/tags`} className="font-medium text-primary hover:underline">
                  Шошгын хэсгээс нэмнэ үү
                </Link>
                .
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <Label>Товч танилцуулга</Label>
            <Input value={form.summary} onChange={(e) => set("summary", e.target.value)} placeholder="Жагсаалт болон OG тайлбарт харагдана" />
          </div>
          <div className="sm:col-span-2">
            <Label>Дэлгэрэнгүй тайлбар *</Label>
            <Textarea rows={6} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div>
            <Label>Улс</Label>
            <Input value={form.country} onChange={(e) => set("country", e.target.value)} />
          </div>
          <div>
            <Label>Хот</Label>
            <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <StringListField label="Очих газрууд" values={form.destinations} onChange={(v) => set("destinations", v)} placeholder="ж: Токио" />
          </div>
          <div>
            <Label>Үргэлжлэх (хоног)</Label>
            <Input type="number" min={1} value={form.durationDays} onChange={(e) => set("durationDays", e.target.value)} />
          </div>
          <div>
            <Label>Үргэлжлэх (шөнө)</Label>
            <Input type="number" min={0} value={form.durationNights} onChange={(e) => set("durationNights", e.target.value)} />
          </div>
          <div>
            <Label>Хамгийн бага хүн</Label>
            <Input type="number" min={1} value={form.minTravelers} onChange={(e) => set("minTravelers", e.target.value)} />
          </div>
          <div>
            <Label>Хамгийн их хүн</Label>
            <Input type="number" min={1} value={form.maxTravelers} onChange={(e) => set("maxTravelers", e.target.value)} />
          </div>
          <div>
            <Label>Хүндрэл</Label>
            <select
              value={form.difficulty}
              onChange={(e) => set("difficulty", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="EASY">Хөнгөн</option>
              <option value="MODERATE">Дунд</option>
              <option value="CHALLENGING">Хүнд</option>
            </select>
          </div>
          <div>
            <Label>Улирал</Label>
            <Input value={form.season} onChange={(e) => set("season", e.target.value)} placeholder="ж: Хавар" />
          </div>
          <div>
            <StringListField label="Тээвэр" values={form.transport} onChange={(v) => set("transport", v)} placeholder="ж: Онгоц" />
          </div>
          <div>
            <StringListField label="Хөтчийн хэл" values={form.languages} onChange={(v) => set("languages", v)} placeholder="ж: Монгол" />
          </div>
          <div>
            <Label>Цугларах цэг</Label>
            <Input value={form.meetingPoint} onChange={(e) => set("meetingPoint", e.target.value)} />
          </div>
          <div>
            <Label>Газрын зургийн URL (embed)</Label>
            <Input value={form.mapUrl} onChange={(e) => set("mapUrl", e.target.value)} placeholder="https://…" />
          </div>
        </div>
      </Section>

      <Section title="Зураг, бичлэг">
        <div className="grid gap-4">
          <ImageUploadField label="Үндсэн зураг" value={form.image} onChange={(v) => set("image", v)} required />
          <MultiImageField label="Нэмэлт зургууд" values={form.extraImages} onChange={(v) => set("extraImages", v)} />
          <ImageUploadField label="Үндсэн бичлэг" value={form.video} onChange={(v) => set("video", v)} resourceType="video" />
          <MultiImageField label="Нэмэлт бичлэгүүд" values={form.videos} onChange={(v) => set("videos", v)} resourceType="video" />
        </div>
      </Section>

      <Section title="Үнэ">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Насанд хүрэгчийн үнэ (₮) *</Label>
            <Input type="number" min={0} value={form.price} onChange={(e) => set("price", e.target.value)} />
          </div>
          <div>
            <Label>Том хүний нас</Label>
            <Input value={form.adultAge} onChange={(e) => set("adultAge", e.target.value)} placeholder="ж: 12+ нас" />
          </div>
          <div>
            <Label>Хуучин үнэ (хямдралтай бол)</Label>
            <Input type="number" min={0} value={form.oldPrice} onChange={(e) => set("oldPrice", e.target.value)} />
          </div>
          <div>
            <Label>Хямдрал (%)</Label>
            <Input type="number" min={0} max={100} value={form.discount} onChange={(e) => set("discount", e.target.value)} />
          </div>
          <div>
            <Label>Ганц хүний нэмэгдэл</Label>
            <Input type="number" min={0} value={form.singleSupplement} onChange={(e) => set("singleSupplement", e.target.value)} />
          </div>
        </div>
        <PassengerPriceEditor
          rows={form.passengerPrices}
          onChange={(rows) => set("passengerPrices", rows)}
        />
      </Section>

      <Section title="Чухал тэмдэглэл">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <AlertCircle className="h-4 w-4" />
            Вебсайт дээрх шар тэмдэглэлийн хэсэг
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
            Үнэ, гарах өдөр, шинжилгээ, тусгай анхааруулга зэрэг зөвхөн энэ аялалд
            хамаарах мөрүүдийг энд нэмнэ.
          </p>
          <div className="mt-3">
            <StringListField
              label="Тэмдэглэлийн мөрүүд"
              values={form.importantNotes}
              onChange={(v) => set("importantNotes", v)}
              placeholder="ж: Үнэ болон гарах огноог админ удахгүй баталгаажуулна."
            />
          </div>
        </div>
      </Section>

      <Section title="Дэлгэрэнгүй">
        <div className="grid gap-4">
          <StringListField label="Онцлох мөчүүд" values={form.highlights} onChange={(v) => set("highlights", v)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <StringListField label="Багцад багтсан" values={form.included} onChange={(v) => set("included", v)} />
            <StringListField label="Багцад ороогүй" values={form.excluded} onChange={(v) => set("excluded", v)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <StringListField label="Нэмэлт төлбөр" values={form.extraFees} onChange={(v) => set("extraFees", v)} />
            <StringListField label="Өрөөний үнэ" values={form.roomPrices} onChange={(v) => set("roomPrices", v)} />
          </div>
          <StringListField label="Хүүхдийн үнийн тэмдэглэл" values={form.childPriceNotes} onChange={(v) => set("childPriceNotes", v)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Зочид буудал</Label>
              <Input value={form.hotel} onChange={(e) => set("hotel", e.target.value)} />
            </div>
            <div>
              <Label>Хоол багтсан эсэх</Label>
              <select
                value={form.foodIncluded}
                onChange={(e) => set("foodIncluded", e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Тодорхойгүй</option>
                <option value="true">Багтсан</option>
                <option value="false">Багтаагүй</option>
              </select>
            </div>
          </div>
          <MediaListEditor
            label="Зочид буудлын зураг, бичлэг, холбоос"
            hint="Аяллын хуудасны “Бэлтгэл мэдээлэл” хэсэгт зочид буудлын нэрийн доор харагдана."
            items={form.hotelMedia}
            onChange={(v) => set("hotelMedia", v)}
          />
          <div>
            <Label>Гарах өдрийн дүрэм</Label>
            <Textarea rows={2} value={form.departureRule} onChange={(e) => set("departureRule", e.target.value)} />
          </div>
          <div>
            <Label>PDF / брошур URL</Label>
            <Input value={form.brochurePdfUrl} onChange={(e) => set("brochurePdfUrl", e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <Label>Шаардлага</Label>
            <Textarea rows={3} value={form.requirements} onChange={(e) => set("requirements", e.target.value)} />
          </div>
          <div>
            <Label>Цуцлалтын нөхцөл</Label>
            <Textarea rows={3} value={form.cancellationPolicy} onChange={(e) => set("cancellationPolicy", e.target.value)} />
          </div>
          <div>
            <Label>Chatbot source id</Label>
            <Input value={form.sourceTripId} onChange={(e) => set("sourceTripId", e.target.value)} />
          </div>
        </div>
      </Section>

      <Section title="Аялагчдын зураг, бичлэг">
        <MediaListEditor
          label="Аялагчдын зураг, бичлэг, холбоос"
          hint="Энэ аялалд явсан хүмүүсийн дурсамж — аяллын хуудсанд зочид буудлын хэсгийн доор тусдаа хайрцагт харагдана."
          items={form.travelerMedia}
          onChange={(v) => set("travelerMedia", v)}
        />
      </Section>

      {mode === "edit" && tripId && (
        <Section title="Цаг агаар">
          <WeatherPlacesEditor tripId={tripId} />
        </Section>
      )}

      <Section title="Өдөр тутмын хөтөлбөр">
        <ItineraryEditor days={form.itinerary} onChange={(v) => set("itinerary", v)} />
      </Section>

      <Section title="Хөдөлгөөнүүд (огноонууд)">
        <DepartureEditor departures={form.departures} onChange={(v) => set("departures", v)} />
      </Section>

      <Section title="Тохиргоо">
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={form.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} className="h-4 w-4 rounded border-input" />
            Онцлох аялал
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => set("isPublished", e.target.checked)} className="h-4 w-4 rounded border-input" />
            Нийтэд харагдана
          </label>
        </div>
      </Section>

      <div className="sticky bottom-4 flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <div>
          {mode === "edit" && (
            <Button
              type="button"
              variant="destructive"
              onClick={deleteTrip}
              disabled={deleteMutation.isPending || saveMutation.isPending}
              className="gap-1.5"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Устгах
            </Button>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/${locale}/admin/trips`)}
            disabled={deleteMutation.isPending}
          >
            Цуцлах
          </Button>
          <Button type="submit" disabled={saveMutation.isPending || deleteMutation.isPending} className="gap-1.5">
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Аялал үүсгэх" : "Хадгалах"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function PassengerPriceEditor({
  rows,
  onChange,
}: {
  rows: PassengerPriceDraft[];
  onChange: (rows: PassengerPriceDraft[]) => void;
}) {
  const update = (index: number, next: PassengerPriceDraft) =>
    onChange(rows.map((row, i) => (i === index ? next : row)));
  const addRow = (label: string) =>
    onChange([...rows, { label, ageRange: "", price: "", free: false }]);

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Хүүхэд / нярайн нас ба үнэ</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Насны ангилал бүрийг тусдаа мөрөөр оруулна. Үнэгүй бол checkbox дарна.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => addRow("Хүүхэд")}>
            <Plus className="h-3.5 w-3.5" />
            Хүүхэд
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addRow("Нярай")}>
            <Plus className="h-3.5 w-3.5" />
            Нярай
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {rows.length === 0 && (
          <p className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
            Хүүхэд/нярайн тусдаа үнэ байхгүй бол хоосон үлдээнэ.
          </p>
        )}
        {rows.map((row, index) => (
          <div key={index} className="grid gap-2 rounded-md border border-border bg-card p-2 sm:grid-cols-[1fr_1fr_1fr_auto_auto]">
            <div>
              <Label>Ангилал</Label>
              <Input
                value={row.label}
                onChange={(e) => update(index, { ...row, label: e.target.value })}
                placeholder="ж: Хүүхэд 2-5"
              />
            </div>
            <div>
              <Label>Нас</Label>
              <Input
                value={row.ageRange}
                onChange={(e) => update(index, { ...row, ageRange: e.target.value })}
                placeholder="ж: 2-5 нас"
              />
            </div>
            <div>
              <Label>Үнэ (₮)</Label>
              <Input
                type="number"
                min={0}
                value={row.free ? "" : row.price}
                disabled={row.free}
                onChange={(e) => update(index, { ...row, price: e.target.value })}
                placeholder={row.free ? "Үнэгүй" : "ж: 2390000"}
              />
            </div>
            <label className="flex items-center gap-2 pt-6 text-sm font-medium text-muted-foreground">
              <input
                type="checkbox"
                checked={row.free}
                onChange={(e) => update(index, { ...row, free: e.target.checked, price: e.target.checked ? "" : row.price })}
                className="h-4 w-4 rounded border-input"
              />
              Үнэгүй
            </label>
            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
                aria-label="Мөр устгах"
                title="Мөр устгах"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-4 text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}
