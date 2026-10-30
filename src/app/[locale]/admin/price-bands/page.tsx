"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowDown, ArrowUp, Coins, Loader2, Pencil, Plus, Trash2, Wand2 } from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { usePriceBands, type PriceBand } from "@/hooks/useTrips";
import { hasKnownTripPrice } from "@/lib/pricing";
import { formatMoney, formatNumber } from "@/lib/adminFormat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, FormField, LoadingRows, Notice, PageHeader, Panel, useConfirm } from "@/components/admin/ui";
import type { Trip } from "@/types/trip";

type FormState = { name: string; minPrice: string; maxPrice: string };
type FormErrors = Partial<Record<keyof FormState, string>>;
const EMPTY_FORM: FormState = { name: "", minPrice: "", maxPrice: "" };

function toAmount(value: string): number | null {
  const cleaned = value.replace(/[\s,]/g, "");
  if (!cleaned) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

/** "1 сая", "1.5 сая", "500 мянга" — how people say prices out loud. */
function spoken(value: number): string {
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))} сая`;
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(0))} мянга`;
  return formatNumber(value);
}

function suggestName(min: number, max: number | null): string {
  if (max === null) return `${spoken(min)}+`;
  if (min <= 0) return `${spoken(max)} хүртэл`;
  if (min >= 1_000_000 && max >= 1_000_000) return `${Number((min / 1_000_000).toFixed(1))}–${spoken(max)}`;
  return `${spoken(min)} – ${spoken(max)}`;
}

function rangeLabel(band: Pick<PriceBand, "minPrice" | "maxPrice">) {
  if (band.maxPrice === null) return `${formatMoney(band.minPrice)} ба түүнээс дээш`;
  return `${formatMoney(band.minPrice)} – ${formatMoney(band.maxPrice)}`;
}

/** Same membership rule as the storefront's price filter (TripsPageClient). */
function inBand(trip: Trip, band: Pick<PriceBand, "minPrice" | "maxPrice">) {
  if (!trip.isPublished || !hasKnownTripPrice(trip.price)) return false;
  if (trip.price < band.minPrice) return false;
  return band.maxPrice === null || trip.price <= band.maxPrice;
}

/**
 * Named price ranges ("0–1 сая", "2 сая+") staff define themselves. Never
 * stored on a trip — the storefront buckets a trip into a band by comparing
 * its live price, so editing a trip's price can't leave it in a stale band.
 */
export default function AdminPriceBandsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data: bands, isPending, isError, error, refetch } = usePriceBands({ admin: true });
  // Shares the trips list's cache: only used to show how many trips each range catches.
  const { data: trips } = useQuery<Trip[]>({
    queryKey: ["admin", "trips"],
    queryFn: async () => (await api.get<Trip[]>("/trips", { params: { all: "true" } })).data,
  });

  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["priceBands"] });
    queryClient.invalidateQueries({ queryKey: ["trips"] });
  };

  const createMutation = useMutation({
    mutationFn: async (body: { name: string; minPrice: number; maxPrice: number | null }) =>
      api.post("/price-bands", { name: body.name, minPrice: body.minPrice, maxPrice: body.maxPrice ?? undefined }),
    onSuccess: (_, body) => {
      invalidate();
      toast.success(`«${body.name}» шүүлтүүр нэмэгдлээ`);
      closeDialog();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Нэмэхэд алдаа гарлаа")),
  });

  const updateMutation = useMutation({
    mutationFn: async (body: { id: string; name: string; minPrice: number; maxPrice: number | null }) =>
      api.put("/price-bands", body),
    onSuccess: () => {
      invalidate();
      toast.success("Хадгалагдлаа");
      closeDialog();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Хадгалахад алдаа гарлаа")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (band: PriceBand) => api.delete("/price-bands", { data: { id: band.id } }),
    onSuccess: (_, band) => {
      invalidate();
      toast.success(`«${band.name}» устгагдлаа`);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Устгахад алдаа гарлаа")),
  });

  // Renumbers every band 0, 1, 2… rather than swapping two values: two bands
  // that share a sortOrder would otherwise swap into the same order and not move.
  const reorderMutation = useMutation({
    mutationFn: async (ordered: PriceBand[]) => {
      for (const [index, band] of ordered.entries()) {
        if (band.sortOrder !== index) await api.put("/price-bands", { id: band.id, sortOrder: index });
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success("Дараалал өөрчлөгдлөө");
    },
    onError: (err) => {
      invalidate();
      toast.error(apiErrorMessage(err, "Дараалал өөрчлөхөд алдаа гарлаа"));
    },
  });

  function closeDialog() {
    setDialogMode(null);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  function openCreate() {
    const last = bands?.[bands.length - 1];
    // Most new ranges start where the last one ended.
    setForm({ ...EMPTY_FORM, minPrice: last?.maxPrice != null ? String(last.maxPrice) : "" });
    setErrors({});
    setDialogMode("create");
  }

  function openEdit(band: PriceBand) {
    setEditingId(band.id);
    setErrors({});
    setForm({ name: band.name, minPrice: String(band.minPrice), maxPrice: band.maxPrice !== null ? String(band.maxPrice) : "" });
    setDialogMode("edit");
  }

  const min = toAmount(form.minPrice) ?? 0;
  const max = toAmount(form.maxPrice);
  const suggestion = suggestName(min, max);
  const previewCount = trips && (max === null || max > min) ? trips.filter((trip) => inBand(trip, { minPrice: min, maxPrice: max })).length : null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: FormErrors = {};
    if (!form.name.trim()) next.name = "Товчин дээр харагдах нэрийг бичнэ үү";
    if (form.minPrice.trim() && toAmount(form.minPrice) === null) next.minPrice = "Зөвхөн тоо оруулна уу";
    if (form.maxPrice.trim() && max === null) next.maxPrice = "Зөвхөн тоо оруулна уу";
    else if (max !== null && max <= min) next.maxPrice = "Дээд үнэ доод үнээс их байх ёстой";
    setErrors(next);
    if (Object.keys(next).length) return;

    const body = { name: form.name.trim(), minPrice: min, maxPrice: max };
    if (dialogMode === "create") createMutation.mutate(body);
    if (dialogMode === "edit" && editingId) updateMutation.mutate({ ...body, id: editingId });
  }

  async function askDelete(band: PriceBand) {
    const ok = await confirm({
      title: "Энэ шүүлтүүрийг устгах уу?",
      description: `«${band.name}» товч аяллын жагсаалтаас алга болно. Аяллууд өөрсдөө өөрчлөгдөхгүй.`,
      confirmLabel: "Устгах",
      tone: "danger",
    });
    if (ok) deleteMutation.mutate(band);
  }

  function move(index: number, direction: -1 | 1) {
    if (!bands || reorderMutation.isPending) return;
    const target = index + direction;
    if (target < 0 || target >= bands.length) return;
    const ordered = [...bands];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    reorderMutation.mutate(ordered);
  }

  const overlaps = useMemo(() => {
    const list = bands ?? [];
    const found: string[] = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const aMax = a.maxPrice ?? Infinity;
        const bMax = b.maxPrice ?? Infinity;
        if (a.minPrice < bMax && b.minPrice < aMax) found.push(`«${a.name}» ба «${b.name}»`);
      }
    }
    return found;
  }, [bands]);

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <PageHeader
        title="Үнийн шүүлтүүр"
        description="Сайтын «Аялалууд» хуудсан дээрх үнийн товчнууд — жишээ нь «1 сая хүртэл», «1–2 сая», «2 сая+». Аялал аль товчинд орохыг тухайн аяллын одоогийн үнээр автоматаар тооцно, тиймээс аялал бүрт тусад нь тохируулах шаардлагагүй."
        actions={
          <Button onClick={openCreate}>
            <Plus />
            Шүүлтүүр нэмэх
          </Button>
        }
      />

      {overlaps.length > 0 && (
        <Notice tone="warning" icon={AlertTriangle} className="mb-4" title="Зарим үнийн хүрээ давхцаж байна">
          {overlaps.join(", ")}. Нэг аялал хоёр товчинд зэрэг орох тул хүрээг нь засахыг зөвлөж байна.
        </Notice>
      )}

      <Panel bodyClassName="p-0 sm:p-0">
        {isPending ? (
          <LoadingRows rows={3} className="p-4" rowClassName="h-12" />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : !bands?.length ? (
          <EmptyState
            icon={Coins}
            title="Үнийн шүүлтүүр хараахан алга"
            description="Нэмсэн шүүлтүүрүүд сайтын аяллын жагсаалт дээр товч болж харагдана."
            action={
              <Button onClick={openCreate}>
                <Plus />
                Эхний шүүлтүүрээ нэмэх
              </Button>
            }
          />
        ) : (
          <>
            <p className="border-b border-border px-4 py-2.5 text-sm text-muted-foreground">
              Сайт дээр энэ дарааллаар харагдана. Дарааллыг «Дээш», «Доош» товчоор өөрчилнө.
            </p>
            <ol className="divide-y divide-border">
              {bands.map((band, index) => {
                const count = trips ? trips.filter((trip) => inBand(trip, band)).length : null;
                return (
                  <li key={band.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold tabular-nums">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{band.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{rangeLabel(band)}</p>
                    </div>
                    {count !== null && (
                      <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs tabular-nums text-muted-foreground" title="Энэ хүрээнд орж буй нийтлэгдсэн аялал">
                        {count} аялал
                      </span>
                    )}
                    <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
                      <Button size="sm" variant="ghost" disabled={index === 0 || reorderMutation.isPending} onClick={() => move(index, -1)} title="Дээш зөөх">
                        <ArrowUp />
                        <span className="hidden lg:inline">Дээш</span>
                        <span className="sr-only lg:hidden">Дээш зөөх</span>
                      </Button>
                      <Button size="sm" variant="ghost" disabled={index === bands.length - 1 || reorderMutation.isPending} onClick={() => move(index, 1)} title="Доош зөөх">
                        <ArrowDown />
                        <span className="hidden lg:inline">Доош</span>
                        <span className="sr-only lg:hidden">Доош зөөх</span>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(band)}>
                        <Pencil />
                        Засах
                      </Button>
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => askDelete(band)}>
                        <Trash2 />
                        <span className="hidden sm:inline">Устгах</span>
                        <span className="sr-only sm:hidden">Устгах</span>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </Panel>

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader className="text-left">
              <DialogTitle>{dialogMode === "edit" ? "Шүүлтүүр засах" : "Шинэ үнийн шүүлтүүр"}</DialogTitle>
              <DialogDescription>Үнийн хүрээгээ оруулна. Дээд үнийг хоосон орхивол доод үнээс дээш бүх аялал орно.</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Доод үнэ (₮)" error={errors.minPrice} hint={min > 0 ? `= ${formatMoney(min)}` : "Хоосон бол 0₮"}>
                <Input
                  inputMode="numeric"
                  value={form.minPrice}
                  onChange={(e) => setForm((f) => ({ ...f, minPrice: e.target.value }))}
                  placeholder="0"
                  autoFocus
                />
              </FormField>
              <FormField label="Дээд үнэ (₮)" error={errors.maxPrice} hint={max !== null ? `= ${formatMoney(max)}` : "Хоосон бол дээд хязгааргүй"}>
                <Input
                  inputMode="numeric"
                  value={form.maxPrice}
                  onChange={(e) => setForm((f) => ({ ...f, maxPrice: e.target.value }))}
                  placeholder="Хязгааргүй"
                />
              </FormField>
            </div>

            <FormField label="Товчин дээр харагдах нэр" required error={errors.name}>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={`ж: ${suggestion}`} />
            </FormField>
            {form.name.trim() !== suggestion && (form.minPrice.trim() || form.maxPrice.trim()) && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, name: suggestion }))}
                className="-mt-2 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <Wand2 className="h-3.5 w-3.5" />
                «{suggestion}» гэж нэрлэх
              </button>
            )}

            {previewCount !== null && (
              <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
                Одоогийн үнээр <strong className="tabular-nums">{previewCount}</strong> нийтлэгдсэн аялал энэ хүрээнд орно.
              </p>
            )}

            <DialogFooter className="gap-2 sm:space-x-0">
              <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
                Болих
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                {dialogMode === "edit" ? "Хадгалах" : "Шүүлтүүр нэмэх"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
