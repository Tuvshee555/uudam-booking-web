import { NextResponse } from "next/server";
import { recordError, requestUserEmail } from "@/server/errorLog";
import { clientIp, handler, httpError, rateLimit, readJson, safeText } from "@/server/http";
import { cleanStack, isBrowserNoise } from "@/lib/errorLogRules";

const KINDS = new Set(["crash", "rejection", "network", "page"]);

/**
 * POST /api/client-errors — a page that broke in a visitor's or staff member's
 * browser (src/lib/clientErrorReporter.ts). Stored in the three-day error log.
 * Fire-and-forget for the caller; throttled per IP so one looping page cannot
 * flood the table.
 */
export const POST = handler(async (req: Request) => {
  if (Number(req.headers.get("content-length") || 0) > 16_000) throw httpError(413, "Too large");
  const body = await readJson(req);
  rateLimit(`client-error:${clientIp(req)}`, { windowMs: 60_000, max: 20 });
  const kind = typeof body.kind === "string" && KINDS.has(body.kind) ? body.kind : "crash";
  const message = safeText(body.message, 1000) ?? "";
  if (isBrowserNoise(message, typeof body.source === "string" ? body.source : "")) return NextResponse.json({ ok: true });
  recordError({
    source: "browser",
    level: "error",
    method: safeText(body.method, 10) ?? "",
    path: safeText(body.page, 300) ?? "",
    status: typeof body.status === "number" ? body.status : null,
    message,
    userEmail: requestUserEmail(req),
    details: {
      kind,
      ...(safeText(body.request, 300) ? { request: safeText(body.request, 300) } : {}),
      ...(safeText(body.digest, 100) ? { digest: safeText(body.digest, 100) } : {}),
      ...(typeof body.stack === "string" ? { stack: cleanStack(body.stack) } : {}),
      userAgent: (req.headers.get("user-agent") || "").slice(0, 200),
    },
  });
  return NextResponse.json({ ok: true });
});
