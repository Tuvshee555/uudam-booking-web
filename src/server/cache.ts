/**
 * Tiny in-memory TTL cache for hot, read-only catalog reads (trip list,
 * categories). The catalog changes rarely but is read on every page load.
 *
 * Each serverless instance keeps its own copy, so the only effect of scaling
 * out is that an instance may be up to TTL seconds stale; every admin mutation
 * invalidates its own instance immediately, and the short TTL covers the rest.
 */
const store = new Map<string, { value: unknown; expires: number }>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  producer: () => Promise<T>,
): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() < hit.expires) return hit.value as T;

  const value = await producer();
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

export function invalidate(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** Clear every cached catalog read — call after any trip/category mutation. */
export function invalidateCatalog() {
  invalidate("trips");
  invalidate("categories");
  invalidate("tags");
  invalidate("priceBands");
}
