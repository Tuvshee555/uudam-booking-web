"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Gift,
  Inbox,
  Loader2,
  Mail,
  MapPinned,
  Phone,
  RefreshCw,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import {
  ENQUIRY_KIND_INFO,
  ENQUIRY_KINDS,
  ENQUIRY_NEXT_STATUS,
  ENQUIRY_STATUS_INFO,
  ENQUIRY_STATUSES,
  type EnquiryKind,
  type EnquiryStatus,
  type Tone,
} from "@/components/admin/statuses";
import {
  DetailRow,
  EmptyState,
  ErrorState,
  FilterChips,
  LoadingRows,
  PageHeader,
  Pagination,
  Panel,
  SearchInput,
  SelectFilter,
  SidePanel,
  StatusBadge,
  useConfirm,
  useDebouncedValue,
} from "@/components/admin/ui";
import { useScopedSelection, useUrlFilters } from "@/components/admin/useUrlFilters";
import { useAdminSummary, LIVE_QUERY } from "@/hooks/useAdminSummary";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { departureDateKey } from "@/lib/departureDate";
import {
  dateFromKey,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPeople,
  formatRelative,
  fullName,
  telHref,
  totalPeople,
} from "@/lib/adminFormat";
import { cn } from "@/lib/utils";

type Enquiry = {
  id: string;
  reference: string;
  kind: EnquiryKind;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  adults: number;
  children: number;
  infants: number;
  message: string | null;
  estimatedTotal: number | null;
  status: EnquiryStatus;
  staffNotes: string | null;
  departureDate: string | null;
  destination: string | null;
  preferredDates: string | null;
  budgetPerPerson: number | null;
  giftAmount: number | null;
  giftRecipient: string | null;
  source: string | null;
  referrer: string | null;
  createdAt: string;
  trip: { id: string; slug: string; title: string; image: string } | null;
  departure: { id: string; startDate: string; label: string | null } | null;
  handledBy: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
};

type ListResponse = {
  enquiries: Enquiry[];
  newCount: number;
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

const PAGE_SIZE = 25;

const STATUS_SELECT_TONE: Record<Tone, string> = {
  neutral: "border-border bg-muted text-foreground",
  brand: "border-primary/30 bg-primary/5 text-primary",
  info: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-200",
  success: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200",
  warning: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200",
  danger: "border-red-300 bg-red-50 text-red-900 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200",
};

/** What the person asked about, in one line — the trip, or the custom/gift details. */
function requestSummary(enquiry: Enquiry): string {
  if (enquiry.kind === "CUSTOM") return enquiry.destination ? `Захиалгат аялал: ${enquiry.destination}` : "Захиалгат аялал (чиглэл заагаагүй)";
  if (enquiry.kind === "GIFT") return enquiry.giftAmount ? `Бэлгийн эрх: ${formatMoney(enquiry.giftAmount)}` : "Бэлгийн эрх";
  return enquiry.trip?.title ?? "Аялал сонгоогүй";
}

function wantedDate(enquiry: Enquiry): string | null {
  const date = enquiry.departureDate ?? enquiry.departure?.startDate ?? null;
  if (date) return formatDate(dateFromKey(departureDateKey(date)));
  return enquiry.preferredDates;
}

function staffName(user: Enquiry["handledBy"]) {
  if (!user) return null;
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

export default function EnquiriesClient() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data: summary } = useAdminSummary();

  const [filters, setFilters] = useUrlFilters({ status: "ALL", kind: "ALL", q: "", order: "desc", page: "1", open: "" });
  const page = Math.max(1, Number(filters.page) || 1);

  const [searchDraft, setSearchDraft] = useState(filters.q);
  const search = useDebouncedValue(searchDraft.trim(), 350);
  useEffect(() => {
    if (search !== filters.q) setFilters({ q: search, page: null });
    // Only a settled search should move the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const [selected, setSelected] = useScopedSelection(`${filters.status}|${filters.kind}|${filters.q}|${page}`);
  const [bulkStatus, setBulkStatus] = useState<EnquiryStatus>("CONTACTED");

  const list = useQuery<ListResponse>({
    queryKey: ["admin", "enquiries", filters.status, filters.kind, filters.q, filters.order, page],
    queryFn: async () =>
      (
        await api.get<ListResponse>("/enquiries", {
          params: {
            status: filters.status,
            kind: filters.kind,
            search: filters.q || undefined,
            order: filters.order,
            page,
            limit: PAGE_SIZE,
          },
        })
      ).data,
    placeholderData: keepPreviousData,
    ...LIVE_QUERY,
  });

  const enquiries = useMemo(() => list.data?.enquiries ?? [], [list.data]);
  const filtersActive = filters.status !== "ALL" || filters.kind !== "ALL" || Boolean(filters.q);

  // Marking the last items on a page as handled can leave that page empty under its filter.
  useEffect(() => {
    if (list.data && list.data.enquiries.length === 0 && page > 1) {
      setFilters({ page: String(list.data.pagination.totalPages) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.data, page]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: EnquiryStatus; previous?: EnquiryStatus; name?: string }) =>
      (await api.patch<Enquiry>(`/enquiries/${id}`, { status })).data,
    onSuccess: (saved, { id, status, previous, name }) => {
      queryClient.setQueryData(["admin", "enquiry", id], saved);
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      const label = ENQUIRY_STATUS_INFO[status].label;
      toast.success(`${name ?? "Хүсэлт"}: «${label}» боллоо`, {
        duration: 8000,
        action:
          previous && previous !== status
            ? { label: "Буцаах", onClick: () => updateStatus.mutate({ id, status: previous, name }) }
            : undefined,
      });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Төлөв өөрчлөхөд алдаа гарлаа")),
  });

  const bulkUpdate = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: EnquiryStatus }) => {
      const results = await Promise.allSettled(ids.map((id) => api.patch(`/enquiries/${id}`, { status })));
      return { ok: results.filter((r) => r.status === "fulfilled").length, failed: results.filter((r) => r.status === "rejected").length, status };
    },
    onSuccess: ({ ok, failed, status }) => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      setSelected(new Set());
      if (ok) toast.success(`${ok} хүсэлтийг «${ENQUIRY_STATUS_INFO[status].label}» болголоо`);
      if (failed) toast.error(`${failed} хүсэлтийг өөрчилж чадсангүй. Дахин оролдоно уу.`);
    },
  });

  const openId = filters.open || null;
  const openFromList = enquiries.find((enquiry) => enquiry.id === openId);

  async function changeStatus(enquiry: Enquiry, status: EnquiryStatus) {
    if (status === enquiry.status) return;
    updateStatus.mutate({ id: enquiry.id, status, previous: enquiry.status, name: fullName(enquiry.firstName, enquiry.lastName) });
  }

  async function applyBulk() {
    const ids = [...selected];
    if (!ids.length) return;
    const label = ENQUIRY_STATUS_INFO[bulkStatus].label;
    const ok = await confirm({
      title: `${ids.length} хүсэлтийг «${label}» болгох уу?`,
      description: "Сонгосон бүх хүсэлтийн төлөв нэг дор өөрчлөгдөнө.",
      confirmLabel: "Өөрчлөх",
      tone: bulkStatus === "CANCELLED" ? "danger" : "default",
    });
    if (ok) bulkUpdate.mutate({ ids, status: bulkStatus });
  }

  const statusOptions = [
    { value: "ALL", label: "Бүгд", count: summary?.enquiries.total },
    ...ENQUIRY_STATUSES.map((status) => ({
      value: status,
      label: ENQUIRY_STATUS_INFO[status].label,
      count: summary?.enquiries.byStatus[status] ?? (summary ? 0 : undefined),
    })),
  ];

  const kindOptions = [
    { value: "ALL", label: "Бүх төрөл" },
    ...ENQUIRY_KINDS.map((kind) => {
      const count = summary?.enquiries.byKind[kind];
      return { value: kind, label: `${ENQUIRY_KIND_INFO[kind].label}${count !== undefined ? ` (${count})` : ""}` };
    }),
  ];

  const allOnPageSelected = enquiries.length > 0 && enquiries.every((enquiry) => selected.has(enquiry.id));

  function toggleAll() {
    setSelected(allOnPageSelected ? new Set() : new Set(enquiries.map((enquiry) => enquiry.id)));
  }

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <PageHeader
        title="Хүсэлтүүд"
        description="Сайтаас «надтай холбогдоорой» гэж үлдээсэн хүмүүс. Шинэ хүсэлт рүү залгаад, ярьсны дараа төлвийг нь өөрчилнө. Хүн дээр дарж бүх мэдээлэл, тэмдэглэлийг харна."
        actions={
          <Button variant="outline" onClick={() => list.refetch()} disabled={list.isFetching}>
            <RefreshCw className={cn(list.isFetching && "animate-spin")} />
            Шинэчлэх
          </Button>
        }
      />

      <div className="space-y-3">
        <FilterChips
          label="Төлвөөр шүүх"
          options={statusOptions}
          value={filters.status}
          onChange={(status) => setFilters({ status, page: null })}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput
            className="flex-1"
            value={searchDraft}
            onChange={setSearchDraft}
            placeholder="Нэр, утас, дугаараар хайх"
          />
          <SelectFilter
            label="Хүсэлтийн төрөл"
            value={filters.kind}
            onChange={(kind) => setFilters({ kind, page: null })}
            options={kindOptions}
          />
          <SelectFilter
            label="Эрэмбэ"
            value={filters.order}
            onChange={(order) => setFilters({ order, page: null })}
            options={[
              { value: "desc", label: "Шинэ нь эхэндээ" },
              { value: "asc", label: "Удаан хүлээсэн нь эхэндээ" },
            ]}
          />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-14 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-card px-4 py-3 shadow-md lg:top-2">
          <span className="text-sm font-semibold">{selected.size} хүсэлт сонгосон</span>
          <span className="hidden text-muted-foreground sm:inline">·</span>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Төлвийг
            <select
              value={bulkStatus}
              onChange={(event) => setBulkStatus(event.target.value as EnquiryStatus)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            >
              {ENQUIRY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {ENQUIRY_STATUS_INFO[status].label}
                </option>
              ))}
            </select>
            болгох
          </label>
          <Button size="sm" onClick={applyBulk} disabled={bulkUpdate.isPending}>
            {bulkUpdate.isPending ? <Loader2 className="animate-spin" /> : <Check />}
            Хэрэглэх
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="ml-auto">
            <X />
            Сонголтыг цуцлах
          </Button>
        </div>
      )}

      <Panel className="mt-4" bodyClassName="p-0 sm:p-0">
        {list.isPending ? (
          <LoadingRows rows={6} className="p-4" />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : enquiries.length === 0 ? (
          filtersActive ? (
            <EmptyState
              icon={Inbox}
              title="Тохирох хүсэлт олдсонгүй"
              description="Өөр үгээр хайх эсвэл шүүлтүүрээ арилгаад үзнэ үү."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchDraft("");
                    setFilters({ status: null, kind: null, q: null, page: null });
                  }}
                >
                  Шүүлтүүрийг арилгах
                </Button>
              }
            />
          ) : (
            <EmptyState icon={Inbox} title="Хүсэлт хараахан ирээгүй байна" description="Сайтаас хэн нэгэн холбогдох хүсэлт үлдээхэд энд харагдана." />
          )
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-sm text-muted-foreground">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={allOnPageSelected} onChange={toggleAll} className="h-4 w-4 accent-primary" />
                Энэ хуудсыг бүгдийг сонгох
              </label>
              <span className="tabular-nums">
                {formatNumber(list.data?.pagination.total ?? 0)} хүсэлт{filtersActive ? " олдлоо" : ""}
              </span>
            </div>

            <ul className={cn("divide-y divide-border", list.isPlaceholderData && "opacity-60")}>
              {enquiries.map((enquiry) => {
                const name = fullName(enquiry.firstName, enquiry.lastName);
                const info = ENQUIRY_STATUS_INFO[enquiry.status];
                const date = wantedDate(enquiry);
                return (
                  <li key={enquiry.id} className={cn("flex gap-3 px-4 py-3.5", selected.has(enquiry.id) && "bg-primary/5")}>
                    <input
                      type="checkbox"
                      checked={selected.has(enquiry.id)}
                      onChange={() => toggleOne(enquiry.id)}
                      aria-label={`${name} сонгох`}
                      className="mt-1 h-4 w-4 shrink-0 accent-primary"
                    />
                    <div className="grid min-w-0 flex-1 gap-x-4 gap-y-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto] md:items-center">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setFilters({ open: enquiry.id })}
                          className="max-w-full truncate text-left text-sm font-semibold text-foreground hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {name}
                        </button>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                          <a href={telHref(enquiry.phone)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                            <Phone className="h-3.5 w-3.5" />
                            {enquiry.phone}
                          </a>
                          <span className="text-xs text-muted-foreground" title={formatDateTime(enquiry.createdAt)}>
                            {formatRelative(enquiry.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div className="min-w-0 text-sm">
                        <p className="flex items-center gap-1.5 truncate font-medium">
                          {enquiry.kind === "GIFT" ? (
                            <Gift className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          ) : enquiry.kind === "CUSTOM" ? (
                            <MapPinned className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          ) : null}
                          <span className="truncate">{requestSummary(enquiry)}</span>
                        </p>
                        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {totalPeople(enquiry)} хүн
                          </span>
                          {date && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {date}
                            </span>
                          )}
                          {enquiry.estimatedTotal != null && <span>~{formatMoney(enquiry.estimatedTotal)}</span>}
                          {enquiry.staffNotes && <span className="text-foreground/70">Тэмдэглэлтэй</span>}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 md:justify-end">
                        <select
                          aria-label={`Төлөв: ${name}`}
                          title={info.description}
                          value={enquiry.status}
                          disabled={updateStatus.isPending && updateStatus.variables?.id === enquiry.id}
                          onChange={(event) => changeStatus(enquiry, event.target.value as EnquiryStatus)}
                          className={cn(
                            "h-9 rounded-md border px-2 text-sm font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                            STATUS_SELECT_TONE[info.tone],
                          )}
                        >
                          {ENQUIRY_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {ENQUIRY_STATUS_INFO[status].label}
                            </option>
                          ))}
                        </select>
                        <Button variant="outline" size="sm" className="h-9" onClick={() => setFilters({ open: enquiry.id })}>
                          Дэлгэрэнгүй
                          <ChevronRight />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={list.data?.pagination.total ?? 0}
              onPageChange={(next) => {
                setFilters({ page: String(next) });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          </>
        )}
      </Panel>

      <EnquiryDetail
        id={openId}
        initial={openFromList}
        locale={locale}
        onClose={() => setFilters({ open: null })}
        onStatusChange={changeStatus}
        statusPending={updateStatus.isPending}
      />
    </>
  );
}

function EnquiryDetail({
  id,
  initial,
  locale,
  onClose,
  onStatusChange,
  statusPending,
}: {
  id: string | null;
  initial?: Enquiry;
  locale: string;
  onClose: () => void;
  onStatusChange: (enquiry: Enquiry, status: EnquiryStatus) => void;
  statusPending: boolean;
}) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const detail = useQuery<Enquiry>({
    queryKey: ["admin", "enquiry", id],
    queryFn: async () => (await api.get<Enquiry>(`/enquiries/${id}`)).data,
    enabled: Boolean(id),
    initialData: initial,
    ...LIVE_QUERY,
  });
  const enquiry = detail.data;

  // The notes box keeps what is typed until it is saved or the panel moves to someone else.
  const [notes, setNotes] = useState<{ id: string; text: string } | null>(null);
  const notesText = notes && notes.id === enquiry?.id ? notes.text : (enquiry?.staffNotes ?? "");
  const notesDirty = Boolean(enquiry) && notesText !== (enquiry?.staffNotes ?? "");

  const saveNotes = useMutation({
    mutationFn: async () => (await api.patch<Enquiry>(`/enquiries/${enquiry!.id}`, { staffNotes: notesText })).data,
    onSuccess: (saved) => {
      queryClient.setQueryData(["admin", "enquiry", saved.id], saved);
      queryClient.invalidateQueries({ queryKey: ["admin", "enquiries"] });
      setNotes(null);
      toast.success("Тэмдэглэл хадгалагдлаа");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Тэмдэглэл хадгалахад алдаа гарлаа")),
  });

  const remove = useMutation({
    mutationFn: async () => api.delete(`/enquiries/${enquiry!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Хүсэлт устгагдлаа");
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Устгахад алдаа гарлаа")),
  });

  async function close() {
    if (notesDirty) {
      const discard = await confirm({
        title: "Хадгалаагүй тэмдэглэл байна",
        description: "Бичсэн тэмдэглэлээ хадгалахгүйгээр хаах уу?",
        confirmLabel: "Хадгалахгүй хаах",
        tone: "danger",
      });
      if (!discard) return;
    }
    setNotes(null);
    onClose();
  }

  async function askDelete() {
    if (!enquiry) return;
    const ok = await confirm({
      title: "Энэ хүсэлтийг устгах уу?",
      description: `${enquiry.reference} дугаартай хүсэлт (${fullName(enquiry.firstName, enquiry.lastName)}) бүрмөсөн устна. Буцааж сэргээх боломжгүй. Спам эсвэл давхар ирсэн хүсэлтийг л устгана уу.`,
      confirmLabel: "Устгах",
      tone: "danger",
    });
    if (ok) remove.mutate();
  }

  function copy(text: string, label: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${label} хууллаа`))
      .catch(() => toast.error("Хуулж чадсангүй"));
  }

  const next = enquiry ? ENQUIRY_NEXT_STATUS[enquiry.status] : undefined;
  const date = enquiry ? wantedDate(enquiry) : null;

  return (
    <SidePanel
      open={Boolean(id)}
      onOpenChange={(open) => !open && close()}
      title={enquiry ? fullName(enquiry.firstName, enquiry.lastName) : "Хүсэлт"}
      description={
        enquiry
          ? `${ENQUIRY_KIND_INFO[enquiry.kind]?.label ?? "Хүсэлт"} · ${enquiry.reference} · ${formatRelative(enquiry.createdAt)}`
          : undefined
      }
      footer={
        enquiry && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={askDelete} disabled={remove.isPending}>
              <Trash2 />
              Устгах
            </Button>
            <div className="flex flex-wrap gap-2">
              {enquiry.status !== "CANCELLED" && enquiry.status !== "COMPLETED" && (
                <Button variant="outline" onClick={() => onStatusChange(enquiry, "CANCELLED")} disabled={statusPending}>
                  Цуцалсан
                </Button>
              )}
              {next && (
                <Button onClick={() => onStatusChange(enquiry, next.status)} disabled={statusPending}>
                  {statusPending ? <Loader2 className="animate-spin" /> : <Check />}
                  {next.label}
                </Button>
              )}
            </div>
          </div>
        )
      }
    >
      {!enquiry ? (
        detail.isError ? (
          <ErrorState error={detail.error} title="Хүсэлт олдсонгүй" onRetry={() => detail.refetch()} />
        ) : (
          <LoadingRows rows={6} />
        )
      ) : (
        <div className="space-y-6">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild size="lg" className="h-11 px-4">
              <a href={telHref(enquiry.phone)}>
                <Phone />
                Залгах · {enquiry.phone}
              </a>
            </Button>
            {enquiry.email ? (
              <Button asChild variant="outline" size="lg" className="h-11 px-4">
                <a href={`mailto:${enquiry.email}`}>
                  <Mail />
                  И-мэйл бичих
                </a>
              </Button>
            ) : (
              <Button variant="outline" size="lg" className="h-11 px-4" onClick={() => copy(enquiry.phone, "Утасны дугаар")}>
                <Copy />
                Дугаар хуулах
              </Button>
            )}
          </div>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Төлөв</h3>
            <div role="radiogroup" aria-label="Хүсэлтийн төлөв" className="grid gap-1.5">
              {ENQUIRY_STATUSES.map((status) => {
                const info = ENQUIRY_STATUS_INFO[status];
                const active = enquiry.status === status;
                return (
                  <button
                    key={status}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={statusPending}
                    onClick={() => onStatusChange(enquiry, status)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                      active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        active ? "border-primary bg-primary" : "border-muted-foreground/40",
                      )}
                    >
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                    </span>
                    <span className="min-w-0">
                      <StatusBadge tone={info.tone}>{info.label}</StatusBadge>
                      <span className="mt-1 block text-xs text-muted-foreground">{info.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="mb-1 text-sm font-semibold">Юу хүссэн бэ</h3>
            <dl className="divide-y divide-border">
              <DetailRow label="Төрөл">{ENQUIRY_KIND_INFO[enquiry.kind]?.label}</DetailRow>
              {enquiry.trip && (
                <DetailRow label="Аялал">
                  <span className="block">{enquiry.trip.title}</span>
                  <span className="mt-1 flex flex-wrap gap-x-3 text-xs font-normal">
                    <Link href={`/${locale}/admin/trips/${enquiry.trip.id}/edit`} className="text-primary hover:underline">
                      Аяллыг засах
                    </Link>
                    <a href={`/${locale}/trips/${enquiry.trip.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      Сайт дээр харах
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </span>
                </DetailRow>
              )}
              {enquiry.kind === "CUSTOM" && <DetailRow label="Хаашаа">{enquiry.destination || "Заагаагүй"}</DetailRow>}
              {enquiry.kind === "CUSTOM" && enquiry.budgetPerPerson != null && (
                <DetailRow label="Нэг хүний төсөв">{formatMoney(enquiry.budgetPerPerson)}</DetailRow>
              )}
              {enquiry.kind === "GIFT" && <DetailRow label="Бэлгийн дүн">{formatMoney(enquiry.giftAmount)}</DetailRow>}
              {enquiry.kind === "GIFT" && <DetailRow label="Хэнд бэлэглэх">{enquiry.giftRecipient || "Заагаагүй"}</DetailRow>}
              <DetailRow label="Хэзээ явах">{date ?? "Тодруулаагүй"}</DetailRow>
              <DetailRow label="Хүний тоо">
                {formatPeople(enquiry)} <span className="font-normal text-muted-foreground">(нийт {totalPeople(enquiry)})</span>
              </DetailRow>
              {enquiry.estimatedTotal != null && (
                <DetailRow label="Урьдчилсан үнэ">
                  ~{formatMoney(enquiry.estimatedTotal)}
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    Сайтын үнээр автоматаар тооцсон. Эцсийн үнийг ярихдаа хэлнэ.
                  </span>
                </DetailRow>
              )}
            </dl>
            {enquiry.message && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Үйлчлүүлэгчийн бичсэн зурвас</p>
                <p className="whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-sm leading-relaxed">{enquiry.message}</p>
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-1 text-sm font-semibold">Холбоо барих</h3>
            <dl className="divide-y divide-border">
              <DetailRow label="Утас">
                <span className="inline-flex flex-wrap items-center gap-2">
                  <a href={telHref(enquiry.phone)} className="text-primary hover:underline">
                    {enquiry.phone}
                  </a>
                  <button type="button" onClick={() => copy(enquiry.phone, "Утасны дугаар")} className="text-xs font-normal text-muted-foreground hover:text-foreground">
                    Хуулах
                  </button>
                </span>
              </DetailRow>
              <DetailRow label="И-мэйл">
                {enquiry.email ? (
                  <a href={`mailto:${enquiry.email}`} className="text-primary hover:underline">
                    {enquiry.email}
                  </a>
                ) : (
                  <span className="font-normal text-muted-foreground">Үлдээгээгүй</span>
                )}
              </DetailRow>
            </dl>
          </section>

          <section>
            <label htmlFor="enquiry-notes" className="mb-1 block text-sm font-semibold">
              Ажилтны тэмдэглэл
            </label>
            <p className="mb-2 text-xs text-muted-foreground">Зөвхөн ажилтнууд харна. Жишээ нь: «Маргааш 14:00-д дахин залгана».</p>
            <Textarea
              id="enquiry-notes"
              rows={4}
              value={notesText}
              onChange={(event) => setNotes({ id: enquiry.id, text: event.target.value })}
              placeholder="Ярьсан зүйл, дараагийн алхмаа энд бичнэ үү"
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              {notesDirty && <span className="text-xs text-amber-700 dark:text-amber-300">Хадгалаагүй өөрчлөлт</span>}
              {notesDirty && (
                <Button variant="ghost" size="sm" onClick={() => setNotes(null)}>
                  Болих
                </Button>
              )}
              <Button size="sm" onClick={() => saveNotes.mutate()} disabled={!notesDirty || saveNotes.isPending}>
                {saveNotes.isPending && <Loader2 className="animate-spin" />}
                Тэмдэглэл хадгалах
              </Button>
            </div>
          </section>

          <section>
            <h3 className="mb-1 text-sm font-semibold">Нэмэлт мэдээлэл</h3>
            <dl className="divide-y divide-border">
              <DetailRow label="Хүсэлтийн дугаар">
                <span className="inline-flex items-center gap-2 font-mono">
                  {enquiry.reference}
                  <button type="button" onClick={() => copy(enquiry.reference, "Дугаар")} className="font-sans text-xs font-normal text-muted-foreground hover:text-foreground">
                    Хуулах
                  </button>
                </span>
              </DetailRow>
              <DetailRow label="Ирсэн">{formatDateTime(enquiry.createdAt)}</DetailRow>
              <DetailRow label="Хариуцсан ажилтан">
                {staffName(enquiry.handledBy) ?? <span className="font-normal text-muted-foreground">Хараахан аваагүй</span>}
              </DetailRow>
              <DetailRow label="Хаанаас орж ирсэн">
                {enquiry.referrer || enquiry.source || <span className="font-normal text-muted-foreground">Шууд орсон</span>}
              </DetailRow>
            </dl>
          </section>
        </div>
      )}
    </SidePanel>
  );
}
