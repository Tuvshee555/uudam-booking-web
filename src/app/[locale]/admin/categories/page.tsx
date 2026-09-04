"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  ImageOff,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { useCategoryTree, useCategoryTrips } from "@/hooks/useTrips";
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
import type { CategoryNode } from "@/types/trip";
import { cn } from "@/lib/utils";

type FormState = {
  categoryName: string;
  parentId: string | null;
  description: string;
  image: string;
};

const EMPTY_FORM: FormState = { categoryName: "", parentId: null, description: "", image: "" };

/** Flatten the tree into "— indented" options for the parent picker. */
function flatten(nodes: CategoryNode[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((node) => [
    { id: node.id, label: `${"— ".repeat(depth)}${node.categoryName}` },
    ...flatten(node.children, depth + 1),
  ]);
}

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  // This page's job is to be a trustworthy source of truth for what's really
  // in the database — a stale tree here means deleting a row that's already
  // gone, which fails and looks like a bug. Always refetch on mount rather
  // than trusting whatever this tab last had cached.
  const { data: tree, isPending } = useCategoryTree(undefined, { refetchOnMount: "always" });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Separate from `expanded` (child categories): this tracks which rows are
  // showing their actual trip list, so the two can be open independently.
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const flatOptions = useMemo(() => flatten(tree ?? []), [tree]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["categories"] });

  const createMutation = useMutation({
    mutationFn: async (body: FormState) =>
      api.post("/categories", {
        categoryName: body.categoryName,
        parentId: body.parentId || undefined,
        description: body.description || undefined,
        image: body.image || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Ангилал үүсгэлээ");
      closeDialog();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Үүсгэхэд алдаа гарлаа")),
  });

  const updateMutation = useMutation({
    mutationFn: async (body: FormState & { id: string }) =>
      api.put("/categories", {
        id: body.id,
        categoryName: body.categoryName,
        parentId: body.parentId,
        description: body.description || null,
        image: body.image || null,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Ангилал шинэчиллээ");
      closeDialog();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Шинэчлэхэд алдаа гарлаа")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete("/categories", { data: { id } }),
    onSuccess: (res) => {
      invalidate();
      const detached = res.data?.detachedTrips ?? 0;
      toast.success(
        detached > 0 ? `Устгалаа. ${detached} аялал ангилалгүй боллоо.` : "Устгалаа",
      );
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Устгахад алдаа гарлаа")),
  });

  function closeDialog() {
    setDialogMode(null);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function openCreate(parentId: string | null) {
    setForm({ ...EMPTY_FORM, parentId });
    setDialogMode("create");
  }

  function openEdit(node: CategoryNode) {
    setEditingId(node.id);
    setForm({
      categoryName: node.categoryName,
      parentId: node.parentId,
      description: node.description ?? "",
      image: node.image ?? "",
    });
    setDialogMode("edit");
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTrips(id: string) {
    setExpandedTrips((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    if (!form.categoryName.trim()) {
      toast.error("Ангиллын нэрээ оруулна уу");
      return;
    }
    if (dialogMode === "create") createMutation.mutate(form);
    if (dialogMode === "edit" && editingId) updateMutation.mutate({ ...form, id: editingId });
  }

  function askDelete(node: CategoryNode) {
    const warn =
      node.children.length > 0
        ? `"${node.categoryName}" дэд ангилалтай тул устгах боломжгүй.`
        : node.tripCount > 0
          ? `"${node.categoryName}"-г устгавал ${node.tripCount} аялал ангилалгүй болно. Устгах уу?`
          : `"${node.categoryName}"-г устгах уу?`;

    if (node.children.length > 0) {
      toast.error(warn);
      return;
    }
    if (window.confirm(warn)) deleteMutation.mutate(node.id);
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Ангилалууд</h1>
        <Button onClick={() => openCreate(null)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Ангилал нэмэх
        </Button>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-card p-2">
        {isPending ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        ) : !tree?.length ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <FolderTree className="h-8 w-8 opacity-40" />
            Ангилал алга байна.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tree.map((node) => (
              <CategoryRow
                key={node.id}
                node={node}
                depth={0}
                expanded={expanded}
                onToggle={toggle}
                expandedTrips={expandedTrips}
                onToggleTrips={toggleTrips}
                onAddChild={openCreate}
                onEdit={openEdit}
                onDelete={askDelete}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "edit" ? "Ангилал засах" : "Шинэ ангилал"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="categoryName">Нэр</Label>
              <Input
                id="categoryName"
                value={form.categoryName}
                onChange={(e) => setForm((f) => ({ ...f, categoryName: e.target.value }))}
                autoFocus
              />
            </div>

            <div>
              <Label htmlFor="parentId">Эцэг ангилал</Label>
              <select
                id="parentId"
                value={form.parentId ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, parentId: e.target.value || null }))
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Үндсэн ангилал —</option>
                {flatOptions
                  .filter((opt) => opt.id !== editingId)
                  .map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <Label htmlFor="description">Тайлбар (заавал биш)</Label>
              <Textarea
                id="description"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="image">Зургийн URL (заавал биш)</Label>
              <Input
                id="image"
                value={form.image}
                onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                placeholder="https://…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Цуцлах
            </Button>
            <Button onClick={submit} disabled={saving}>
              {dialogMode === "edit" ? "Хадгалах" : "Үүсгэх"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function CategoryRow({
  node,
  depth,
  expanded,
  onToggle,
  expandedTrips,
  onToggleTrips,
  onAddChild,
  onEdit,
  onDelete,
}: {
  node: CategoryNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  expandedTrips: Set<string>;
  onToggleTrips: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onEdit: (node: CategoryNode) => void;
  onDelete: (node: CategoryNode) => void;
}) {
  const isOpen = expanded.has(node.id);
  const tripsOpen = expandedTrips.has(node.id);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-xl px-2 py-2.5 hover:bg-secondary/60"
        style={{ paddingLeft: 8 + depth * 22 }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground",
            !hasChildren && "opacity-0",
          )}
          aria-label={isOpen ? "Хаах" : "Дэлгэх"}
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <span className="min-w-0 flex-1 truncate text-sm font-medium">{node.categoryName}</span>

        <button
          type="button"
          onClick={() => node.tripCount > 0 && onToggleTrips(node.id)}
          disabled={node.tripCount === 0}
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] transition-colors",
            tripsOpen
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground",
            node.tripCount > 0 && !tripsOpen && "hover:bg-primary/15 hover:text-primary",
          )}
          title={node.tripCount > 0 ? "Аяллуудыг харах" : undefined}
        >
          {node.tripCount} аялал
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onAddChild(node.id)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary"
            aria-label="Дэд ангилал нэмэх"
            title="Дэд ангилал нэмэх"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onEdit(node)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary"
            aria-label="Засах"
            title="Засах"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(node)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Устгах"
            title="Устгах"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {tripsOpen && node.tripCount > 0 && (
        <div style={{ paddingLeft: 8 + depth * 22 + 28 }}>
          <CategoryTripsPanel categoryId={node.id} />
        </div>
      )}

      {isOpen && hasChildren && (
        <div>
          {node.children.map((child) => (
            <CategoryRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              expandedTrips={expandedTrips}
              onToggleTrips={onToggleTrips}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The trip list behind a category's "N аялал" badge. Renders right below the
 * row it belongs to, not as a popover — a popover was the earlier complaint
 * ("shows at the bottom of where I clicked"), and pinning it in the flow
 * avoids that entirely. Each row links straight to the trip's edit page,
 * which is also where the category itself can be changed (i.e. "moved").
 */
function CategoryTripsPanel({ categoryId }: { categoryId: string }) {
  const { data, isLoading } = useCategoryTrips(categoryId);

  if (isLoading) {
    return (
      <div className="space-y-1.5 py-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-lg bg-secondary" />
        ))}
      </div>
    );
  }

  if (!data?.trips.length) {
    return (
      <p className="py-2 text-xs text-muted-foreground">Энэ ангилалд аялал алга.</p>
    );
  }

  return (
    <div className="my-1.5 space-y-1 border-l-2 border-border pl-3">
      {data.trips.map((trip) => (
        <Link
          key={trip.id}
          href={`../trips/${trip.id}/edit`}
          className="flex items-center gap-2.5 rounded-lg py-1.5 pr-2 hover:bg-secondary/60"
        >
          <div className="relative h-9 w-12 shrink-0 overflow-hidden rounded-md bg-secondary">
            {trip.image ? (
              <Image src={trip.image} alt={trip.title} fill sizes="48px" className="object-cover" />
            ) : (
              <ImageOff className="absolute inset-0 m-auto h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
          <span className="min-w-0 flex-1 truncate text-sm">{trip.title}</span>
          <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </div>
  );
}
