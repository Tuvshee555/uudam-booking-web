"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, MessageSquareQuote, Pencil, Plus, Star, Trash2 } from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import AdminShell from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Testimonial, Trip } from "@/types/trip";
import { cn } from "@/lib/utils";

type FormState = {
  tripId: string;
  authorName: string;
  rating: string;
  comment: string;
};

const EMPTY_FORM: FormState = { tripId: "", authorName: "", rating: "5", comment: "" };

function useTestimonials() {
  return useQuery<Testimonial[]>({
    queryKey: ["admin", "testimonials"],
    queryFn: async () => (await api.get<Testimonial[]>("/testimonials")).data,
  });
}

function useAllTrips() {
  return useQuery<Trip[]>({
    queryKey: ["admin", "trips"],
    queryFn: async () => (await api.get<Trip[]>("/trips", { params: { all: "true" } })).data,
  });
}

export default function AdminTestimonialsPage() {
  const queryClient = useQueryClient();
  const { data: testimonials, isPending } = useTestimonials();
  const { data: trips } = useAllTrips();

  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "testimonials"] });
    queryClient.invalidateQueries({ queryKey: ["trips"] });
    queryClient.invalidateQueries({ queryKey: ["trip"] });
  };

  const createMutation = useMutation({
    mutationFn: async (body: FormState) =>
      api.post("/testimonials", {
        tripId: body.tripId || undefined,
        authorName: body.authorName,
        rating: Number(body.rating),
        comment: body.comment,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Сэтгэгдэл нэмлээ");
      closeDialog();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Нэмэхэд алдаа гарлаа")),
  });

  const updateMutation = useMutation({
    mutationFn: async (body: FormState & { id: string }) =>
      api.put("/testimonials", {
        id: body.id,
        authorName: body.authorName,
        rating: Number(body.rating),
        comment: body.comment,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Хадгаллаа");
      closeDialog();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Хадгалахад алдаа гарлаа")),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      api.put("/testimonials", { id, isPublished }),
    onSuccess: invalidate,
    onError: (err) => toast.error(apiErrorMessage(err, "Алдаа гарлаа")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete("/testimonials", { data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Устгалаа");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Устгахад алдаа гарлаа")),
  });

  function closeDialog() {
    setDialogMode(null);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setDialogMode("create");
  }

  function openEdit(t: Testimonial) {
    setEditingId(t.id);
    setForm({
      tripId: t.tripId ?? "",
      authorName: t.authorName,
      rating: String(t.rating),
      comment: t.comment,
    });
    setDialogMode("edit");
  }

  function submit() {
    if (!form.authorName.trim()) return toast.error("Нэрийг оруулна уу");
    if (!form.comment.trim()) return toast.error("Сэтгэгдэл оруулна уу");

    if (dialogMode === "create") createMutation.mutate(form);
    if (dialogMode === "edit" && editingId) updateMutation.mutate({ ...form, id: editingId });
  }

  function askDelete(t: Testimonial) {
    if (window.confirm(`"${t.authorName}"-ын сэтгэгдлийг устгах уу?`)) deleteMutation.mutate(t.id);
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Сэтгэгдлүүд</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Харилцагчаас утсаар/чатаар авсан сэтгэгдлийг энд оруулна. Нийтэд харагдах сэтгэгдэл тухайн аяллын үнэлгээг автоматаар шинэчилнэ.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Сэтгэгдэл нэмэх
        </Button>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-card p-2">
        {isPending ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        ) : !testimonials?.length ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <MessageSquareQuote className="h-8 w-8 opacity-40" />
            Сэтгэгдэл алга байна.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {testimonials.map((t) => (
              <div key={t.id} className="flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-secondary/60">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{t.authorName}</span>
                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                      {Array.from({ length: t.rating }).map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-gold text-gold" />
                      ))}
                    </span>
                    {t.trip && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                        {t.trip.title}
                      </span>
                    )}
                    {!t.isPublished && (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                        Нуугдмал
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.comment}</p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate({ id: t.id, isPublished: !t.isPublished })}
                    className={cn(
                      "rounded-lg p-1.5 hover:bg-secondary",
                      t.isPublished ? "text-primary" : "text-muted-foreground",
                    )}
                    aria-label={t.isPublished ? "Нуух" : "Нийтлэх"}
                    title={t.isPublished ? "Нуух" : "Нийтлэх"}
                  >
                    {t.isPublished ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(t)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary"
                    aria-label="Засах"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => askDelete(t)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Устгах"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMode === "edit" ? "Сэтгэгдэл засах" : "Шинэ сэтгэгдэл"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {dialogMode === "create" && (
              <div>
                <Label htmlFor="tripId">Аялал (заавал биш)</Label>
                <select
                  id="tripId"
                  value={form.tripId}
                  onChange={(e) => setForm((f) => ({ ...f, tripId: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— Ерөнхий (аялалгүй) —</option>
                  {trips?.map((trip) => (
                    <option key={trip.id} value={trip.id}>{trip.title}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label htmlFor="authorName">Харилцагчийн нэр</Label>
              <Input
                id="authorName"
                value={form.authorName}
                onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
                autoFocus
              />
            </div>

            <div>
              <Label htmlFor="rating">Үнэлгээ</Label>
              <select
                id="rating"
                value={form.rating}
                onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>{n} од</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="comment">Сэтгэгдэл</Label>
              <Textarea
                id="comment"
                rows={4}
                value={form.comment}
                onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Цуцлах
            </Button>
            <Button onClick={submit} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {dialogMode === "edit" ? "Хадгалах" : "Үүсгэх"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
