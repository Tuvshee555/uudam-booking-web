/**
 * What the three-day error log keeps (src/server/errorLog.ts), and how a record is
 * cleaned before it is stored. Pure, so the browser reporter and the tests share it.
 */

export const ERROR_LOG_RETENTION_HOURS = 72;
export const MAX_MESSAGE_CHARS = 1000;
const MAX_STACK_CHARS = 2000;

/**
 * Every server failure; a refused request only where a person was trying to do
 * something — an admin screen, or a save, login or booking anywhere. A customer's
 * 404 on an old trip link, or an analytics ping, is not something to fix.
 */
export function shouldRecordResponse(method: string, path: string, status: number): boolean {
  if (status < 400) return false;
  if (path.startsWith("/api/client-errors") || path.startsWith("/api/events")) return false;
  if (status >= 500) return true;
  if (path.startsWith("/api/admin")) return true;
  return method.toUpperCase() !== "GET" && method.toUpperCase() !== "HEAD";
}

/** Strips credentials that can travel inside error text, then caps the length. */
export function cleanText(value: unknown, max = MAX_MESSAGE_CHARS): string {
  const text = typeof value === "string" ? value : value instanceof Error ? value.message : value == null ? "" : String(value);
  return text
    .replace(/(bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, "$1[redacted]")
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[token]")
    .replace(/(password|secret|token|otp)(["']?\s*[:=]\s*["']?)[^\s"'&,}]+/gi, "$1$2[redacted]")
    .replace(/\u0000/g, "")
    .slice(0, max);
}

export function cleanStack(value: unknown): string {
  return cleanText(value, MAX_STACK_CHARS);
}

/** Browser noise nobody can fix: extensions, third-party scripts, a resize loop. */
export function isBrowserNoise(message: string, source = ""): boolean {
  const text = `${message} ${source}`;
  return /ResizeObserver loop|^Script error\.?$|chrome-extension:|moz-extension:|safari-extension:|Non-Error promise rejection captured|NEXT_REDIRECT|NEXT_NOT_FOUND/i.test(text.trim())
    || message.trim() === "";
}

/** The names of the fields a request sent — never their values (phones, passports, prices). */
export function bodyFieldNames(body: unknown): string[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  return Object.keys(body as Record<string, unknown>).slice(0, 40);
}
