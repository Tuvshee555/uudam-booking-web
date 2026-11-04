import { requireAdmin } from "@/server/auth";
import { handler, json, parsePositiveInt, safeText } from "@/server/http";
import { prisma } from "@/server/prisma";
import { pruneErrorLogs } from "@/server/errorLog";
import { ERROR_LOG_RETENTION_HOURS } from "@/lib/errorLogRules";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/errors?hours=&source=&q= — the three-day error log for the admin
 * «Алдааны бүртгэл» page, newest first, with counts for the filter chips.
 */
export const GET = handler(async (req: Request) => {
  await requireAdmin(req);
  await pruneErrorLogs().catch(() => {});
  const params = new URL(req.url).searchParams;
  const hours = parsePositiveInt(params.get("hours"), ERROR_LOG_RETENTION_HOURS, ERROR_LOG_RETENTION_HOURS);
  const source = params.get("source");
  const q = safeText(params.get("q"), 100);
  const since = new Date(Date.now() - hours * 3_600_000);
  const where = {
    createdAt: { gte: since },
    ...(source === "server" || source === "browser" ? { source } : {}),
    ...(q ? { OR: [
      { message: { contains: q, mode: "insensitive" as const } },
      { path: { contains: q, mode: "insensitive" as const } },
      { userEmail: { contains: q, mode: "insensitive" as const } },
    ] } : {}),
  };
  const [rows, bySource] = await Promise.all([
    prisma.errorLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.errorLog.groupBy({ by: ["source"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
  ]);
  const counts = Object.fromEntries(bySource.map((row) => [row.source, row._count._all]));
  return json({ hours, rows, counts: { server: counts.server ?? 0, browser: counts.browser ?? 0 } });
});
