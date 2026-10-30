"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MessageSquareQuote, Pencil, Plus, Star, Trash2 } from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  EmptyState,
  ErrorState,
  FilterChips,
  FormField,
  LoadingRows,
  PageHeader,
  Panel,
  SearchInput,
  SelectFilter,
  StatusBadge,
  Switch,
  selectClassName,
  useConfirm,
} from "@/components/admin/ui";
import { LIVE_QUERY } from "@/hooks/useAdminSummary";
import { formatDate, formatMonthYear, formatNumber } from "@/lib/adminFormat";
import type { Testimonial, Trip } from "@/types/trip";
import { cn } from "@/lib/utils";

type FormState = {
  tripId: string;
  authorName: string;
  rating: number;
  comment: string;
  travelMonth: string;
};
type FormErrors = Partial<Record<"authorName" | "comment", string>>;

const EMPTY_FORM: FormState = { tripId: "", authorName: "", rating: 5, comment: "", travelMonth: "" };
const RATING_WORDS = ["", "Муу", "Дунд зэрэг", "Сайн", "Маш сайн", "Гайхалтай"];

function StarRow({ rating, size = "h-3.5 w-3.5" }: { rating: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} од`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn(size, i < rating ? "fill-gold text-gold" : "text-muted-foreground/30")} />
      ))}
    </span>
  );
}

export default function AdminTestimonialsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const testimonials = useQuery<Testimonial[]>({
    queryKey: ["admin", "testimonials"],
    queryFn: async () => (await api.get<Testimonial[]>("/testimonials")).data,
    ...LIVE_QUERY,
  });
  const { data: trips } = useQuery<Trip[]>({
    queryKey: ["admin", "trips"],
    queryFn: async () => (await api.get<Trip[]>("/trips", { params: { all: "true" } })).data,
  });

  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<"all" | "published" | "hidden">("all");
  const [search, setSearch] = useState("");
  const [tripFilter, setTripFilter] = useState("all");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "testimonials"] });
    queryClient.invalidateQueries({ queryKey: ["trips"] });
    queryClient.invalidateQueries({ queryKey: ["trip"] });
  };

  const createMutation = useMutation({
    mutationFn: async (body: FormState) =>
      api.post("/testimonials", {
        tripId: body.tripId || undefined,
        authorName: body.authorName.trim(),
        rating: body.rating,
        comment: body.comment.trim(),
        travelDate: body.travelMonth ? `${body.travelMonth}-01` : undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Сэтгэгдэл нэмэгдэж, сайтад харагдах боллоо");
      closeDialog();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Нэмэхэд алдаа гарлаа")),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body, travelChanged }: { id: string; body: FormState; travelChanged: boolean }) =>
      api.put("/testimonials", {
        id,
        authorName: body.authorName.trim(),
        rating: body.rating,
        comment: body.comment.trim(),
        // Only sent when edited, so an untouched date keeps its exact day.
        ...(travelChanged ? { travelDate: body.travelMonth ? `${body.travelMonth}-01` : "" } : {}),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Сэтгэгдэл хадгалагдлаа");
      closeDialog();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Хадгалахад алдаа гарлаа")),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean; name: string }) =>
      api.put("/testimonials", { id, isPublished }),
    onSuccess: (_, { id, isPublished, name }) => {
      invalidate();
      toast.success(isPublished ? `${name}: сэтгэгдэл сайтад харагдах боллоо` : `${name}: сэтгэгдлийг сайтаас нууллаа`, {
        duration: 8000,
        action: { label: "Буцаах", onClick: () => toggleMutation.mutate({ id, isPublished: !isPublished, name }) },
      });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Өөрчлөхөд алдаа гарлаа")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete("/testimonials", { data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Сэтгэгдэл устгагдлаа");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Устгахад алдаа гарлаа")),
  });

  function closeDialog() {
    setDialogMode(null);
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setErrors({});
    setEditing(null);
    setDialogMode("create");
  }

  function openEdit(t: Testimonial) {
    setEditing(t);
    setErrors({});
    setForm({
      tripId: t.tripId ?? "",
      authorName: t.authorName,
      rating: t.rating,
      comment: t.comment,
      travelMonth: t.travelDate ? t.travelDate.slice(0, 7) : "",
    });
    setDialogMode("edit");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: FormErrors = {};
    if (!form.authorName.trim()) next.authorName = "Сэтгэгдэл үлдээсэн хүний нэрийг бичнэ үү";
    if (!form.comment.trim()) next.comment = "Сэтгэгдлийн бичвэрийг оруулна уу";
    setErrors(next);
    if (Object.keys(next).length) return;

    if (dialogMode === "create") createMutation.mutate(form);
    if (dialogMode === "edit" && editing) {
      const originalMonth = editing.travelDate ? editing.travelDate.slice(0, 7) : "";
      updateMutation.mutate({ id: editing.id, body: form, travelChanged: form.travelMonth !== originalMonth });
    }
  }

  async function askDelete(t: Testimonial) {
    const ok = await confirm({
      title: "Энэ сэтгэгдлийг устгах уу?",
      description: `«${t.authorName}» нэртэй аялагчийн сэтгэгдэл бүрмөсөн устна. Түр нуух бол «Сайтад» унтраалгыг унтраахад хангалттай.`,
      confirmLabel: "Устгах",
      tone: "danger",
    });
    if (ok) deleteMutation.mutate(t.id);
  }

  const all = useMemo(() => testimonials.data ?? [], [testimonials.data]);
  const published = all.filter((t) => t.isPublished);
  const average = published.length ? published.reduce((sum, t) => sum + t.rating, 0) / published.length : 0;

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return all.filter((t) => {
      if (status === "published" && !t.isPublished) return false;
      if (status === "hidden" && t.isPublished) return false;
      if (tripFilter === "none" && t.tripId) return false;
      if (tripFilter !== "all" && tripFilter !== "none" && t.tripId !== tripFilter) return false;
      if (!term) return true;
      return [t.authorName, t.comment, t.trip?.title].filter(Boolean).join(" ").toLocaleLowerCase().includes(term);
    });
  }, [all, status, tripFilter, search]);

  const tripOptions = useMemo(() => {
    const titles = new Map<string, string>();
    for (const t of all) if (t.tripId && t.trip && !titles.has(t.tripId)) titles.set(t.tripId, t.trip.title);
    return [...titles].map(([value, label]) => ({ value, label }));
  }, [all]);

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <PageHeader
        title="Сэтгэгдлүүд"
        description="Аялагчдаас утсаар, чатаар авсан сэтгэгдлийг энд оруулна. Сайтад харагдаж буй сэтгэгдэл тухайн аяллын үнэлгээг (одыг) автоматаар шинэчилнэ."
        actions={
          <Button onClick={openCreate}>
            <Plus />
            Сэтгэгдэл нэмэх
          </Button>
        }
      />

      {published.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-sm">
          <span className="inline-flex items-center gap-2">
            <StarRow rating={Math.round(average)} size="h-4 w-4" />
            <strong className="tabular-nums">{average.toFixed(1)}</strong>
            <span className="text-muted-foreground">дундаж үнэлгээ</span>
          </span>
          <span className="text-muted-foreground">
            {formatNumber(published.length)} сэтгэгдэл сайтад харагдаж байна
            {all.length > published.length && `, ${formatNumber(all.length - published.length)} нуусан`}
          </span>
        </div>
      )}

      <div className="space-y-3">
        <FilterChips
          label="Сэтгэгдэл шүүх"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Бүгд", count: all.length },
            { value: "published", label: "Сайтад харагдаж буй", count: published.length },
            { value: "hidden", label: "Нуусан", count: all.length - published.length },
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput className="flex-1" value={search} onChange={setSearch} placeholder="Нэр, сэтгэгдэл эсвэл аяллаар хайх" />
          <SelectFilter
            label="Аяллаар шүүх"
            value={tripFilter}
            onChange={setTripFilter}
            options={[{ value: "all", label: "Бүх аялал" }, { value: "none", label: "Ерөнхий (аялалгүй)" }, ...tripOptions]}
            className="sm:max-w-xs"
          />
        </div>
      </div>

      <Panel className="mt-4" bodyClassName="p-0 sm:p-0">
        {testimonials.isPending ? (
          <LoadingRows rows={4} className="p-4" rowClassName="h-20" />
        ) : testimonials.isError ? (
          <ErrorState error={testimonials.error} onRetry={() => testimonials.refetch()} />
        ) : !all.length ? (
          <EmptyState
            icon={MessageSquareQuote}
            title="Сэтгэгдэл хараахан алга"
            description="Аялагчдын сайн сэтгэгдлийг нэмбэл сайтын нүүр хуудас болон аяллын хуудсанд харагдаж, итгэл төрүүлнэ."
            action={
              <Button onClick={openCreate}>
                <Plus />
                Эхний сэтгэгдлээ нэмэх
              </Button>
            }
          />
        ) : !visible.length ? (
          <EmptyState
            icon={MessageSquareQuote}
            title="Тохирох сэтгэгдэл олдсонгүй"
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                  setTripFilter("all");
                }}
              >
                Шүүлтүүрийг арилгах
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((t) => (
              <li key={t.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="text-sm font-semibold">{t.authorName}</span>
                    <StarRow rating={t.rating} />
                    {!t.isPublished && <StatusBadge tone="neutral">Нуусан</StatusBadge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.trip ? t.trip.title : "Ерөнхий сэтгэгдэл (аялалгүй)"}
                    {t.travelDate && ` · аялсан: ${formatMonthYear(t.travelDate)}`}
                    {` · нэмсэн: ${formatDate(t.createdAt)}`}
                  </p>
                  <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-foreground/80">{t.comment}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={t.isPublished}
                      disabled={toggleMutation.isPending && toggleMutation.variables?.id === t.id}
                      onCheckedChange={(isPublished) => toggleMutation.mutate({ id: t.id, isPublished, name: t.authorName })}
                      label={`Сайтад харагдана: ${t.authorName}`}
                    />
                    <span>Сайтад</span>
                  </label>
                  <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                    <Pencil />
                    Засах
                  </Button>
                  <Button size="sm" variant="ghost" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => askDelete(t)}>
                    <Trash2 />
                    Устгах
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader className="text-left">
              <DialogTitle>{dialogMode === "edit" ? "Сэтгэгдэл засах" : "Шинэ сэтгэгдэл"}</DialogTitle>
              <DialogDescription>
                {dialogMode === "edit"
                  ? "Нэр, үнэлгээ, бичвэрийг засна. Аяллыг нь өөрчлөх бол устгаад шинээр нэмнэ үү."
                  : "Нэмсэн даруйд сайтад харагдана. Түр нуух бол жагсаалтаас «Сайтад» унтраалгыг унтраана."}
              </DialogDescription>
            </DialogHeader>

            {dialogMode === "create" && (
              <FormField label="Аль аяллын сэтгэгдэл вэ" hint="Сонговол тухайн аяллын хуудсанд харагдаж, үнэлгээнд нь тооцогдоно.">
                <select value={form.tripId} onChange={(e) => setForm((f) => ({ ...f, tripId: e.target.value }))} className={selectClassName}>
                  <option value="">Ерөнхий сэтгэгдэл (аялалгүй)</option>
                  {trips?.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.title}
                      {!trip.isPublished ? " (ноорог)" : ""}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            <FormField label="Аялагчийн нэр" required error={errors.authorName} hint="Сайтад яг ингэж харагдана, жишээ нь «Б. Сарнай».">
              <Input
                value={form.authorName}
                onChange={(e) => {
                  setForm((f) => ({ ...f, authorName: e.target.value }));
                  setErrors((current) => ({ ...current, authorName: undefined }));
                }}
                autoFocus
              />
            </FormField>

            <div>
              <p className="mb-1.5 text-sm font-medium" id="rating-label">
                Үнэлгээ
              </p>
              <div role="radiogroup" aria-labelledby="rating-label" className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={form.rating === value}
                    aria-label={`${value} од — ${RATING_WORDS[value]}`}
                    onClick={() => setForm((f) => ({ ...f, rating: value }))}
                    className="rounded-md p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Star className={cn("h-7 w-7", value <= form.rating ? "fill-gold text-gold" : "text-muted-foreground/40")} />
                  </button>
                ))}
                <span className="ml-2 text-sm text-muted-foreground">
                  {form.rating}/5 · {RATING_WORDS[form.rating]}
                </span>
              </div>
            </div>

            <FormField label="Сэтгэгдэл" required error={errors.comment} hint={`${form.comment.trim().length} тэмдэгт`}>
              <Textarea
                rows={5}
                value={form.comment}
                onChange={(e) => {
                  setForm((f) => ({ ...f, comment: e.target.value }));
                  setErrors((current) => ({ ...current, comment: undefined }));
                }}
                placeholder="Аялагчийн хэлсэн үгийг яг хэвээр нь бичнэ үү"
              />
            </FormField>

            <FormField label="Аялсан сар" hint="Заавал биш. Сэтгэгдлийн доор «2026 оны 9-р сар» гэх мэтээр харагдана.">
              <Input type="month" value={form.travelMonth} onChange={(e) => setForm((f) => ({ ...f, travelMonth: e.target.value }))} className="max-w-[12rem]" />
            </FormField>

            <DialogFooter className="gap-2 sm:space-x-0">
              <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
                Болих
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                {dialogMode === "edit" ? "Хадгалах" : "Сэтгэгдэл нэмэх"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
