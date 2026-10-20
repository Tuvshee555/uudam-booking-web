"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";

import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { Button } from "@/components/ui/button";
import { useTripHealth } from "@/hooks/useTripHealth";
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

  const byTrip = new Map<string, HealthIssue[]>();
  for (const issue of data?.issues ?? []) byTrip.set(issue.tripId, [...(byTrip.get(issue.tripId) ?? []), issue]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Сайтын шалгалт</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Нийтэд харагдаж буй аялал бүрийн огноо, үнэ, синкийг автоматаар шалгана. Өдөр бүр 08:00-д давтагдаж, алдаа байвал имэйлээр мэдэгдэнэ.
          </p>
        </div>
        <Button variant="outline" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Дахин шалгах
        </Button>
      </div>

      {isPending && <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Шалгаж байна…</p>}
      {error && <p className="mt-6 text-sm text-destructive">Шалгалт ажилласангүй. Дахин оролдоно уу.</p>}

      {data && (
        <>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <span className="rounded-lg border border-border px-3 py-2">{data.publishedTrips} нийтлэгдсэн аялал</span>
            <span className={`rounded-lg border px-3 py-2 ${data.errors ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border"}`}>{data.errors} алдаа</span>
            <span className={`rounded-lg border px-3 py-2 ${data.warnings ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400" : "border-border"}`}>{data.warnings} анхааруулга</span>
            <span className="px-1 py-2 text-muted-foreground">{new Date(data.generatedAt).toLocaleString("mn-MN")}</span>
          </div>

          {byTrip.size === 0 ? (
            <p className="mt-8 flex items-center gap-2 text-sm"><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Асуудал илэрсэнгүй.</p>
          ) : (
            <ul className="mt-6 space-y-3">
              {[...byTrip.values()].map((issues) => (
                <li key={issues[0].tripId} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 break-words font-medium">{issues[0].title}</p>
                    {issues[0].slug && (
                      <div className="flex shrink-0 gap-2 text-sm">
                        <Link className="text-primary hover:underline" href={`/${locale}/admin/trips/${issues[0].tripId}/edit`}>Засах</Link>
                        <Link className="text-muted-foreground hover:underline" href={`/${locale}/trips/${issues[0].slug}`} target="_blank">Сайтад харах</Link>
                      </div>
                    )}
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {issues.map((issue) => (
                      <li key={`${issue.code}:${issue.message}`} className="flex gap-2 text-sm">
                        {issue.severity === "error"
                          ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                          : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
                        <span className="min-w-0 break-words">{issue.message}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
