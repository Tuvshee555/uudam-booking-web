"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * List filters kept in the address bar, so a filtered view survives a
 * refresh, works with the back button, and can be linked to — the dashboard
 * sends staff straight to `?status=NEW`. Defaults are left out of the URL.
 *
 * Pages using this read useSearchParams, so they must render inside <Suspense>.
 */
export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // The defaults are fixed for the life of the page; freezing them keeps `update` stable.
  const [fixedDefaults] = useState(defaults);

  const values = Object.fromEntries(
    Object.entries(fixedDefaults).map(([key, fallback]) => [key, params.get(key) ?? fallback]),
  ) as T;

  const update = useCallback(
    (patch: Partial<Record<keyof T, string | null>>) => {
      const next = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === "" || value === fixedDefaults[key]) next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, fixedDefaults],
  );

  return [values, update] as const;
}

/**
 * Checkbox selection that belongs to one view of a list. Changing the filter
 * or page gives a fresh, empty selection — ticked rows that scrolled out of
 * view would otherwise be changed by a bulk action without anyone seeing them.
 */
export function useScopedSelection(scope: string) {
  const [state, setState] = useState<{ scope: string; ids: Set<string> }>({ scope, ids: new Set() });
  const selected = state.scope === scope ? state.ids : new Set<string>();

  const set = useCallback(
    (update: Set<string> | ((current: Set<string>) => Set<string>)) => {
      setState((current) => {
        const base = current.scope === scope ? current.ids : new Set<string>();
        return { scope, ids: typeof update === "function" ? update(base) : update };
      });
    },
    [scope],
  );

  return [selected, set] as const;
}
