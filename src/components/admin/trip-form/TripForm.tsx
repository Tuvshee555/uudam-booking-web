"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
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
  return iso.slice(0, 10);
}

type FormState = {
  title: string;
  slug: string;
  summary: string;
  description: string;
  categoryId: string;
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

  sourceTripId: string;
  hotel: string;
  foodIncluded: string;
  departureRule: string;
  extraFees: string[];
  roomPrices: string[];
  childPriceNotes: string[];
  brochurePdfUrl: string;

  isFeatured: boolean;
  isPublished: boolean;

  itinerary: ItineraryDraft[];
  departures: DepartureDraft[];
};

const EMPTY_FORM: FormState = {
  title: "",
  slug: "",
  summary: "",
  description: "",
  categoryId: "",
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
  sourceTripId: "",
  hotel: "",
  foodIncluded: "",
  departureRule: "",
  extraFees: [],
  roomPrices: [],
  childPriceNotes: [],
  brochurePdfUrl: "",
  isFeatured: false,
  isPublished: true,
  itinerary: [],
  departures: [],
};

function tripToForm(trip: Trip): FormState {
  return {
    title: trip.title,
    slug: trip.slug,
    summary: trip.summary ?? "",
    description: trip.description,
    categoryId: trip.categoryId ?? "",
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
    sourceTripId: trip.sourceTripId ?? "",
    hotel: trip.hotel ?? "",
    foodIncluded:
      trip.foodIncluded === true ? "true" : trip.foodIncluded === false ? "false" : "",
    departureRule: trip.departureRule ?? "",
    extraFees: trip.extraFees,
    roomPrices: trip.roomPrices,
    childPriceNotes: trip.childPriceNotes,
    brochurePdfUrl: trip.brochurePdfUrl ?? "",
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
    departures: trip.departures.map((dep) => ({
      id: dep.id,
      startDate: toDateInput(dep.startDate),
      endDate: toDateInput(dep.endDate),
      seatsTotal: dep.seatsTotal !== null ? String(dep.seatsTotal) : "",
      seatsLeft: dep.seatsLeft !== null ? String(dep.seatsLeft) : "",
      price: dep.price !== null ? String(dep.price) : "",
      childPrice: dep.childPrice !== null ? String(dep.childPrice) : "",
      status: dep.status,
    })),
  };
}

function numOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function buildPayload(form: FormState) {
  return {
    title: form.title.trim(),
    slug: form.slug.trim() || undefined,
    summary: form.summary.trim() || undefined,
    description: form.description.trim(),
    categoryId: form.categoryId || undefined,
    tagIds: form.tagIds,

    country: form.country.trim() || undefined,
    city: form.city.trim() || undefined,
    region: form.region.trim() || undefined,
    destinations: form.destinations,
    meetingPoint: form.meetingPoint.trim() || undefined,
    mapUrl: form.mapUrl.trim() || undefined,

    durationDays: numOrUndefined(form.durationDays),
    durationNights: numOrUndefined(form.durationNights),
    minTravelers: numOrUndefined(form.minTravelers),
    maxTravelers: numOrUndefined(form.maxTravelers),
    difficulty: form.difficulty,
    transport: form.transport,
    languages: form.languages,
    season: form.season.trim() || undefined,

    highlights: form.highlights,
    included: form.included,
    excluded: form.excluded,
    requirements: form.requirements.trim() || undefined,
    cancellationPolicy: form.cancellationPolicy.trim() || undefined,
    importantNotes: form.importantNotes,

    image: form.image.trim(),
    extraImages: form.extraImages,
    video: form.video.trim() || undefined,
    videos: form.videos,

    price: numOrUndefined(form.price),
    oldPrice: numOrUndefined(form.oldPrice),
    discount: numOrUndefined(form.discount),
    childPrice: numOrUndefined(form.childPrice),
    infantPrice: numOrUndefined(form.infantPrice),
    singleSupplement: numOrUndefined(form.singleSupplement),
    sourceTripId: form.sourceTripId.trim() || undefined,
    hotel: form.hotel.trim() || undefined,
    foodIncluded:
      form.foodIncluded === "true" ? true : form.foodIncluded === "false" ? false : undefined,
    departureRule: form.departureRule.trim() || undefined,
    extraFees: form.extraFees,
    roomPrices: form.roomPrices,
    childPriceNotes: form.childPriceNotes,
    brochurePdfUrl: form.brochurePdfUrl.trim() || undefined,

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
        endDate: dep.endDate || undefined,
        seatsTotal: numOrUndefined(dep.seatsTotal),
        seatsLeft: numOrUndefined(dep.seatsLeft),
        price: numOrUndefined(dep.price),
        childPrice: numOrUndefined(dep.childPrice),
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
          <div>
            <Label>Ангилал</Label>
            <select
              value={form.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— Ангилалгүй —</option>
              {categoryOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
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
            <Label>Хуучин үнэ (хямдралтай бол)</Label>
            <Input type="number" min={0} value={form.oldPrice} onChange={(e) => set("oldPrice", e.target.value)} />
          </div>
          <div>
            <Label>Хямдрал (%)</Label>
            <Input type="number" min={0} max={100} value={form.discount} onChange={(e) => set("discount", e.target.value)} />
          </div>
          <div>
            <Label>Хүүхдийн үнэ</Label>
            <Input type="number" min={0} value={form.childPrice} onChange={(e) => set("childPrice", e.target.value)} />
          </div>
          <div>
            <Label>Нярайн үнэ</Label>
            <Input type="number" min={0} value={form.infantPrice} onChange={(e) => set("infantPrice", e.target.value)} />
          </div>
          <div>
            <Label>Ганц хүний нэмэгдэл</Label>
            <Input type="number" min={0} value={form.singleSupplement} onChange={(e) => set("singleSupplement", e.target.value)} />
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
          <StringListField label="Чухал тэмдэглэл" values={form.importantNotes} onChange={(v) => set("importantNotes", v)} />
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

      <div className="sticky bottom-4 flex justify-end gap-2 rounded-xl border border-border bg-card p-3 shadow-lg">
        <Button type="button" variant="outline" onClick={() => router.push(`/${locale}/admin/trips`)}>
          Цуцлах
        </Button>
        <Button type="submit" disabled={saveMutation.isPending} className="gap-1.5">
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "create" ? "Аялал үүсгэх" : "Хадгалах"}
        </Button>
      </div>
    </form>
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
