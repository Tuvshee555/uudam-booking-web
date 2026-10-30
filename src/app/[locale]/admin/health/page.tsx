"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Pencil, RefreshCw, ShieldCheck, XCircle } from "lucide-react";

import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, FilterChips, PageHeader, Panel, StatCard, StatusBadge } from "@/components/admin/ui";
import { useTripHealth } from "@/hooks/useTripHealth";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/adminFormat";
import type { HealthIssue } from "@/lib/tripHealth";

/**
 * Every published trip checked for the mistakes that reached customers before:
 * phantom next-year dates, a flat price where hotel fares belong, child fares
 * above adult fares, prices that drifted from the partner's table, edits that
 * never synced. Runs on open and daily by cron (emailed when errors exist).
 */
export default function AdminHealthPage() {
  const { locale } = useI18n();
  const { data, isPending, isFetching, refetch, error } = useTripHealth();
  const [filter, setFilter] = useState<"all" | "errors" | "warnings">("all");

  const groups = useMemo(() => {
    const byTrip = new Map<string, HealthIssue[]>();
    for (const issue of data?.issues ?? []) byTrip.set(issue.tripId, [...(byTrip.get(issue.tripId) ?? []), issue]);
    return [...byTrip.values()]
      .map((issues) => ({
        issues: [...issues].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1)),
        errors: issues.filter((issue) => issue.severity === "error").length,
        warnings: issues.filter((issue) => issue.severity === "warning").length,
      }))
      .sort((a, b) => b.errors - a.errors || b.warnings - a.warnings);
  }, [data]);

  const visible = groups.filter((group) => (filter === "errors" ? group.errors > 0 : filter === "warnings" ? group.warnings > 0 : true));
  const tripsWithErrors = groups.filter((group) => group.errors > 0).length;
  const tripsWithWarnings = groups.filter((group) => group.warnings > 0).length;

  return (
    <>
      <PageHeader
        title="Сайтын шалгалт"
        description="Сайтад харагдаж буй аялал бүрийн огноо, үнэ, зураг, chatbot-той ижил эсэхийг автоматаар шалгана. Өдөр бүр өглөө 8 цагт дахин шалгаж, алдаа гарвал и-мэйлээр мэдэгдэнэ."
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {isFetching ? "Шалгаж байна…" : "Одоо дахин шалгах"}
          </Button>
        }
      />

      {isPending ? (
        <Panel>
          <div role="status" className="flex flex-col items-center justify-center gap-3 py-14 text-center text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            Аялал бүрийг шалгаж байна… Хамтрагч байгууллагуудын үнийг давхар тулгадаг тул хагас минут хүртэл үргэлжилж магадгүй.
          </div>
        </Panel>
      ) : error || !data ? (
        <Panel>
          <ErrorState error={error} title="Шалгалт ажилласангүй" onRetry={() => refetch()} />
        </Panel>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Шалгасан аялал" value={formatNumber(data.publishedTrips)} hint="Сайтад харагдаж буй бүх аялал" icon={ShieldCheck} />
            <StatCard
              label="Алдаа"
              value={formatNumber(data.errors)}
              hint={data.errors ? `${tripsWithErrors} аялалд — үйлчлүүлэгч буруу мэдээлэл харж байна, түрүүлж засна` : "Алдаа алга"}
              icon={XCircle}
              tone={data.errors ? "danger" : "success"}
            />
            <StatCard
              label="Анхааруулга"
              value={formatNumber(data.warnings)}
              hint={data.warnings ? `${tripsWithWarnings} аялалд — нэг харж шалгах зүйл` : "Анхааруулга алга"}
              icon={AlertTriangle}
              tone={data.warnings ? "warning" : "success"}
            />
          </div>

          <p className="text-xs text-muted-foreground" title={formatDateTime(data.generatedAt)}>
            Сүүлд шалгасан: {formatRelative(data.generatedAt)}. Аяллыг засаж хадгалсны дараа «Одоо дахин шалгах» дарж засагдсаныг шалгана.
          </p>

          {groups.length === 0 ? (
            <Panel>
              <EmptyState
                icon={CheckCircle2}
                title="Бүх зүйл хэвийн байна"
                description="Сайтад харагдаж буй аяллуудаас асуудал илэрсэнгүй."
              />
            </Panel>
          ) : (
            <>
              <FilterChips
                label="Асуудлыг шүүх"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "Бүх асуудалтай аялал", count: groups.length },
                  { value: "errors", label: "Алдаатай", count: tripsWithErrors },
                  { value: "warnings", label: "Анхааруулгатай", count: tripsWithWarnings },
                ]}
              />
              <ul className="space-y-3">
                {visible.map(({ issues, errors, warnings }) => {
                  const first = issues[0];
                  return (
                    <li key={first.tripId}>
                      <Panel bodyClassName="p-4 sm:p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="break-words font-semibold">{first.title}</p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {errors > 0 && <StatusBadge tone="danger">{errors} алдаа</StatusBadge>}
                              {warnings > 0 && <StatusBadge tone="warning">{warnings} анхааруулга</StatusBadge>}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Button asChild size="sm">
                              <Link href={`/${locale}/admin/trips/${first.tripId}/edit`}>
                                <Pencil />
                                Аяллыг засах
                              </Link>
                            </Button>
                            {first.slug && (
                              <Button asChild size="sm" variant="outline">
                                <a href={`/${locale}/trips/${first.slug}`} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink />
                                  Сайт дээр харах
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                        <ul className="mt-3 space-y-2 border-t border-border pt-3">
                          {issues.map((issue) => (
                            <li key={`${issue.code}:${issue.message}`} className="flex gap-2.5 text-sm">
                              {issue.severity === "error" ? (
                                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-label="Алдаа" />
                              ) : (
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-label="Анхааруулга" />
                              )}
                              <span className="min-w-0 break-words leading-relaxed">{issue.message}</span>
                            </li>
                          ))}
                        </ul>
                      </Panel>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </>
  );
}
