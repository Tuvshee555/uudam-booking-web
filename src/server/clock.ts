/**
 * The moment a server component renders, read once per render. Server
 * components run once per request (or per cache refresh), so this is not the
 * re-render hazard React's purity rule guards client components against.
 */
export function renderTime(): number {
  return Date.now();
}
