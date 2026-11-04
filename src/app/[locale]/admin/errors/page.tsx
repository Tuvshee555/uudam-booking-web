"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, FilterChips, PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { api } from "@/lib/api";
import { formatDateTime, formatRelative } from "@/lib/adminFormat";

type ErrorRow = {
  id: string;
  createdAt: string;
  source: "server" | "browser";
  level: "error" | "warn";
  method: string;
  path: string;
  status: number | null;
  message: string;
  userEmail: string | null;
  details: Record<string, unknown> | null;
};

type ErrorLogResponse = { hours: number; rows: ErrorRow[]; counts: { server: number; browser: number } };

const SOURCE_LABEL: Record<ErrorRow["source"], string> = { server: "Сервер", browser: "Хөтөч" };

/**
 * The last three days of what went wrong on the site: refused saves and logins,
 * chatbot syncs that did not take every field, pages that crashed in a browser.
 * Older entries are deleted automatically.
 */
export default function AdminErrorsPage() {
  const [source, setSource] = useState<"all" | "server" | "browser">("all");
  const [query, setQuery] = useState("");
  const { data, isPending, isFetching, refetch, error } = useQuery({
    queryKey: ["admin", "errors", source, query],
    queryFn: async () => (await api.get("/admin/errors", { params: { source: source === "all" ? undefined : source, q: query || undefined } })).data as ErrorLogResponse,
  });

  return (
    <>
      <PageHeader
        title="Алдааны бүртгэл"
        description="Сүүлийн 3 хоногт сайт дээр гарсан алдаа: хадгалагдаагүй засвар, нэвтрэлт, chatbot руу дамжаагүй талбар, хөтөч дээр эвдэрсэн хуудас. 3 хоногоос хуучин бичлэг автоматаар устна."
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Шинэчлэх
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterChips
          label="Эх үүсвэрээр шүүх"
          value={source}
          onChange={setSource}
          options={[
            { value: "all", label: "Бүгд", count: data ? data.counts.server + data.counts.browser : undefined },
            { value: "server", label: "Сервер", count: data?.counts.server },
            { value: "browser", label: "Хөтөч", count: data?.counts.browser },
          ]}
        />
        <Input
          aria-label="Алдаанаас хайх"
          placeholder="Хайх: мессеж, хуудас, и-мэйл"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="sm:max-w-xs"
        />
      </div>
      {isPending ? (
        <Panel>
          <div role="status" className="flex items-center justify-center gap-3 py-14 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Ачаалж байна…
          </div>
        </Panel>
      ) : error || !data ? (
        <Panel>
          <ErrorState error={error} title="Алдааны бүртгэлийг ачаалж чадсангүй" onRetry={() => refetch()} />
        </Panel>
      ) : data.rows.length === 0 ? (
        <Panel>
          <EmptyState icon={CheckCircle2} title="Сүүлийн 3 хоногт алдаа бүртгэгдээгүй" description="Хадгалалт, нэвтрэлт, хуудас бүгд хэвийн ажилласан." />
        </Panel>
      ) : (
        <ul className="space-y-2">
          {data.rows.map((row) => (
            <li key={row.id}>
              <Panel bodyClassName="p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <StatusBadge tone={row.level === "error" ? "danger" : "warning"}>{row.level === "error" ? "Алдаа" : "Анхааруулга"}</StatusBadge>
                  <span>{SOURCE_LABEL[row.source]}</span>
                  {row.status ? <span>HTTP {row.status}</span> : null}
                  <span title={formatDateTime(row.createdAt)}>{formatRelative(row.createdAt)}</span>
                  {row.userEmail ? <span className="break-all">{row.userEmail}</span> : null}
                </div>
                <p className="mt-2 break-words text-sm font-medium">{row.message || "(мессежгүй)"}</p>
                <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{[row.method, row.path].filter(Boolean).join(" ")}</p>
                {row.details && Object.keys(row.details).length > 0 ? (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Дэлгэрэнгүй</summary>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-2">{JSON.stringify(row.details, null, 2)}</pre>
                  </details>
                ) : null}
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
