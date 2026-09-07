"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api, apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ImageUploadField from "@/components/admin/trip-form/ImageUploadField";
import StringListField from "@/components/admin/trip-form/StringListField";
import { cn } from "@/lib/utils";

type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  facts: string[];
  coverImage: string | null;
  video: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
};

const EMPTY = {
  title: "",
  excerpt: "",
  body: "",
  facts: [] as string[],
  coverImage: "",
  video: "",
  isPublished: false,
};

export default function KnowledgeClient() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Article | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [open, setOpen] = useState(false);

  const { data: articles, isLoading } = useQuery<Article[]>({
    queryKey: ["admin", "knowledge"],
    queryFn: async () => (await api.get<Article[]>("/knowledge", { params: { all: "true" } })).data,
  });

  const done = (message: string) => {
    queryClient.invalidateQueries({ queryKey: ["admin", "knowledge"] });
    toast.success(message);
    setOpen(false);
    setEditing(null);
    setDraft(EMPTY);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: draft.title,
        excerpt: draft.excerpt || null,
        body: draft.body || null,
        facts: draft.facts,
        coverImage: draft.coverImage || null,
        video: draft.video || null,
        isPublished: draft.isPublished,
      };

      if (editing) return api.put(`/knowledge/${editing.id}`, payload);
      return api.post("/knowledge", payload);
    },
    onSuccess: () => done(editing ? "Хадгаллаа" : "Мэдээлэл нэмэгдлээ"),
    onError: (err) => toast.error(apiErrorMessage(err, "Хадгалахад алдаа гарлаа")),
  });

  const togglePublish = useMutation({
    mutationFn: async (article: Article) =>
      api.put(`/knowledge/${article.id}`, { isPublished: !article.isPublished }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "knowledge"] });
      toast.success("Төлөв шинэчлэгдлээ");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Алдаа гарлаа")),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/knowledge/${id}`),
    onSuccess: () => done("Устгалаа"),
    onError: (err) => toast.error(apiErrorMessage(err, "Устгахад алдаа гарлаа")),
  });

  const startEdit = (article: Article) => {
    setEditing(article);
    setDraft({
      title: article.title,
      excerpt: article.excerpt ?? "",
      body: article.body ?? "",
      facts: article.facts,
      coverImage: article.coverImage ?? "",
      video: article.video ?? "",
      isPublished: article.isPublished,
    });
    setOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Танин мэдэхүй</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Сонирхолтой баримт, зураг, бичлэг — жишээ нь &ldquo;Хятадын Их
            хэрэм хэр урт вэ&rdquo;. Ноорог хадгалаад дараа нийтэлж болно.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDraft(EMPTY);
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Мэдээлэл нэмэх
        </Button>
      </div>

      {open && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold">
            {editing ? "Мэдээлэл засах" : "Шинэ мэдээлэл"}
          </h2>

          <div className="mt-4 grid gap-4">
            <div>
              <Label htmlFor="knowledge-title">Гарчиг</Label>
              <Input
                id="knowledge-title"
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="Хятадын Их хэрэм"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="knowledge-excerpt">Товч тайлбар</Label>
              <Input
                id="knowledge-excerpt"
                value={draft.excerpt}
                onChange={(event) => setDraft({ ...draft, excerpt: event.target.value })}
                placeholder="Жагсаалтад харагдах 1-2 өгүүлбэр"
                className="mt-1.5"
              />
            </div>

            <ImageUploadField
              label="Нүүр зураг"
              value={draft.coverImage}
              onChange={(url) => setDraft({ ...draft, coverImage: url })}
            />

            <ImageUploadField
              label="Бичлэг (заавал биш)"
              value={draft.video}
              onChange={(url) => setDraft({ ...draft, video: url })}
              resourceType="video"
            />

            <StringListField
              label="Сонирхолтой баримтууд"
              values={draft.facts}
              onChange={(facts) => setDraft({ ...draft, facts })}
              placeholder="Урт нь 21,196 км — бичээд Enter дарна уу"
            />

            <div>
              <Label htmlFor="knowledge-body">Нэмэлт текст (заавал биш)</Label>
              <textarea
                id="knowledge-body"
                value={draft.body}
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                rows={8}
                placeholder="Баримтуудын эргэн тойрон өгүүлэх текст, шаардлагатай бол."
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.isPublished}
                onChange={(event) => setDraft({ ...draft, isPublished: event.target.checked })}
                className="h-4 w-4"
              />
              Нийтлэх (тэмдэглээгүй бол ноорог хэвээр үлдэнэ)
            </label>
          </div>

          <div className="mt-5 flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Хадгалах
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            >
              Болих
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-2">
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-secondary" />
        ) : !articles?.length ? (
          <div className="rounded-2xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
            Одоогоор мэдээлэл алга.
          </div>
        ) : (
          articles.map((article) => (
            <div
              key={article.id}
              className="flex items-center gap-3 rounded-xl border border-border p-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{article.title}</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  /{article.slug} · {article.facts.length} баримт
                </div>
              </div>

              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  article.isPublished
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {article.isPublished ? "Нийтлэгдсэн" : "Ноорог"}
              </span>

              <button
                type="button"
                onClick={() => togglePublish.mutate(article)}
                title={article.isPublished ? "Нуух" : "Нийтлэх"}
                className="shrink-0 rounded-lg border border-border p-2 hover:border-primary"
              >
                {article.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>

              <Button variant="outline" size="sm" onClick={() => startEdit(article)}>
                Засах
              </Button>

              <button
                type="button"
                onClick={() => {
                  if (confirm(`"${article.title}" мэдээллийг устгах уу?`)) remove.mutate(article.id);
                }}
                className="shrink-0 rounded-lg border border-border p-2 text-destructive hover:border-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
