import jwt from "jsonwebtoken";
import { after } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "./prisma";
import { cleanText, ERROR_LOG_RETENTION_HOURS } from "@/lib/errorLogRules";

/**
 * Three-day log of what went wrong on the site, so a staff member's failed save
 * or a customer's broken page can be looked up after the fact (Vercel keeps an
 * hour of logs on this plan). Rows older than three days are deleted on the next
 * write; a hard row ceiling keeps an error storm from filling the database.
 *
 * Best-effort throughout: a logging failure never changes a response.
 */
const MAX_ROWS = 20_000;
const PRUNE_EVERY_MS = 10 * 60_000;
const MAX_WRITES_PER_MINUTE = 60;

export type ErrorLogEntry = {
  source: "server" | "browser";
  level: "error" | "warn";
  method?: string;
  path?: string;
  status?: number | null;
  message: unknown;
  userEmail?: string | null;
  details?: Record<string, unknown>;
};

let lastPruneAt = 0;
let windowStart = 0;
let windowWrites = 0;

/** Who sent the request, read from the token for the log only (never trusted for access). */
export function requestUserEmail(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const decoded = jwt.decode(auth.slice(7));
  if (!decoded || typeof decoded !== "object") return null;
  const email = (decoded as Record<string, unknown>).email;
  return typeof email === "string" ? email.slice(0, 200) : null;
}

/** Scrubbed like the message; an oversized blob is kept as a preview rather than cut into broken JSON. */
function cleanDetails(details: Record<string, unknown>): Prisma.InputJsonValue {
  const raw = JSON.stringify(details) ?? "{}";
  if (raw.length > 8000) return { truncated: true, preview: cleanText(raw, 8000) };
  try {
    return JSON.parse(cleanText(raw, 8000)) as Prisma.InputJsonValue;
  } catch {
    return { preview: cleanText(raw, 8000) };
  }
}

async function write(entry: ErrorLogEntry) {
  const now = Date.now();
  if (now - windowStart >= 60_000) {
    windowStart = now;
    windowWrites = 0;
  }
  if (++windowWrites > MAX_WRITES_PER_MINUTE) return;
  await prisma.errorLog.create({
    data: {
      source: entry.source,
      level: entry.level,
      method: (entry.method ?? "").slice(0, 10),
      path: cleanText(entry.path ?? "", 300),
      status: entry.status ?? null,
      message: cleanText(entry.message),
      userEmail: entry.userEmail ?? null,
      details: entry.details ? cleanDetails(entry.details) : undefined,
    },
  });
  if (now - lastPruneAt >= PRUNE_EVERY_MS) {
    lastPruneAt = now;
    await pruneErrorLogs();
  }
}

export async function pruneErrorLogs() {
  await prisma.$executeRaw`DELETE FROM "ErrorLog" WHERE "createdAt" < NOW() - (${ERROR_LOG_RETENTION_HOURS}::int * INTERVAL '1 hour')`;
  await prisma.$executeRaw`DELETE FROM "ErrorLog" WHERE "createdAt" < (SELECT "createdAt" FROM "ErrorLog" ORDER BY "createdAt" DESC OFFSET ${MAX_ROWS} LIMIT 1)`;
}

/**
 * Stores the entry after the response is sent; never throws, never delays the caller.
 * A builder function is scheduled now and run later, for entries that need async work.
 */
export function recordError(entry: ErrorLogEntry | (() => Promise<ErrorLogEntry>)) {
  const work = () => (typeof entry === "function" ? entry() : Promise.resolve(entry)).then(write).catch((error) => {
    console.warn("errorLog write failed:", error instanceof Error ? error.message : error);
  });
  try {
    after(work);
  } catch {
    // Outside a request (scripts, tests): write in the background instead.
    void work();
  }
}
