"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Tag as TagIcon, Trash2 } from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { useTags } from "@/hooks/useTrips";
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

/**
 * Free-form trip labels ("Галт тэрэг", "Хямдралтай" …) — starts empty, staff
 * create every one of them. Unlike Category (a tree, one slot per trip) this
 * is flat and a trip can carry any number at once.
 */
export default function AdminTagsPage() {
  const queryClient = useQueryClient();
  const { data: tags, isPending } = useTags();

  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["tags"] });
    queryClient.invalidateQueries({ queryKey: ["trips"] });
  };

  const createMutation = useMutation({
    mutationFn: async (value: string) => api.post("/tags", { name: value }),
    onSuccess: () => {
      invalidate();
      toast.success("Шошго нэмлээ");
      closeDialog();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Нэмэхэд алдаа гарлаа")),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) =>
      api.put("/tags", { id, name: value }),
    onSuccess: () => {
      invalidate();
      toast.success("Шошго шинэчиллээ");
      closeDialog();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Шинэчлэхэд алдаа гарлаа")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete("/tags", { data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Устгалаа");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Устгахад алдаа гарлаа")),
  });

  function closeDialog() {
    setDialogMode(null);
    setEditingId(null);
    setName("");
  }

  function openCreate() {
    setName("");
    setDialogMode("create");
  }

  function openEdit(id: string, currentName: string) {
    setEditingId(id);
    setName(currentName);
    setDialogMode("edit");
  }

  function submit() {
    if (!name.trim()) {
      toast.error("Шошгын нэрээ оруулна уу");
      return;
    }
    if (dialogMode === "create") createMutation.mutate(name.trim());
    if (dialogMode === "edit" && editingId) updateMutation.mutate({ id: editingId, value: name.trim() });
  }

  function askDelete(id: string, tagName: string, tripCount: number) {
    const warn =
      tripCount > 0
        ? `"${tagName}"-г устгавал ${tripCount} аяллаас энэ шошго хасагдана. Устгах уу?`
        : `"${tagName}"-г устгах уу?`;
    if (window.confirm(warn)) deleteMutation.mutate(id);
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Шошгууд</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Үнэ, урамшуулал, тээврийн төрөл гэх мэт чөлөөт шошго. Аялал нэг зэрэг хэдэн ч шошготой байж болно.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Шошго нэмэх
        </Button>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-card p-2">
        {isPending ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        ) : !tags?.length ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <TagIcon className="h-8 w-8 opacity-40" />
            Шошго алга байна. Эхний шошгоо нэмнэ үү.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tags.map((tag) => (
              <div key={tag.id} className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-secondary/60">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{tag.name}</span>
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                  {tag.tripCount} аялал
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(tag.id, tag.name)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary"
                    aria-label="Засах"
                    title="Засах"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => askDelete(tag.id, tag.name, tag.tripCount)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Устгах"
                    title="Устгах"
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
            <DialogTitle>{dialogMode === "edit" ? "Шошго засах" : "Шинэ шошго"}</DialogTitle>
          </DialogHeader>

          <div>
            <Label htmlFor="tagName">Нэр</Label>
            <Input
              id="tagName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ж: Галт тэрэг, Хямдралтай, Хосолсон аялал"
              autoFocus
            />
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
