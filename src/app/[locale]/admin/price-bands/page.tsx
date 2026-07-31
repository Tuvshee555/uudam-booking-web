"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Coins, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { usePriceBands, type PriceBand } from "@/hooks/useTrips";
import { formatMnt } from "@/lib/pricing";
import AdminShell from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FormState = { name: string; minPrice: string; maxPrice: string };
const EMPTY_FORM: FormState = { name: "", minPrice: "", maxPrice: "" };

/**
 * Named price ranges ("0–1 сая", "2 сая+") staff define themselves. Never
 * stored on a trip — the storefront buckets a trip into a band by comparing
 * its live price, so editing a trip's price can't leave it in a stale band.
 */
export default function AdminPriceBandsPage() {
  const queryClient = useQueryClient();
  const { data: bands, isPending } = usePriceBands();

  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["priceBands"] });
    queryClient.invalidateQueries({ queryKey: ["trips"] });
  };

  const createMutation = useMutation({
    mutationFn: async (body: FormState) =>
      api.post("/price-bands", {
        name: body.name,
        minPrice: body.minPrice || 0,
        maxPrice: body.maxPrice || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Үнийн ангилал нэмлээ");
      closeDialog();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Нэмэхэд алдаа гарлаа")),
  });

  const updateMutation = useMutation({
    mutationFn: async (body: FormState & { id: string }) =>
      api.put("/price-bands", {
        id: body.id,
        name: body.name,
        minPrice: body.minPrice || 0,
        maxPrice: body.maxPrice || null,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Хадгаллаа");
      closeDialog();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Хадгалахад алдаа гарлаа")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete("/price-bands", { data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Устгалаа");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Устгахад алдаа гарлаа")),
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, sortOrder }: { id: string; sortOrder: number }) =>
      api.put("/price-bands", { id, sortOrder }),
    onSuccess: invalidate,
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

  function openEdit(band: PriceBand) {
    setEditingId(band.id);
    setForm({
      name: band.name,
      minPrice: String(band.minPrice),
      maxPrice: band.maxPrice !== null ? String(band.maxPrice) : "",
    });
    setDialogMode("edit");
  }

  function submit() {
    if (!form.name.trim()) {
      toast.error("Нэрээ оруулна уу");
      return;
    }
    if (form.maxPrice && Number(form.maxPrice) <= Number(form.minPrice || 0)) {
      toast.error("Дээд үнэ доод үнээс их байх ёстой");
      return;
    }
    if (dialogMode === "create") createMutation.mutate(form);
    if (dialogMode === "edit" && editingId) updateMutation.mutate({ ...form, id: editingId });
  }

  function askDelete(band: PriceBand) {
    if (window.confirm(`"${band.name}"-г устгах уу?`)) deleteMutation.mutate(band.id);
  }

  function move(index: number, direction: -1 | 1) {
    if (!bands) return;
    const target = bands[index + direction];
    const current = bands[index];
    if (!target) return;
    reorderMutation.mutate({ id: current.id, sortOrder: target.sortOrder });
    reorderMutation.mutate({ id: target.id, sortOrder: current.sortOrder });
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Үнийн ангилал</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Жишээ нь &ldquo;0–1 сая&rdquo;, &ldquo;2 сая+&rdquo; — аяллын одоогийн үнээр автоматаар бүлэглэнэ, тодорхой аялалд тогтмол хадгалагдахгүй.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Ангилал нэмэх
        </Button>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-card p-2">
        {isPending ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        ) : !bands?.length ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <Coins className="h-8 w-8 opacity-40" />
            Үнийн ангилал алга байна.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {bands.map((band, index) => (
              <div key={band.id} className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-secondary/60">
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="rounded p-0.5 text-muted-foreground hover:text-primary disabled:opacity-20"
                    aria-label="Дээш"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === bands.length - 1}
                    onClick={() => move(index, 1)}
                    className="rounded p-0.5 text-muted-foreground hover:text-primary disabled:opacity-20"
                    aria-label="Доош"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                <span className="min-w-0 flex-1 truncate text-sm font-medium">{band.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatMnt(band.minPrice)} – {band.maxPrice !== null ? formatMnt(band.maxPrice) : "∞"}
                </span>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(band)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary"
                    aria-label="Засах"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => askDelete(band)}
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
            <DialogTitle>{dialogMode === "edit" ? "Ангилал засах" : "Шинэ үнийн ангилал"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="bandName">Нэр</Label>
              <Input
                id="bandName"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="ж: 0–1 сая"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="minPrice">Доод үнэ (₮)</Label>
                <Input
                  id="minPrice"
                  type="number"
                  min={0}
                  value={form.minPrice}
                  onChange={(e) => setForm((f) => ({ ...f, minPrice: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="maxPrice">Дээд үнэ (₮)</Label>
                <Input
                  id="maxPrice"
                  type="number"
                  min={0}
                  value={form.maxPrice}
                  onChange={(e) => setForm((f) => ({ ...f, maxPrice: e.target.value }))}
                  placeholder="хязгааргүй бол хоосон орхино"
                />
              </div>
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
