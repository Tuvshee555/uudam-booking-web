"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { AlertTriangle, Archive, CalendarDays, Check, ClipboardList, ExternalLink, Eye, Images, Info, Loader2, Plus, RefreshCw, Save, Scale, Trash2, Wallet } from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { changedTripFields, mergeTripEdit } from "@/lib/tripEditPatch";
import { departureDateKey } from "@/lib/departureDate";
import { ageBandsFor } from "@/lib/pricing";
import { isAllowedImageHost } from "@/lib/imageHosts";
import { useCategoryTree, useTags, useTrip } from "@/hooks/useTrips";
import { useTripHealth } from "@/hooks/useTripHealth";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { Notice, StatusBadge, SwitchField, useConfirm } from "@/components/admin/ui";
import { formatRelative } from "@/lib/adminFormat";
import { cn } from "@/lib/utils";
import { passengerName } from "@/lib/adminDatePricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CategoryNode, Trip } from "@/types/trip";

import StringListField from "./StringListField";
import ImageUploadField from "./ImageUploadField";
import MultiImageField from "./MultiImageField";
import MediaListEditor from "./MediaListEditor";
import HotelProfilesEditor from "./HotelProfilesEditor";
import WeatherPlacesEditor from "./WeatherPlacesEditor";
import { parseMediaItems, type MediaItem } from "@/lib/media";
import { hotelProfilesFromData, type HotelProfile } from "@/lib/hotelLinks";
import ItineraryEditor, { type ItineraryDraft } from "./ItineraryEditor";
import { type DepartureDraft } from "./DepartureEditor";
import DatePricingEditor from "./DatePricingEditor";
import TripComparison from "./TripComparison";
import TripSyncStatus from "./TripSyncStatus";
import SelectionField from "./SelectionField";

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
  return [...new Set(values
    .map((value) => text(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0] || "")
    .filter(Boolean))];
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
  hotelProfiles: HotelProfile[];
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
  hotelProfiles: [],
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
    childPrice: trip.childPrice !== null ? String(trip.childPrice) : "",
    infantPrice: trip.infantPrice !== null ? String(trip.infantPrice) : "",
    singleSupplement: trip.singleSupplement !== null ? String(trip.singleSupplement) : "",
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
    hotelProfiles: hotelProfilesFromData(trip.sourceMetadata, trip.hotel, trip.hotelMedia),
    travelerMedia: parseMediaItems(trip.travelerMedia) ?? [],
    isFeatured: trip.isFeatured,
    isPublished: trip.isPublished,
    itinerary: trip.itinerary.map((day) => ({
      id: day.id,
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

/** Cheapest adult fare typed on any date — the "from" price the site shows. */
function lowestDatePrice(form: FormState): number | undefined {
  const groups = Array.isArray(form.sourceMetadata.price_groups) ? form.sourceMetadata.price_groups : [];
  const prices = [
    ...form.departures.map((dep) => numOrUndefined(dep.price)),
    ...groups.map((group) => {
      const value = object(group).adult_price;
      return typeof value === "number" ? value : undefined;
    }),
  ].filter((n): n is number => n !== undefined && n > 0);
  return prices.length ? Math.min(...prices) : undefined;
}

function FieldError({ show, children }: { show: boolean; children: React.ReactNode }) {
  return show ? <p role="alert" className="mt-1 text-xs font-medium text-destructive">{children}</p> : null;
}

function buildPayload(form: FormState) {
  // JSON drops `undefined`.  Optional text must therefore use null when the
  // editor clears it, otherwise an old database value silently survives.
  const nullableText = (value: string) => value.trim() || null;
  const nullableNumber = (value: string) => numOrUndefined(value) ?? null;
  const passengerFareSummary = passengerSummary(form.passengerPrices);
  const hotelProfiles = form.hotelProfiles
    .filter((hotel) => hotel.name.trim())
    .map((hotel) => ({
      name: hotel.name.trim(),
      url: hotel.url.trim(),
      description: hotel.description.trim(),
      media: hotel.media.filter((item) => item.url.trim()),
    }));
  const pricingMetadata = Array.isArray(form.sourceMetadata.price_groups) && form.sourceMetadata.price_groups.length
    ? form.sourceMetadata : withPassengerPricingMetadata(form);
  const sourceMetadata = {
    ...pricingMetadata,
    hotel_profiles: hotelProfiles,
    hotel_links: hotelProfiles.filter((hotel) => hotel.url).map(({ name, url }) => ({ name, url })),
  };

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
    maxTravelers: nullableNumber(form.maxTravelers),
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
    sourceMetadata,
    hotel: nullableText(hotelProfiles.map((hotel) => hotel.name).join(", ") || form.hotel),
    foodIncluded:
      form.foodIncluded === "true" ? true : form.foodIncluded === "false" ? false : null,
    departureRule: nullableText(form.departureRule),
    extraFees: form.extraFees,
    roomPrices: form.roomPrices,
    childPriceNotes: form.childPriceNotes,
    brochurePdfUrl: nullableText(form.brochurePdfUrl),
    hotelMedia: hotelProfiles.length
      ? hotelProfiles.flatMap((hotel) => hotel.media)
      : form.hotelMedia.filter((item) => item.url.trim()),
    travelerMedia: form.travelerMedia.filter((item) => item.url.trim()),

    isFeatured: form.isFeatured,
    isPublished: form.isPublished,

    itinerary: form.itinerary
      .filter((day) => day.title.trim())
      .map((day) => ({
        ...(day.id ? { id: day.id } : {}),
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

  const { data: existingTrip, isPending: tripPending, isFetchedAfterMount } = useTrip(mode === "edit" ? tripId : undefined, undefined, { admin: true });
  const { data: categoryTree } = useCategoryTree(undefined, { admin: true });
  const { data: tags } = useTags({ admin: true });

  const confirm = useConfirm();
  // Problems the automatic site check found on this trip, shown above the
  // form so they get fixed where they are edited.
  const { data: health, refetch: recheckHealth, isFetching: checkingHealth } = useTripHealth({ enabled: mode === "edit" });
  const tripIssues = (health?.issues ?? []).filter((issue) => issue.tripId === tripId);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [baseline, setBaseline] = useState<string | null>(mode === "create" ? JSON.stringify(EMPTY_FORM) : null);
  const [activeSection, setActiveSection] = useState("facts");
  const [missingField, setMissingField] = useState<string | null>(null);
  // Which tab holds the field a failed save pointed at, so that tab shows a red dot.
  const [invalidSection, setInvalidSection] = useState<string | null>(null);
  const originalForm = useRef<FormState | null>(null);
  const originalUpdatedAt = useRef<string | undefined>(undefined);
  const hydrated = useRef<string | undefined>(undefined);

  const categoryOptions = flattenCategories(categoryTree ?? []);
  const isDirty = baseline !== null && JSON.stringify(form) !== baseline;
  const loadingTrip = tripPending || (mode === "edit" && baseline === null);

  // Fill the form only from data fetched after this editor opened, never from a
  // cached copy. A newer version (usually the chatbot sync) replaces the form
  // while staff have nothing unsaved; with unsaved edits the save re-applies
  // them onto the newer version instead.
  useEffect(() => {
    if (mode !== "edit" || !existingTrip || existingTrip.id !== tripId || !isFetchedAfterMount) return;
    const first = hydrated.current !== tripId;
    if (!first && (isDirty || originalUpdatedAt.current === existingTrip.updatedAt)) return;
    const initial = tripToForm(existingTrip);
    originalForm.current = initial;
    originalUpdatedAt.current = existingTrip.updatedAt;
    setForm(initial);
    setBaseline(JSON.stringify(initial));
    hydrated.current = tripId;
  }, [mode, existingTrip, tripId, isFetchedAfterMount, isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (missingField === key) {
      setMissingField(null);
      setInvalidSection(null);
    }
  }

  /**
   * Nights follow days (5 өдөр → 4 шөнө) until someone types a different
   * number of nights themselves — the usual case should not need typing twice.
   */
  function setDays(value: string) {
    setForm((f) => {
      const previousDays = Number(f.durationDays);
      const nightsFollowDays = f.durationNights === "" || Number(f.durationNights) === Math.max(0, previousDays - 1);
      const days = Number(value);
      return {
        ...f,
        durationDays: value,
        durationNights: nightsFollowDays && Number.isFinite(days) && days >= 1 ? String(days - 1) : f.durationNights,
      };
    });
  }

  const saveMutation = useMutation({
    mutationFn: async (current: FormState) => {
      const fullPayload = buildPayload(current);
      const payload = mode === "edit" && originalForm.current
        ? { ...changedTripFields(buildPayload(originalForm.current), fullPayload), expectedUpdatedAt: originalUpdatedAt.current }
        : fullPayload;
      if (mode === "create") {
        const { data } = await api.post("/trips", payload);
        return data as Trip;
      }
      try {
        const { data } = await api.put(`/trips/${tripId}`, payload);
        return data as Trip;
      } catch (error) {
        if (!originalForm.current || !axios.isAxiosError(error) || error.response?.status !== 409) throw error;
        // Saved elsewhere since this form opened — usually the chatbot sync, not a
        // person. Re-apply this editor's changes onto the latest trip unless both
        // changed the same value.
        const latest = (await api.get(`/trips/${tripId}`)).data as Trip;
        const theirs = buildPayload(tripToForm(latest));
        const { merged, conflicts } = mergeTripEdit(buildPayload(originalForm.current), fullPayload, theirs);
        if (conflicts.length) {
          throw new Error(`Энэ аяллыг өөр газар засчээ, таны засвартай давхцаж байна (${conflicts.slice(0, 3).join(", ")}). Хуудсаа дахин ачаалаад засвараа дахин оруулна уу.`);
        }
        const rebased = changedTripFields(theirs, merged);
        if (!Object.keys(rebased).length) return latest;
        const { data } = await api.put(`/trips/${tripId}`, { ...rebased, expectedUpdatedAt: latest.updatedAt });
        return data as Trip;
      }
    },
    onSuccess: (saved) => {
      setBaseline(JSON.stringify(tripToForm(saved)));
      queryClient.invalidateQueries({ queryKey: ["admin", "trips"] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      if (saved.sourceMetadata?.websiteSyncPending) {
        toast.warning("Аялал хадгалагдлаа. Chatbot руу хараахан илгээгдээгүй — дээд талын «Дахин илгээх» товчийг дарж болно.");
        originalForm.current = tripToForm(saved);
        originalUpdatedAt.current = saved.updatedAt;
        setForm(originalForm.current);
        setBaseline(JSON.stringify(originalForm.current));
        if (mode === "create") router.push(`/${locale}/admin/trips/${saved.id}/edit`);
        return;
      }
      toast.success(mode === "create" ? "Аялал үүсгэлээ" : "Аялал хадгаллаа");
      if (mode === "create") {
        router.push(`/${locale}/admin/trips/${saved.id}/edit`);
        return;
      }
      // Editing stays on this same trip — staff fixing several draft trips in a
      // row (adding a missing price, say) were bounced back to the list and had
      // to re-search for the next one every single save.
      originalForm.current = tripToForm(saved);
      originalUpdatedAt.current = saved.updatedAt;
      setForm(originalForm.current);
      setBaseline(JSON.stringify(originalForm.current));
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Хадгалахад алдаа гарлаа")),
  });

  const retrySync = useMutation({
    mutationFn: async () => (await api.post("/admin/trip-sync", { id: tripId })).data as { complete: boolean; trip: Trip },
    onSuccess: ({ complete, trip }) => {
      if (!complete) { toast.warning("Chatbot руу хараахан илгээгдсэнгүй. Таны хадгалсан мэдээлэл сайт дээр бүрэн хадгалагдсан — дараа дахин оролдоно уу."); return; }
      if (originalForm.current && JSON.stringify(form) === JSON.stringify(originalForm.current)) {
        originalForm.current = tripToForm(trip);
        originalUpdatedAt.current = trip.updatedAt;
        setForm(originalForm.current);
        setBaseline(JSON.stringify(originalForm.current));
      }
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      toast.success("Chatbot руу амжилттай илгээлээ");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Chatbot руу илгээхэд алдаа гарлаа")),
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

    // The empty box turns red and comes into view, so the toast is never the
    // only clue — it used to name a field hidden inside a collapsed panel.
    const invalid = (section: string, field: string | null, message: string) => {
      setActiveSection(section);
      setMissingField(field);
      setInvalidSection(section);
      toast.error(message);
      if (field) {
        requestAnimationFrame(() => {
          const el = document.querySelector<HTMLElement>(`[data-field="${field}"]`);
          el?.scrollIntoView({ block: "center", behavior: "smooth" });
          el?.focus({ preventScroll: true });
        });
      }
    };
    if (!form.title.trim()) return invalid("facts", "title", "Аяллын нэрээ оруулна уу");

    // Staff type prices on each date; the base price sits in a collapsed panel
    // and used to stay 0, so every save failed with "Үнэ оруулна уу" while the
    // prices were plainly filled in. The cheapest date price is the base price.
    let toSave = form;
    const basePrice = numOrUndefined(form.price);
    if (!basePrice || basePrice <= 0) {
      const fromDates = lowestDatePrice(form);
      if (!fromDates) return invalid("pricing", "price", "Том хүний үнэ оруулна уу");
      toSave = { ...form, price: String(fromDates) };
      setForm(toSave);
    }

    if (!form.image.trim()) return invalid("media", "image", "Үндсэн зураг оруулна уу");
    if (!isAllowedImageHost(form.image)) {
      return invalid("media", "image",
        'Үндсэн зургийн домэйн дэмжигдэхгүй. "Байршуулах" товчоор оруулна уу.',
      );
    }

    for (const [index, dep] of form.departures.entries()) {
      if (!dep.startDate) continue; // dropped at submit time anyway, nothing to validate

      if (dep.endDate && dep.endDate < dep.startDate) {
        return invalid("pricing", null, `Гаралт ${index + 1}: дуусах огноо эхлэх огнооноос өмнө байна`);
      }

      const total = numOrUndefined(dep.seatsTotal);
      const left = numOrUndefined(dep.seatsLeft);
      if (total !== undefined && left !== undefined && left > total) {
        return invalid("pricing", null, `Гаралт ${index + 1}: үлдсэн суудал нийт суудлаас их байна`);
      }
    }

    setMissingField(null);
    setInvalidSection(null);
    saveMutation.mutate(toSave);
  }

  async function deleteTrip() {
    if (mode !== "edit" || !tripId || deleteMutation.isPending) return;

    const confirmed = await confirm({
      title: "Энэ аяллыг архивлах уу?",
      description: `${existingTrip?.title ? `«${existingTrip.title}» ` : ""}сайтаас нуугдаж, онцлохоос хасагдана. Аялал, хөтөлбөр, захиалга, төлбөрийн түүх бүгд хадгалагдана — дараа нь «Сайтад харагдана»-г асааж буцааж нийтэлж болно.`,
      confirmLabel: "Архивлах",
      tone: "danger",
    });

    if (!confirmed) return;
    deleteMutation.mutate();
  }

  async function leave() {
    if (isDirty) {
      const discard = await confirm({
        title: "Хадгалаагүй өөрчлөлт байна",
        description: "Энэ хуудаснаас гарвал хадгалаагүй өөрчлөлт устна. Гарахын өмнө «Хадгалах» дарна уу.",
        confirmLabel: "Хадгалахгүй гарах",
        cancelLabel: "Үлдэх",
        tone: "danger",
      });
      if (!discard) return;
    }
    router.push(`/${locale}/admin/trips`);
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
    <form onSubmit={submit} className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-sm">
        <StatusBadge tone={form.isPublished ? "success" : "neutral"}>
          {mode === "create"
            ? form.isPublished
              ? "Үнэ, зурагтай бол хадгалмагц сайтад гарна"
              : "Ноорог болж хадгалагдана"
            : form.isPublished
              ? "Сайтад харагдана"
              : "Ноорог — сайтад харагдахгүй"}
        </StatusBadge>
        {form.isFeatured && <StatusBadge tone="brand">Онцлох</StatusBadge>}
        {mode === "edit" && form.slug && existingTrip?.isPublished && (
          <a
            href={`/${locale}/trips/${encodeURIComponent(form.slug)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            Сайт дээр харах
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <span className="ml-auto inline-flex flex-wrap items-center gap-2">
          {existingTrip?.sourceMetadata?.websiteSyncPending ? (
            <>
              <StatusBadge tone="warning" title="Энэ аяллын сүүлийн өөрчлөлт chatbot руу хараахан очоогүй байна">
                Chatbot руу илгээгдээгүй
              </StatusBadge>
              <Button type="button" variant="outline" size="sm" disabled={retrySync.isPending || saveMutation.isPending} onClick={() => retrySync.mutate()} className="gap-2">
                <RefreshCw className={cn("h-4 w-4", retrySync.isPending && "animate-spin")} />
                Дахин илгээх
              </Button>
            </>
          ) : (
            <span
              role="status"
              className={cn(
                "inline-flex items-center gap-1.5 text-xs",
                isDirty ? "font-medium text-amber-800 dark:text-amber-300" : "text-muted-foreground",
              )}
            >
              {isDirty ? <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500" /> : <Check className="h-3.5 w-3.5" />}
              {mode === "create"
                ? isDirty
                  ? "Хадгалаагүй шинэ аялал"
                  : "Шинэ аялал"
                : isDirty
                  ? "Хадгалаагүй өөрчлөлт байна"
                  : "Бүх өөрчлөлт хадгалагдсан"}
            </span>
          )}
        </span>
      </div>

      {mode === "edit" && existingTrip && (
        <TripSyncStatus
          sourceMetadata={existingTrip.sourceMetadata}
          retrying={retrySync.isPending}
          onRetry={() => retrySync.mutate()}
          onOpenComparison={() => setActiveSection("review")}
        />
      )}

      {tripIssues.length > 0 && (
        <Notice
          tone={tripIssues.some((issue) => issue.severity === "error") ? "danger" : "warning"}
          icon={AlertTriangle}
          title={`Сайтын шалгалтаар энэ аялалд ${tripIssues.length} асуудал илэрсэн`}
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => recheckHealth()} disabled={checkingHealth}>
              {checkingHealth ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Дахин шалгах
            </Button>
          }
        >
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {tripIssues.map((issue) => (
              <li key={`${issue.code}:${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
          {health && (
            <p className="mt-1.5 text-xs opacity-80">
              Сүүлд шалгасан: {formatRelative(health.generatedAt)}. Засаад хадгалсны дараа «Дахин шалгах» дарна уу.
            </p>
          )}
        </Notice>
      )}

      <div role="tablist" aria-label="Аяллын мэдээлэл" className="sticky top-14 z-20 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card px-2 shadow-sm no-scrollbar lg:top-2">
        {[
          { id: "facts", label: "Үндсэн мэдээлэл", icon: Info },
          { id: "pricing", label: "Үнэ, огноо", icon: Wallet },
          { id: "itinerary", label: "Хөтөлбөр", icon: CalendarDays },
          { id: "media", label: "Зураг, бичлэг", icon: Images },
          { id: "terms", label: "Нөхцөл, багц", icon: ClipboardList },
          { id: "publishing", label: "Нийтлэх", icon: Eye },
          ...(mode === "edit" ? [{ id: "review", label: "Chatbot-той харьцуулах", icon: Scale }] : []),
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" id={`trip-tab-${id}`} tabIndex={activeSection === id ? 0 : -1} aria-selected={activeSection === id} aria-controls="trip-editor-panel" onClick={() => setActiveSection(id)}
            onKeyDown={(event) => {
              const buttons = Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
              const current = buttons.indexOf(event.currentTarget);
              const next = event.key === "ArrowRight" ? (current + 1) % buttons.length : event.key === "ArrowLeft" ? (current + buttons.length - 1) % buttons.length : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : -1;
              if (next < 0) return;
              event.preventDefault();
              buttons[next].click();
              buttons[next].focus();
              buttons[next].scrollIntoView({ block: "nearest", inline: "nearest" });
            }}
            className={cn("inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring", activeSection === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <Icon className="h-4 w-4" />{label}
            {invalidSection === id && <span aria-label="энд засах зүйл байна" className="h-2 w-2 rounded-full bg-destructive" />}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="trip-editor-panel" aria-labelledby={`trip-tab-${activeSection}`} className="flex min-w-0 flex-col gap-8 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <Section title="Үндсэн мэдээлэл" hidden={activeSection !== "facts"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="trip-title">Аяллын нэр *</Label>
            <Input id="trip-title" data-field="title" aria-invalid={missingField === "title"}
              className={cn(missingField === "title" && "border-destructive focus-visible:ring-destructive")}
              value={form.title} onChange={(e) => set("title", e.target.value)} />
            <FieldError show={missingField === "title"}>Аяллын нэрээ оруулна уу</FieldError>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="trip-summary">Товч танилцуулга</Label>
            <Textarea id="trip-summary" rows={2} value={form.summary} onChange={(e) => set("summary", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="trip-description">Дэлгэрэнгүй тайлбар</Label>
            <Textarea id="trip-description" rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Хоосон үлдээвэл аяллын хуудсанд «Аяллын тухай» хэсэг харагдахгүй.</p>
          </div>
        </div>
      </Section>

      <Section title="Ангилал, шошго" hidden={activeSection !== "facts"}>
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectionField label="Ангилал" options={categoryOptions} selected={form.categoryIds} onChange={(ids) => set("categoryIds", ids)} />
          <SelectionField label="Шошго" options={(tags ?? []).map((tag) => ({ id: tag.id, label: tag.name }))} selected={form.tagIds} onChange={(ids) => set("tagIds", ids)} />
        </div>
      </Section>

      <Section title="Байршил, хугацаа" hidden={activeSection !== "facts"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="trip-country">Улс</Label>
            <Input id="trip-country" value={form.country} onChange={(e) => set("country", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="trip-city">Хот</Label>
            <Input id="trip-city" value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <StringListField label="Очих газрууд" values={form.destinations} onChange={(v) => set("destinations", v)} placeholder="ж: Токио" />
          </div>
          <div>
            <Label htmlFor="trip-days">Хэдэн өдөр</Label>
            <Input id="trip-days" type="number" min={1} value={form.durationDays} onChange={(e) => setDays(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="trip-nights">Хэдэн шөнө</Label>
            <Input id="trip-nights" type="number" min={0} value={form.durationNights} onChange={(e) => set("durationNights", e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Өдрөөс нэгээр бага байхаар өөрөө бөглөгдөнө. Өөр бол засна уу.</p>
          </div>
        </div>
      </Section>

      <Section title="Аяллын зохион байгуулалт" hidden={activeSection !== "facts"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="trip-min-travelers">Хүний доод тоо</Label>
            <Input id="trip-min-travelers" type="number" min={1} value={form.minTravelers} onChange={(e) => set("minTravelers", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="trip-max-travelers">Хүний дээд тоо</Label>
            <Input id="trip-max-travelers" type="number" min={1} value={form.maxTravelers} onChange={(e) => set("maxTravelers", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="trip-difficulty">Хүндрэл</Label>
            <select
              id="trip-difficulty"
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
            <Label htmlFor="trip-season">Улирал</Label>
            <Input id="trip-season" value={form.season} onChange={(e) => set("season", e.target.value)} placeholder="ж: Хавар" />
          </div>
          <div>
            <StringListField label="Тээвэр" values={form.transport} onChange={(v) => set("transport", v)} placeholder="ж: Онгоц" />
          </div>
          <div>
            <StringListField label="Хөтчийн хэл" values={form.languages} onChange={(v) => set("languages", v)} placeholder="ж: Монгол" />
          </div>
          <div>
            <Label htmlFor="trip-meeting">Цугларах цэг</Label>
            <Input id="trip-meeting" value={form.meetingPoint} onChange={(e) => set("meetingPoint", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="trip-map">Газрын зургийн холбоос</Label>
            <Input id="trip-map" value={form.mapUrl} onChange={(e) => set("mapUrl", e.target.value)} placeholder="https://…" />
          </div>
        </div>
      </Section>

      <Section title="Аяллын зургууд" hidden={activeSection !== "media"}>
        <div className="grid gap-5">
          <div data-field="image" tabIndex={-1}
            className={cn("rounded-md outline-none", missingField === "image" && "ring-2 ring-destructive ring-offset-2")}>
            <ImageUploadField label="Үндсэн зураг" value={form.image} onChange={(v) => set("image", v)} required />
            <FieldError show={missingField === "image"}>Үндсэн зураг оруулна уу</FieldError>
          </div>
          <MultiImageField label="Нэмэлт зургууд" values={form.extraImages} onChange={(v) => set("extraImages", v)} />
        </div>
      </Section>
      <Section title="Бичлэг, брошур" hidden={activeSection !== "media"}>
        <div className="grid gap-5">
          <ImageUploadField label="Үндсэн бичлэг" value={form.video} onChange={(v) => set("video", v)} resourceType="video" />
          <MultiImageField label="Нэмэлт бичлэгүүд" values={form.videos} onChange={(v) => set("videos", v)} resourceType="video" />
          <div>
            <Label htmlFor="trip-brochure">PDF брошурын холбоос</Label>
            <Input id="trip-brochure" value={form.brochurePdfUrl} onChange={(e) => set("brochurePdfUrl", e.target.value)} placeholder="https://..." />
          </div>
        </div>
      </Section>

      <Section title="Үнэ, гаралт" hidden={activeSection !== "pricing"}>
        {/* A draft trip's dates are always projected as "Одоогоор идэвхгүй":
            opening a date here is reverted by the next sync until the trip
            itself is published, and the publish switch sits on another tab.
            Staff kept re-opening dates on a draft trip (2026-10-15). */}
        {!form.isPublished && (
          <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <span className="min-w-0">
              Энэ аялал <b>ноорог</b> байна. Ноорог аяллын бүх огноо «Одоогоор идэвхгүй» харагдана —
              огноог нээхийн тулд аяллыг нийтлээд хадгална уу.
            </span>
            <Button type="button" size="sm" className="gap-2" onClick={() => set("isPublished", true)}>
              <Eye className="h-4 w-4" />Нийтлэх
            </Button>
          </div>
        )}
        <DatePricingEditor
          metadata={form.sourceMetadata}
          departures={form.departures}
          defaultPrice={form.price}
          defaultRows={cleanPassengerRows(form.passengerPrices)}
          adultPriceMissing={missingField === "price"}
          onChange={(sourceMetadata, departures) => {
            setForm((current) => ({ ...current, sourceMetadata, departures }));
            if (missingField === "price") {
              setMissingField(null);
              setInvalidSection(null);
            }
          }}
        />
        <details className="mt-6 border-t border-border pt-3">
          <summary className="cursor-pointer text-sm text-muted-foreground">Үндсэн үнэ, нас, хямдрал</summary>
          <div className="mt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="trip-price">Том хүний үндсэн үнэ (₮)</Label>
            <Input id="trip-price" type="number" min={0} value={form.price} onChange={(e) => set("price", e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Хоосон бол огноонуудын хамгийн бага үнийг авна.</p>
          </div>
          <div>
            <Label htmlFor="trip-adult-age">Том хүний нас</Label>
            <Input id="trip-adult-age" value={form.adultAge} onChange={(e) => {
              const adult = e.target.value;
              setForm((current) => ({ ...current, adultAge: adult, sourceMetadata: { ...current.sourceMetadata, age_rules: { ...object(current.sourceMetadata.age_rules), adult } } }));
            }} placeholder="ж: 12+ нас" />
          </div>
        </div>
        <details className="mt-4 border-t border-border pt-3">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Хямдрал, нэмэгдэл</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="trip-old-price">Хямдрахаас өмнөх үнэ (₮)</Label>
            <Input id="trip-old-price" type="number" min={0} value={form.oldPrice} onChange={(e) => set("oldPrice", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="trip-discount">Хямдрал (%)</Label>
            <Input id="trip-discount" type="number" min={0} max={100} value={form.discount} onChange={(e) => set("discount", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="trip-supplement">Ганц хүний нэмэгдэл (₮)</Label>
            <Input id="trip-supplement" type="number" min={0} value={form.singleSupplement} onChange={(e) => set("singleSupplement", e.target.value)} />
          </div>
        </div>
        </details>
        {!Array.isArray(form.sourceMetadata.price_groups) || form.sourceMetadata.price_groups.length === 0 ? (
          <PassengerPriceEditor
            rows={form.passengerPrices}
            onChange={(rows) => set("passengerPrices", rows)}
          />
        ) : null}
          </div>
        </details>
      </Section>

      <Section title="Чухал тэмдэглэл" hidden={activeSection !== "terms"}>
        <div>
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

      <Section title="Багцын мэдээлэл" hidden={activeSection !== "terms"}>
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
        </div>
      </Section>
      <Section title="Хоол" hidden={activeSection !== "terms"}>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="trip-food">Хоол багтсан эсэх</Label>
              <select
                id="trip-food"
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
        </div>
      </Section>
      <Section title="Аялагчид тавих нөхцөл" hidden={activeSection !== "terms"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="trip-departure-rule">Гарах өдрийн нөхцөл</Label>
            <Textarea id="trip-departure-rule" rows={2} value={form.departureRule} onChange={(e) => set("departureRule", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="trip-requirements">Шаардлага</Label>
            <Textarea id="trip-requirements" rows={3} value={form.requirements} onChange={(e) => set("requirements", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="trip-cancellation">Цуцлалтын нөхцөл</Label>
            <Textarea id="trip-cancellation" rows={3} value={form.cancellationPolicy} onChange={(e) => set("cancellationPolicy", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="trip-health-checkup">
              Эрүүл мэндийн шинжилгээ (ховор аялалд л бөглөнө, бусад аялалд хоосон үлдээнэ үү)
            </Label>
            <Textarea
              id="trip-health-checkup"
              rows={4}
              value={typeof form.sourceMetadata.health_checkup_notes === "string" ? form.sourceMetadata.health_checkup_notes : ""}
              onChange={(e) => set("sourceMetadata", { ...form.sourceMetadata, health_checkup_notes: e.target.value })}
              placeholder="Жишээ нь: энэ аялалд цусны ерөнхий шинжилгээ, зүрхний ЭКГ, B ultrasound зэрэг орно..."
            />
          </div>
        </div>
      </Section>

      <Section title="Зочид буудал" hidden={activeSection !== "media"}>
        <HotelProfilesEditor hotels={form.hotelProfiles} onChange={(hotels) => set("hotelProfiles", hotels)} />
      </Section>
      <Section title="Аялагчдын зураг, бичлэг" hidden={activeSection !== "media"}>
        <MediaListEditor
          label="Аялагчдын зураг, бичлэг, холбоос"
          items={form.travelerMedia}
          onChange={(v) => set("travelerMedia", v)}
        />
      </Section>

      <Section title="Өдөр тутмын хөтөлбөр" hidden={activeSection !== "itinerary"}>
        <ItineraryEditor days={form.itinerary} onChange={(v) => set("itinerary", v)} />
      </Section>

      {mode === "edit" && tripId && (
        <Section title="Цаг агаар" hidden={activeSection !== "itinerary"}>
          <WeatherPlacesEditor tripId={tripId} />
        </Section>
      )}

      <Section title="Нийтлэх" hidden={activeSection !== "publishing"}>
        <div className="grid max-w-2xl divide-y divide-border">
          <SwitchField
            label="Сайтад харагдана"
            description="Асаалттай үед аялал сайт дээр гарч, хүсэлт, захиалга авна. Унтраавал ноорог болж зөвхөн энд харагдана."
            checked={form.isPublished}
            onCheckedChange={(checked) => set("isPublished", checked)}
          />
          <SwitchField
            label="Онцлох аялал"
            description="Нүүр хуудасны онцлох аяллын хэсэгт гарна."
            checked={form.isFeatured}
            onCheckedChange={(checked) => set("isFeatured", checked)}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Өөрчлөлт доорх «Хадгалах» товчийг дарсны дараа сайтад гарна.</p>
      </Section>
      <Section title="Аяллын холбоос" hidden={activeSection !== "publishing"}>
        {form.slug && <a href={`/${locale}/trips/${encodeURIComponent(form.slug)}`} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-start gap-2 text-sm text-primary hover:underline">
          <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" /><span className="min-w-0 break-all">/{locale}/trips/{form.slug}</span>
        </a>}
        <details className="mt-4 border-t border-border pt-3">
          <summary className="cursor-pointer text-sm text-muted-foreground">Холбоосын хаяг засах</summary>
          <div className="mt-4 max-w-xl">
            <Label htmlFor="trip-address">Хаягийн нэр</Label>
            <Input id="trip-address" value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="Автоматаар үүснэ" />
          </div>
        </details>
      </Section>
      <Section title="Chatbot ба вебсайт" hidden={activeSection !== "review"}>
        {existingTrip ? <TripComparison trip={existingTrip} patch={form.sourceMetadata.canonicalExtraPatch} onExtraChange={(base, values) => set("sourceMetadata", {
          ...form.sourceMetadata, canonicalExtraPatch: { base: object(form.sourceMetadata.canonicalExtraPatch).base || base, values },
        })} /> : <p className="text-sm text-muted-foreground">Ноорог хадгалагдаагүй.</p>}
        {form.sourceTripId && <details className="mt-5 border-t border-border pt-3"><summary className="cursor-pointer text-sm text-muted-foreground">Техникийн мэдээлэл</summary><p className="mt-3 break-all font-mono text-xs text-muted-foreground">Chatbot ID: {form.sourceTripId}</p></details>}
      </Section>
      </div>
      <div className="sticky bottom-0 z-30 -mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card/95 px-4 py-3 shadow-[0_-4px_12px_-8px_rgba(0,0,0,0.15)] backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-3">
          {mode === "edit" && (
            <Button
              type="button"
              variant="ghost"
              onClick={deleteTrip}
              disabled={deleteMutation.isPending || saveMutation.isPending}
              title="Сайтаас нууж архивлах (түүх нь хадгалагдана)"
              className="gap-1.5 px-2.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              Архивлах
            </Button>
          )}
          {isDirty && (
            <span className="hidden items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-300 md:inline-flex">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500" />
              Хадгалаагүй өөрчлөлт байна
            </span>
          )}
        </div>
        <div className="ml-auto flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={leave} disabled={deleteMutation.isPending}>
            <span className="sm:hidden">Буцах</span>
            <span className="hidden sm:inline">{isDirty ? "Хадгалахгүй гарах" : "Жагсаалт руу буцах"}</span>
          </Button>
          <Button
            type="submit"
            disabled={saveMutation.isPending || deleteMutation.isPending || !isDirty}
            title={!isDirty ? "Өөрчлөлт хийгээгүй байна" : undefined}
            className="gap-1.5"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saveMutation.isPending ? "Хадгалж байна…" : mode === "create" ? "Аялал үүсгэх" : "Хадгалах"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function PassengerPriceEditor({
  rows,
  onChange,
  embedded = false,
}: {
  rows: PassengerPriceDraft[];
  onChange: (rows: PassengerPriceDraft[]) => void;
  embedded?: boolean;
}) {
  const update = (index: number, next: PassengerPriceDraft) =>
    onChange(rows.map((row, i) => (i === index ? next : row)));
  const addRow = (label: string) =>
    onChange([...rows, { label, ageRange: "", price: "", free: false }]);

  return (
    <div className={embedded ? "" : "space-y-3"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {!embedded && <h3 className="text-sm font-semibold">Хүүхэд / нярайн нас ба үнэ</h3>}
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
          <div key={index} className="grid grid-cols-2 items-end gap-3 border-b border-border py-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
            <div>
              <Label>Зорчигчийн нэр</Label>
              <Input
                aria-label="Зорчигчийн ангилал"
                value={passengerName({ label: row.label, age_range: row.ageRange })}
                onChange={(e) => update(index, { ...row, label: e.target.value })}
                placeholder="Хүүхэд, нярай"
              />
            </div>
            <div>
              <Label>Насны хүрээ</Label>
              <Input
                aria-label="Насны хүрээ"
                value={row.ageRange}
                onChange={(e) => update(index, { ...row, label: passengerName({ label: row.label, age_range: row.ageRange }), ageRange: e.target.value })}
                placeholder="ж: 2-5 нас"
              />
            </div>
            <div>
              <Label>Нэг хүний үнэ (₮)</Label>
              <Input
                aria-label={`${row.label || "Зорчигч"} үнэ`}
                type="number"
                min={0}
                value={row.free ? "" : row.price}
                disabled={row.free}
                onChange={(e) => update(index, { ...row, price: e.target.value })}
                placeholder={row.free ? "Үнэгүй" : "ж: 2390000"}
              />
            </div>
            <label className="flex min-h-9 items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={row.free}
                onChange={(e) => update(index, { ...row, free: e.target.checked, price: e.target.checked ? "" : row.price })}
                className="h-4 w-4 rounded border-input"
              />
              Үнэгүй
            </label>
            <div className="col-start-2 flex justify-end md:col-start-auto">
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

function Section({ title, children, hidden }: { title: string; children: React.ReactNode; hidden?: boolean }) {
  return (
    <section hidden={hidden} className="min-w-0">
      <h2 className="mb-4 border-b border-border pb-2 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}
