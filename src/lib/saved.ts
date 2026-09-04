"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Saved trips, kept in the browser.
 *
 * There are no customer accounts — the agency sells on the phone — so a
 * wishlist that required signing in would be a wall in front of a feature
 * whose whole job is to be frictionless. localStorage gives a visitor a
 * shortlist to come back to, which is what the feature is actually for.
 * The trade-off is that it does not follow them to another device.
 */

const KEY = "uudam.saved.trips";
const EVENT = "uudam:saved-changed";

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    // Private mode or storage blocked. A wishlist is a convenience, not
    // something worth erroring over.
    return [];
  }
}

function write(slugs: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(slugs));
  } catch {
    return;
  }
  // Same-tab listeners: the native `storage` event only fires in *other* tabs,
  // so the heart on the card and the header count would not update without this.
  window.dispatchEvent(new Event(EVENT));
}

export function getSavedTrips(): string[] {
  return read();
}

export function toggleSavedTrip(slug: string): boolean {
  const current = read();
  const saved = current.includes(slug);
  write(saved ? current.filter((s) => s !== slug) : [slug, ...current]);
  return !saved;
}

/** Live list of saved slugs, synced across components and tabs. */
export function useSavedTrips() {
  const [slugs, setSlugs] = useState<string[]>([]);

  // Read after mount only: the server has no localStorage, and reading during
  // render would make the first client paint disagree with the server HTML.
  useEffect(() => {
    const sync = () => setSlugs(read());
    sync();

    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((slug: string) => {
    toggleSavedTrip(slug);
  }, []);

  return { slugs, toggle, isSaved: (slug: string) => slugs.includes(slug) };
}
