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
import { cn } from "@/lib/utils";

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  coverImage: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
};

const EMPTY = { title: "", excerpt: "", body: "", coverImage: "", isPublished: false };

export default function PostsClient() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Post | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [open, setOpen] = useState(false);

  const { data: posts, isLoading } = useQuery<Post[]>({
    queryKey: ["admin", "posts"],
    queryFn: async () => (await api.get<Post[]>("/posts", { params: { all: "true" } })).data,
  });

  const done = (message: string) => {
    queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
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
        body: draft.body,
        coverImage: draft.coverImage || null,
        isPublished: draft.isPublished,
      };

      if (editing) return api.put(`/posts/${editing.id}`, payload);
      return api.post("/posts", payload);
    },
    onSuccess: () => done(editing ? "Хадгаллаа" : "Нийтлэл нэмэгдлээ"),
    onError: (err) => toast.error(apiErrorMessage(err, "Хадгалахад алдаа гарлаа")),
  });

  const togglePublish = useMutation({
    mutationFn: async (post: Post) =>
      api.put(`/posts/${post.id}`, { isPublished: !post.isPublished }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
      toast.success("Төлөв шинэчлэгдлээ");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Алдаа гарлаа")),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/posts/${id}`),
    onSuccess: () => done("Устгалаа"),
    onError: (err) => toast.error(apiErrorMessage(err, "Устгахад алдаа гарлаа")),
  });

  const startEdit = (post: Post) => {
    setEditing(post);
    setDraft({
      title: post.title,
      excerpt: post.excerpt ?? "",
      body: post.body,
      coverImage: post.coverImage ?? "",
      isPublished: post.isPublished,
    });
    setOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Аяллын зөвлөгөө</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Виз, ачаа тээш, бэлтгэлийн талаарх нийтлэлүүд. Ноорог хадгалаад дараа
            нийтэлж болно.
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
          Нийтлэл нэмэх
        </Button>
      </div>

      {open && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold">
            {editing ? "Нийтлэл засах" : "Шинэ нийтлэл"}
          </h2>

          <div className="mt-4 grid gap-4">
            <div>
              <Label htmlFor="post-title">Гарчиг</Label>
              <Input
                id="post-title"
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="Японы визний бүрдүүлэх бичиг баримт"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="post-excerpt">Товч тайлбар</Label>
              <Input
                id="post-excerpt"
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

            <div>
              <Label htmlFor="post-body">Агуулга</Label>
              <textarea
                id="post-body"
                value={draft.body}
                onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                rows={14}
                placeholder="Нийтлэлийн бүтэн текст. Мөр таслах нь хэвээр хадгалагдана."
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
        ) : !posts?.length ? (
          <div className="rounded-2xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
            Одоогоор нийтлэл алга.
          </div>
        ) : (
          posts.map((post) => (
            <div
              key={post.id}
              className="flex items-center gap-3 rounded-xl border border-border p-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{post.title}</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">/{post.slug}</div>
              </div>

              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  post.isPublished
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {post.isPublished ? "Нийтлэгдсэн" : "Ноорог"}
              </span>

              <button
                type="button"
                onClick={() => togglePublish.mutate(post)}
                title={post.isPublished ? "Нуух" : "Нийтлэх"}
                className="shrink-0 rounded-lg border border-border p-2 hover:border-primary"
              >
                {post.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>

              <Button variant="outline" size="sm" onClick={() => startEdit(post)}>
                Засах
              </Button>

              <button
                type="button"
                onClick={() => {
                  if (confirm(`"${post.title}" нийтлэлийг устгах уу?`)) remove.mutate(post.id);
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
