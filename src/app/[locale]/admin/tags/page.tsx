"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, Pencil, Plus, Tag as TagIcon, Trash2, X } from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { useTags, type FlatTag } from "@/hooks/useTrips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingRows, PageHeader, Panel, SearchInput, SelectFilter, useConfirm } from "@/components/admin/ui";
import { formatNumber } from "@/lib/adminFormat";

/**
 * Free-form trip labels ("Галт тэрэг", "Хямдралтай" …) — starts empty, staff
 * create every one of them. Unlike Category (a tree, one slot per trip) this
 * is flat and a trip can carry any number at once.
 */
export default function AdminTagsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data: tags, isPending, isError, error, refetch } = useTags({ admin: true });

  const [newName, setNewName] = useState("");
  const [newError, setNewError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string; error?: string } | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"name" | "usage">("name");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["tags"] });
    queryClient.invalidateQueries({ queryKey: ["trips"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "trips"] });
  };

  const isTaken = (name: string, exceptId?: string) =>
    (tags ?? []).some((tag) => tag.id !== exceptId && tag.name.toLocaleLowerCase() === name.toLocaleLowerCase());

  const createMutation = useMutation({
    mutationFn: async (value: string) => api.post("/tags", { name: value }),
    onSuccess: (_, value) => {
      invalidate();
      toast.success(`«${value}» шошго нэмэгдлээ`);
      setNewName("");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Шошго нэмэхэд алдаа гарлаа")),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => api.put("/tags", { id, name: value }),
    onSuccess: () => {
      invalidate();
      toast.success("Шошгын нэр өөрчлөгдлөө");
      setEditing(null);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Хадгалахад алдаа гарлаа")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (tag: FlatTag) => api.delete("/tags", { data: { id: tag.id } }),
    onSuccess: (_, tag) => {
      invalidate();
      toast.success(`«${tag.name}» шошго устгагдлаа`);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Устгахад алдаа гарлаа")),
  });

  function add(event: React.FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return setNewError("Шошгын нэрээ бичнэ үү");
    if (isTaken(name)) return setNewError("Ийм нэртэй шошго аль хэдийн байна");
    createMutation.mutate(name);
  }

  function saveEdit() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return setEditing({ ...editing, error: "Нэр хоосон байж болохгүй" });
    if (isTaken(name, editing.id)) return setEditing({ ...editing, error: "Ийм нэртэй шошго аль хэдийн байна" });
    updateMutation.mutate({ id: editing.id, value: name });
  }

  async function askDelete(tag: FlatTag) {
    const ok = await confirm({
      title: "Энэ шошгыг устгах уу?",
      description:
        tag.tripCount > 0
          ? `«${tag.name}» устна. ${tag.tripCount} аяллаас энэ шошго хасагдана — аялал өөрөө устахгүй.`
          : `«${tag.name}» устна. Одоогоор ямар ч аялалд наагаагүй байна.`,
      confirmLabel: "Устгах",
      tone: "danger",
    });
    if (ok) deleteMutation.mutate(tag);
  }

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    const rows = (tags ?? []).filter((tag) => !term || tag.name.toLocaleLowerCase().includes(term));
    return sort === "usage"
      ? [...rows].sort((a, b) => b.tripCount - a.tripCount || a.name.localeCompare(b.name, "mn"))
      : [...rows].sort((a, b) => a.name.localeCompare(b.name, "mn"));
  }, [tags, search, sort]);

  return (
    <>
      <PageHeader
        title="Шошгууд"
        description="Аялалд наадаг чөлөөт шошго — жишээ нь «Галт тэрэг», «Хямдралтай», «Гэр бүлд». Нэг аялал хэдэн ч шошготой байж болно. Сайтын аяллын жагсаалтад шүүлтүүр болж харагдана. Аялалд шошго наахдаа аяллын засах хуудаснаас сонгоно."
      />

      <Panel title="Шинэ шошго нэмэх">
        <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <Input
              aria-label="Шинэ шошгын нэр"
              aria-invalid={newError ? true : undefined}
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setNewError(null);
              }}
              placeholder="ж: Галт тэрэг"
              className="h-10"
            />
            {newError && (
              <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
                {newError}
              </p>
            )}
          </div>
          <Button type="submit" className="h-10" disabled={createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            Шошго нэмэх
          </Button>
        </form>
      </Panel>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <SearchInput className="flex-1" value={search} onChange={setSearch} placeholder="Шошго хайх" />
        <SelectFilter
          label="Эрэмбэ"
          value={sort}
          onChange={setSort}
          options={[
            { value: "name", label: "Нэрээр (А–Я)" },
            { value: "usage", label: "Олон аялалтай нь эхэндээ" },
          ]}
        />
      </div>

      <Panel className="mt-4" bodyClassName="p-0 sm:p-0">
        {isPending ? (
          <LoadingRows rows={5} className="p-4" rowClassName="h-11" />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : !tags?.length ? (
          <EmptyState icon={TagIcon} title="Шошго хараахан алга" description="Дээрх хэсгээс эхний шошгоо нэмнэ үү." />
        ) : !visible.length ? (
          <EmptyState icon={TagIcon} title="Тохирох шошго олдсонгүй" action={<Button variant="outline" onClick={() => setSearch("")}>Хайлтыг арилгах</Button>} />
        ) : (
          <>
            <p className="border-b border-border px-4 py-2.5 text-sm text-muted-foreground">Нийт {formatNumber(tags.length)} шошго</p>
            <ul className="divide-y divide-border">
              {visible.map((tag) => {
                const isEditing = editing?.id === tag.id;
                return (
                  <li key={tag.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 hover:bg-muted/30 sm:flex-nowrap">
                    {isEditing ? (
                      <form
                        className="flex min-w-0 flex-1 flex-wrap items-start gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          saveEdit();
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <Input
                            autoFocus
                            aria-label="Шошгын шинэ нэр"
                            aria-invalid={editing?.error ? true : undefined}
                            value={editing?.name ?? ""}
                            onChange={(e) => setEditing({ id: tag.id, name: e.target.value })}
                            onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                          />
                          {editing?.error && (
                            <p role="alert" className="mt-1 text-xs font-medium text-destructive">
                              {editing.error}
                            </p>
                          )}
                        </div>
                        <Button type="submit" size="sm" className="h-9" disabled={updateMutation.isPending}>
                          {updateMutation.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                          Хадгалах
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="h-9" onClick={() => setEditing(null)}>
                          <X />
                          Болих
                        </Button>
                      </form>
                    ) : (
                      <>
                        <TagIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{tag.name}</span>
                        <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                          {tag.tripCount ? `${tag.tripCount} аялал` : "Аялалгүй"}
                        </span>
                        <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditing({ id: tag.id, name: tag.name })}>
                            <Pencil />
                            Нэр солих
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => askDelete(tag)}
                          >
                            <Trash2 />
                            Устгах
                          </Button>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>
    </>
  );
}
