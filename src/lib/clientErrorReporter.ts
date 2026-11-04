import { isBrowserNoise } from "./errorLogRules";

/**
 * Sends what broke in this browser to the three-day error log (/api/client-errors):
 * a crash, an unhandled promise, a request that never reached the server, or an
 * error page shown. At most 10 reports per page load and each message once, so a
 * loop cannot turn into a flood; the report itself can never fail loudly.
 */
const MAX_REPORTS = 10;
const sent = new Set<string>();

export type ClientErrorReport = {
  kind: "crash" | "rejection" | "network" | "page";
  message: string;
  stack?: string;
  source?: string;
  request?: string;
  method?: string;
  status?: number;
  digest?: string;
};

export function reportClientError(report: ClientErrorReport) {
  if (typeof window === "undefined") return;
  if (isBrowserNoise(report.message, report.source)) return;
  if (report.request?.includes("/api/client-errors")) return;
  const key = `${report.kind}:${report.message}:${report.request ?? ""}`;
  if (sent.has(key) || sent.size >= MAX_REPORTS) return;
  sent.add(key);
  try {
    const token = localStorage.getItem("token");
    void fetch("/api/client-errors", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ ...report, stack: report.stack?.slice(0, 2000), page: window.location.pathname + window.location.search }),
    }).catch(() => {});
  } catch {
    // Storage blocked or fetch unavailable: nothing to report with.
  }
}

let installed = false;

/** Window-level listeners; called once by ErrorReporter in the locale layout. */
export function installClientErrorReporter() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (event) => {
    reportClientError({ kind: "crash", message: event.message || String(event.error ?? ""), stack: event.error?.stack, source: event.filename });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    // A refused API call is already in the log from the server side.
    if (reason && typeof reason === "object" && "isAxiosError" in reason && (reason as { response?: unknown }).response) return;
    reportClientError({ kind: "rejection", message: reason instanceof Error ? reason.message : String(reason ?? ""), stack: reason instanceof Error ? reason.stack : undefined });
  });
}
