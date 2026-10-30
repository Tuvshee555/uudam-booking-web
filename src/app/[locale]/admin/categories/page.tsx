"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, FolderTree, ImageOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { useCategoryTree, useCategoryTrips } from "@/hooks/useTrips";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ImageUploadField from "@/components/admin/trip-form/ImageUploadField";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  EmptyState,
  ErrorState,
  FormField,
  LoadingRows,
  PageHeader,
  Panel,
  SearchInput,
  StatusBadge,
  selectClassName,
  useConfirm,
} from "@/components/admin/ui";
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

/** A category and everything under it — none of these can become its parent. */
function subtreeIds(node: CategoryNode): string[] {
  return [node.id, ...node.children.flatMap(subtreeIds)];
}

function findNode(nodes: CategoryNode[], id: string): CategoryNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

/** Keeps matching categories plus the branches leading to them. */
function filterTree(nodes: CategoryNode[], term: string): CategoryNode[] {
  if (!term) return nodes;
  return nodes.flatMap((node) => {
    const children = filterTree(node.children, term);
    const match = node.categoryName.toLocaleLowerCase().includes(term);
    return match || children.length ? [{ ...node, children: match ? node.children : children }] : [];
  });
}

function countAll(nodes: CategoryNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countAll(node.children), 0);
}

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  // This page's job is to be a trustworthy source of truth for what's really
  // in the database — a stale tree here means deleting a row that's already
  // gone, which fails and looks like a bug. Always refetch on mount rather
  // than trusting whatever this tab last had cached.
  const { data: tree, isPending, isError, error, refetch } = useCategoryTree(undefined, { refetchOnMount: "always", admin: true });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Separate from `expanded` (child categories): this tracks which rows are
  // showing their actual trip list, so the two can be open independently.
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [nameError, setNameError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const term = search.trim().toLocaleLowerCase();
  const visibleTree = useMemo(() => filterTree(tree ?? [], term), [tree, term]);
  const allIds = useMemo(() => flatten(tree ?? []).map((option) => option.id), [tree]);
  const hasNested = (tree ?? []).some((node) => node.children.length > 0);

  const parentOptions = useMemo(() => {
    const editing = editingId && tree ? findNode(tree, editingId) : null;
    const blocked = new Set(editing ? subtreeIds(editing) : editingId ? [editingId] : []);
    return flatten(tree ?? []).filter((option) => !blocked.has(option.id));
  }, [tree, editingId]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["categories"] });

  const createMutation = useMutation({
    mutationFn: async (body: FormState) =>
      api.post("/categories", {
        categoryName: body.categoryName,
        parentId: body.parentId || undefined,
        description: body.description || undefined,
        image: body.image || undefined,
      }),
    onSuccess: (_, body) => {
      invalidate();
      if (body.parentId) setExpanded((current) => new Set(current).add(body.parentId!));
      toast.success(`«${body.categoryName}» ангилал нэмэгдлээ`);
      closeDialog();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Ангилал нэмэхэд алдаа гарлаа")),
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
      toast.success("Ангилал хадгалагдлаа");
      closeDialog();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Хадгалахад алдаа гарлаа")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (node: CategoryNode) => api.delete("/categories", { data: { id: node.id } }),
    onSuccess: (res, node) => {
      invalidate();
      const detached = res.data?.detachedTrips ?? 0;
      toast.success(
        detached > 0
          ? `«${node.categoryName}» устгагдлаа. ${detached} аялал энэ ангиллаас гарлаа.`
          : `«${node.categoryName}» устгагдлаа`,
      );
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Устгахад алдаа гарлаа")),
  });

  function closeDialog() {
    setDialogMode(null);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setNameError(null);
  }

  function openCreate(parentId: string | null) {
    setForm({ ...EMPTY_FORM, parentId });
    setEditingId(null);
    setNameError(null);
    setDialogMode("create");
  }

  function openEdit(node: CategoryNode) {
    setEditingId(node.id);
    setNameError(null);
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

  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    const name = form.categoryName.trim();
    if (!name) {
      setNameError("Ангиллын нэрээ оруулна уу");
      return;
    }
    const body = { ...form, categoryName: name };
    if (dialogMode === "create") createMutation.mutate(body);
    if (dialogMode === "edit" && editingId) updateMutation.mutate({ ...body, id: editingId });
  }

  async function askDelete(node: CategoryNode) {
    if (node.children.length > 0) {
      await confirm({
        title: "Энэ ангиллыг устгах боломжгүй",
        description: `«${node.categoryName}» дотор ${node.children.length} дэд ангилал байна. Эхлээд дэд ангиллуудыг устгах эсвэл өөр ангилал руу шилжүүлнэ үү.`,
        infoOnly: true,
      });
      return;
    }
    const ok = await confirm({
      title: "Энэ ангиллыг устгах уу?",
      description:
        node.tripCount > 0
          ? `«${node.categoryName}» устна. Доторх ${node.tripCount} аялал устахгүй, зөвхөн энэ ангиллаас гарна.`
          : `«${node.categoryName}» устна. Энэ ангилалд аялал байхгүй.`,
      confirmLabel: "Устгах",
      tone: "danger",
    });
    if (ok) deleteMutation.mutate(node);
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const total = countAll(tree ?? []);

  return (
    <>
      <PageHeader
        title="Ангилалууд"
        description="Сайтын цэс болон аяллын жагсаалтад харагдах бүлгүүд. Ангилал дотор дэд ангилал үүсгэж болно. Аяллыг ангилалд оруулахдаа тухайн аяллын засах хуудаснаас сонгоно."
        actions={
          <Button onClick={() => openCreate(null)}>
            <Plus />
            Ангилал нэмэх
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <SearchInput className="flex-1" value={search} onChange={setSearch} placeholder="Ангиллын нэрээр хайх" />
        {hasNested && (
        <div className="flex gap-2">
          <Button variant="outline" className="h-10 flex-1" onClick={() => setExpanded(new Set(allIds))}>
            <ChevronsUpDown />
            Бүгдийг дэлгэх
          </Button>
          <Button variant="outline" className="h-10 flex-1" onClick={() => setExpanded(new Set())}>
            <ChevronsDownUp />
            Хураах
          </Button>
        </div>
        )}
      </div>

      <Panel className="mt-4" bodyClassName="p-0 sm:p-0">
        {isPending ? (
          <LoadingRows rows={5} className="p-4" rowClassName="h-11" />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : !tree?.length ? (
          <EmptyState
            icon={FolderTree}
            title="Ангилал хараахан алга"
            description="Жишээ нь «Гадаад аялал», «Дотоод аялал» гэх мэт ангилал үүсгээд аяллуудаа оруулна."
            action={
              <Button onClick={() => openCreate(null)}>
                <Plus />
                Эхний ангиллаа нэмэх
              </Button>
            }
          />
        ) : !visibleTree.length ? (
          <EmptyState icon={FolderTree} title="Тохирох ангилал олдсонгүй" action={<Button variant="outline" onClick={() => setSearch("")}>Хайлтыг арилгах</Button>} />
        ) : (
          <>
            <p className="border-b border-border px-4 py-2.5 text-sm text-muted-foreground">
              Нийт {total} ангилал. Ангиллын нэрний хажуугийн «аялал» товчийг дарж доторх аяллуудыг харна.
            </p>
            <div className="divide-y divide-border">
              {visibleTree.map((node) => (
                <CategoryRow
                  key={node.id}
                  node={node}
                  depth={0}
                  expanded={term ? new Set(allIds) : expanded}
                  onToggle={toggle}
                  expandedTrips={expandedTrips}
                  onToggleTrips={toggleTrips}
                  onAddChild={openCreate}
                  onEdit={openEdit}
                  onDelete={askDelete}
                />
              ))}
            </div>
          </>
        )}
      </Panel>

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader className="text-left">
              <DialogTitle>{dialogMode === "edit" ? "Ангилал засах" : "Шинэ ангилал"}</DialogTitle>
              <DialogDescription>Нэрийг нь сайтын цэсэнд яг ингэж харуулна.</DialogDescription>
            </DialogHeader>

            <FormField label="Нэр" required error={nameError}>
              <Input
                value={form.categoryName}
                onChange={(e) => {
                  setForm((f) => ({ ...f, categoryName: e.target.value }));
                  setNameError(null);
                }}
                placeholder="ж: Гадаад аялал"
                autoFocus
              />
            </FormField>

            <FormField label="Аль ангиллын дотор байх вэ" hint="«Үндсэн ангилал» бол цэсний хамгийн дээд түвшинд харагдана.">
              <select
                value={form.parentId ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value || null }))}
                className={selectClassName}
              >
                <option value="">Үндсэн ангилал (дээд түвшин)</option>
                {parentOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Тайлбар" hint="Заавал биш. Ангиллын хуудасны дээд хэсэгт харагдана.">
              <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </FormField>

            <ImageUploadField label="Зураг (заавал биш)" value={form.image} onChange={(image) => setForm((f) => ({ ...f, image }))} />

            <DialogFooter className="gap-2 sm:space-x-0">
              <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
                Болих
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                {dialogMode === "edit" ? "Хадгалах" : "Ангилал нэмэх"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
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
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 hover:bg-muted/40 sm:flex-nowrap" style={{ paddingLeft: 12 + depth * 24 }}>
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          disabled={!hasChildren}
          className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted", !hasChildren && "invisible")}
          aria-label={isOpen ? "Дэд ангиллуудыг хураах" : "Дэд ангиллуудыг дэлгэх"}
          aria-expanded={hasChildren ? isOpen : undefined}
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{node.categoryName}</p>
          {(node.description || hasChildren) && (
            <p className="truncate text-xs text-muted-foreground">
              {[hasChildren ? `${node.children.length} дэд ангилал` : null, node.description].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => node.tripCount > 0 && onToggleTrips(node.id)}
          disabled={node.tripCount === 0}
          aria-expanded={node.tripCount > 0 ? tripsOpen : undefined}
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
            tripsOpen ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            node.tripCount > 0 && !tripsOpen && "hover:bg-primary/15 hover:text-primary",
          )}
          title={node.tripCount > 0 ? "Доторх аяллуудыг харах" : "Энэ ангилалд аялал алга"}
        >
          {node.tripCount} аялал
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
          <Button type="button" variant="ghost" size="sm" onClick={() => onAddChild(node.id)} title="Энэ ангилал дотор дэд ангилал нэмэх">
            <Plus />
            <span className="hidden md:inline">Дэд ангилал</span>
            <span className="sr-only md:hidden">Дэд ангилал нэмэх</span>
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(node)}>
            <Pencil />
            <span className="hidden sm:inline">Засах</span>
            <span className="sr-only sm:hidden">Засах</span>
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(node)} className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
            <Trash2 />
            <span className="hidden sm:inline">Устгах</span>
            <span className="sr-only sm:hidden">Устгах</span>
          </Button>
        </div>
      </div>

      {tripsOpen && node.tripCount > 0 && (
        <div style={{ paddingLeft: 12 + depth * 24 + 36 }} className="pb-2 pr-3">
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
  const { locale } = useI18n();
  // includeDrafts: true — otherwise this list disagrees with the row's own
  // "N аялал" badge, which counts drafts too (that mismatch was the "some
  // numbers are lying" bug: a category showing 3 would only list 2).
  const { data, isLoading } = useCategoryTrips(categoryId, undefined, { includeDrafts: true });

  if (isLoading) {
    return <LoadingRows rows={2} rowClassName="h-11" className="py-1" />;
  }

  if (!data?.trips.length) {
    return <p className="py-2 text-xs text-muted-foreground">Энэ ангилалд аялал алга.</p>;
  }

  return (
    <div className="space-y-1 border-l-2 border-border pl-3">
      {data.trips.map((trip) => (
        <Link
          key={trip.id}
          href={`/${locale}/admin/trips/${trip.id}/edit`}
          className="flex items-center gap-2.5 rounded-lg py-1.5 pr-2 hover:bg-muted/60"
        >
          <div className="relative h-9 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
            {trip.image ? (
              <Image src={trip.image} alt="" fill sizes="48px" className="object-cover" />
            ) : (
              <ImageOff className="absolute inset-0 m-auto h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
          <span className="min-w-0 flex-1 truncate text-sm">{trip.title}</span>
          {!trip.isPublished && <StatusBadge tone="neutral">Ноорог</StatusBadge>}
          <span className="hidden shrink-0 text-xs font-medium text-primary sm:inline">Засах</span>
        </Link>
      ))}
    </div>
  );
}
