"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, FileText, ImageOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ImageUploadField from "@/components/admin/trip-form/ImageUploadField";
import StringListField from "@/components/admin/trip-form/StringListField";
import { isAllowedImageHost } from "@/lib/imageHosts";
import { formatDate, formatNumber } from "@/lib/adminFormat";
import { LIVE_QUERY } from "@/hooks/useAdminSummary";
import {
  EmptyState,
  ErrorState,
  FilterChips,
  FormField,
  LoadingRows,
  PageHeader,
  Panel,
  SearchInput,
  SidePanel,
  StatusBadge,
  Switch,
  SwitchField,
  useConfirm,
} from "./ui";

export type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  facts?: string[];
  coverImage: string | null;
  video?: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
};

type Draft = {
  title: string;
  excerpt: string;
  body: string;
  facts: string[];
  coverImage: string;
  video: string;
  isPublished: boolean;
};

const EMPTY: Draft = { title: "", excerpt: "", body: "", facts: [], coverImage: "", video: "", isPublished: false };

export type ArticleConfig = {
  /** API collection, e.g. "/posts". */
  endpoint: string;
  /** Public section the article appears under, e.g. "guide" for /mn/guide/<slug>. */
  publicSection: string;
  queryKey: string;
  title: string;
  description: string;
  /** "нийтлэл", "мэдээлэл" — what one item is called. */
  noun: string;
  /** Written out in full: Mongolian case endings don't follow one rule ("мэдээллийг"). */
  deleteTitle: string;
  addLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  titlePlaceholder: string;
  /** Posts need body text; knowledge pieces need facts or text. */
  kind: "post" | "knowledge";
};

function toDraft(article: Article): Draft {
  return {
    title: article.title,
    excerpt: article.excerpt ?? "",
    body: article.body ?? "",
    facts: article.facts ?? [],
    coverImage: article.coverImage ?? "",
    video: article.video ?? "",
    isPublished: article.isPublished,
  };
}

/**
 * The guide posts and "did you know" pieces share one editor: a list with
 * publish switches, and a side panel to write in. Drafts stay private until
 * published — the API defaults both to unpublished on purpose.
 */
export default function ArticleManager({ config }: { config: ArticleConfig }) {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const queryKey = ["admin", config.queryKey];

  const articles = useQuery<Article[]>({
    queryKey,
    queryFn: async () => (await api.get<Article[]>(config.endpoint, { params: { all: "true" } })).data,
    ...LIVE_QUERY,
  });

  const [editing, setEditing] = useState<Article | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [baseline, setBaseline] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<"title" | "body", string>>>({});
  const [status, setStatus] = useState<"all" | "published" | "draft">("all");
  const [search, setSearch] = useState("");

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const publicHref = (article: Article) => `/${locale}/${config.publicSection}/${article.slug}`;

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: draft.title.trim(),
        excerpt: draft.excerpt.trim() || null,
        body: config.kind === "post" ? draft.body : draft.body.trim() || null,
        ...(config.kind === "knowledge" ? { facts: draft.facts, video: draft.video.trim() || null } : {}),
        coverImage: draft.coverImage.trim() || null,
        isPublished: draft.isPublished,
      };
      if (editing) return (await api.put<Article>(`${config.endpoint}/${editing.id}`, payload)).data;
      return (await api.post<Article>(config.endpoint, payload)).data;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(
        editing
          ? `«${saved.title}» хадгалагдлаа`
          : saved.isPublished
            ? `«${saved.title}» нийтлэгдэж, сайтад харагдах боллоо`
            : `«${saved.title}» ноорогоор хадгалагдлаа`,
      );
      closeEditor(true);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Хадгалахад алдаа гарлаа")),
  });

  const togglePublish = useMutation({
    mutationFn: async ({ article, isPublished }: { article: Article; isPublished: boolean }) =>
      api.put(`${config.endpoint}/${article.id}`, { isPublished }),
    onSuccess: (_, { article, isPublished }) => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(isPublished ? `«${article.title}» сайтад нийтлэгдлээ` : `«${article.title}» ноорог боллоо — сайтад харагдахгүй`, {
        duration: 8000,
        action: { label: "Буцаах", onClick: () => togglePublish.mutate({ article, isPublished: !isPublished }) },
      });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Өөрчлөхөд алдаа гарлаа")),
  });

  const remove = useMutation({
    mutationFn: async (article: Article) => api.delete(`${config.endpoint}/${article.id}`),
    onSuccess: (_, article) => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(`«${article.title}» устгагдлаа`);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Устгахад алдаа гарлаа")),
  });

  function openNew() {
    setEditing(null);
    setDraft(EMPTY);
    setBaseline(EMPTY);
    setErrors({});
    setOpen(true);
  }

  function openEdit(article: Article) {
    const next = toDraft(article);
    setEditing(article);
    setDraft(next);
    setBaseline(next);
    setErrors({});
    setOpen(true);
  }

  async function closeEditor(force = false) {
    if (!force && dirty) {
      const discard = await confirm({
        title: "Хадгалаагүй өөрчлөлт байна",
        description: "Бичсэн зүйлээ хадгалахгүйгээр хаах уу? Хадгалаагүй өөрчлөлт устна.",
        confirmLabel: "Хадгалахгүй хаах",
        cancelLabel: "Буцаж бичих",
        tone: "danger",
      });
      if (!discard) return;
    }
    setOpen(false);
    setEditing(null);
  }

  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    const next: typeof errors = {};
    if (!draft.title.trim()) next.title = "Гарчиг оруулна уу";
    if (config.kind === "post" && !draft.body.trim()) next.body = "Нийтлэлийн бичвэрээ оруулна уу";
    if (config.kind === "knowledge" && !draft.body.trim() && draft.facts.length === 0) {
      next.body = "Ядаж нэг сонирхолтой баримт эсвэл бичвэр оруулна уу";
    }
    if (draft.coverImage.trim() && !isAllowedImageHost(draft.coverImage.trim())) {
      toast.error("Нүүр зургийн холбоос дэмжигдэхгүй байна. «Файл сонгох» товчоор зургаа байршуулна уу.");
      return;
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate();
  }

  async function askDelete(article: Article) {
    const ok = await confirm({
      title: config.deleteTitle,
      description: `«${article.title}» бүрмөсөн устна. Буцааж сэргээх боломжгүй. Түр нуух бол «Сайтад» унтраалгыг унтраахад хангалттай.`,
      confirmLabel: "Устгах",
      tone: "danger",
    });
    if (ok) remove.mutate(article);
  }

  const all = useMemo(() => articles.data ?? [], [articles.data]);
  const publishedCount = all.filter((article) => article.isPublished).length;
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return all.filter((article) => {
      if (status === "published" && !article.isPublished) return false;
      if (status === "draft" && article.isPublished) return false;
      if (!term) return true;
      return [article.title, article.excerpt].filter(Boolean).join(" ").toLocaleLowerCase().includes(term);
    });
  }, [all, status, search]);

  const words = draft.body.trim() ? draft.body.trim().split(/\s+/).length : 0;

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <Button onClick={openNew}>
            <Plus />
            {config.addLabel}
          </Button>
        }
      />

      <div className="space-y-3">
        <FilterChips
          label="Төлвөөр шүүх"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Бүгд", count: all.length },
            { value: "published", label: "Нийтлэгдсэн", count: publishedCount },
            { value: "draft", label: "Ноорог", count: all.length - publishedCount },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Гарчгаар хайх" />
      </div>

      <Panel className="mt-4" bodyClassName="p-0 sm:p-0">
        {articles.isPending ? (
          <LoadingRows rows={4} className="p-4" rowClassName="h-16" />
        ) : articles.isError ? (
          <ErrorState error={articles.error} onRetry={() => articles.refetch()} />
        ) : !all.length ? (
          <EmptyState
            icon={FileText}
            title={config.emptyTitle}
            description={config.emptyDescription}
            action={
              <Button onClick={openNew}>
                <Plus />
                {config.addLabel}
              </Button>
            }
          />
        ) : !visible.length ? (
          <EmptyState
            icon={FileText}
            title="Тохирох зүйл олдсонгүй"
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                }}
              >
                Шүүлтүүрийг арилгах
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((article) => (
              <li key={article.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                    {article.coverImage && isAllowedImageHost(article.coverImage) ? (
                      <Image src={article.coverImage} alt="" fill sizes="80px" className="object-cover" />
                    ) : (
                      <ImageOff className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => openEdit(article)}
                      className="line-clamp-2 text-left text-sm font-semibold hover:text-primary hover:underline"
                    >
                      {article.title}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <StatusBadge tone={article.isPublished ? "success" : "neutral"}>
                        {article.isPublished ? "Нийтлэгдсэн" : "Ноорог"}
                      </StatusBadge>
                      <span>
                        {article.isPublished && article.publishedAt
                          ? `Нийтэлсэн: ${formatDate(article.publishedAt)}`
                          : `Үүсгэсэн: ${formatDate(article.createdAt)}`}
                      </span>
                      {config.kind === "knowledge" && <span>· {article.facts?.length ?? 0} баримт</span>}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={article.isPublished}
                      disabled={togglePublish.isPending && togglePublish.variables?.article.id === article.id}
                      onCheckedChange={(isPublished) => togglePublish.mutate({ article, isPublished })}
                      label={`Сайтад нийтлэх: ${article.title}`}
                    />
                    <span>Сайтад</span>
                  </label>
                  {article.isPublished && (
                    <Button asChild size="sm" variant="ghost">
                      <a href={publicHref(article)} target="_blank" rel="noopener noreferrer">
                        <ExternalLink />
                        Харах
                      </a>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openEdit(article)}>
                    <Pencil />
                    Засах
                  </Button>
                  <Button size="sm" variant="ghost" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => askDelete(article)}>
                    <Trash2 />
                    Устгах
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <SidePanel
        open={open}
        onOpenChange={(next) => !next && closeEditor()}
        className="sm:max-w-2xl"
        title={editing ? `${config.noun[0].toUpperCase()}${config.noun.slice(1)} засах` : config.addLabel}
        description={editing ? editing.title : "Бичиж дуусаад «Хадгалах» дарна. Ноорог нь зөвхөн энд харагдана."}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {dirty ? "Хадгалаагүй өөрчлөлт байна" : editing ? "Өөрчлөлт алга" : ""}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => closeEditor()} disabled={save.isPending}>
                Болих
              </Button>
              <Button onClick={() => submit()} disabled={save.isPending || (Boolean(editing) && !dirty)}>
                {save.isPending && <Loader2 className="animate-spin" />}
                {draft.isPublished ? (editing?.isPublished ? "Хадгалах" : "Хадгалаад нийтлэх") : "Ноорог хадгалах"}
              </Button>
            </div>
          </div>
        }
      >
        <form onSubmit={submit} className="grid gap-5">
          <FormField label="Гарчиг" required error={errors.title}>
            <Input
              value={draft.title}
              onChange={(event) => {
                setDraft({ ...draft, title: event.target.value });
                setErrors((current) => ({ ...current, title: undefined }));
              }}
              placeholder={config.titlePlaceholder}
            />
          </FormField>

          <FormField label="Товч тайлбар" hint="Жагсаалт болон Facebook-т хуваалцахад харагдах 1–2 өгүүлбэр.">
            <Textarea rows={2} value={draft.excerpt} onChange={(event) => setDraft({ ...draft, excerpt: event.target.value })} />
          </FormField>

          <ImageUploadField label="Нүүр зураг" value={draft.coverImage} onChange={(coverImage) => setDraft({ ...draft, coverImage })} />

          {config.kind === "knowledge" && (
            <>
              <ImageUploadField label="Бичлэг (заавал биш)" value={draft.video} onChange={(video) => setDraft({ ...draft, video })} resourceType="video" />
              <StringListField
                label="Сонирхолтой баримтууд"
                hint="Нэг мөрөнд нэг баримт. Жишээ нь: «Урт нь 21,196 км»."
                values={draft.facts}
                onChange={(facts) => {
                  setDraft({ ...draft, facts });
                  setErrors((current) => ({ ...current, body: undefined }));
                }}
                placeholder="Баримтаа бичээд Enter дарна уу"
              />
            </>
          )}

          <FormField
            label={config.kind === "post" ? "Бичвэр" : "Нэмэлт бичвэр"}
            required={config.kind === "post"}
            error={errors.body}
            hint={`${formatNumber(words)} үг. Мөр таслах нь сайт дээр яг хэвээр харагдана.`}
          >
            <Textarea
              rows={config.kind === "post" ? 16 : 8}
              value={draft.body}
              onChange={(event) => {
                setDraft({ ...draft, body: event.target.value });
                setErrors((current) => ({ ...current, body: undefined }));
              }}
              placeholder={config.kind === "post" ? "Нийтлэлийн бүтэн бичвэр" : "Баримтуудын эргэн тойрон өгүүлэх бичвэр (заавал биш)"}
            />
          </FormField>

          <div className="rounded-lg border border-border px-4">
            <SwitchField
              label="Сайтад нийтлэх"
              description="Унтраалттай бол ноорог хэвээр үлдэж, зөвхөн энд харагдана."
              checked={draft.isPublished}
              onCheckedChange={(isPublished) => setDraft({ ...draft, isPublished })}
            />
          </div>

          {editing?.isPublished && (
            <a href={publicHref(editing)} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <ExternalLink className="h-4 w-4" />
              Сайт дээр харах
            </a>
          )}
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      </SidePanel>
    </>
  );
}
