"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

import type { TripWeatherPlace } from "@/lib/weather";

export type RouteStop = TripWeatherPlace & {
  /** "1–3-р өдөр" — when the traveller is here, if known. */
  days?: string;
};

/**
 * The trip's route on a map: numbered stops in visiting order joined by a
 * dashed line. Same places as the weather card (detected from the trip text,
 * editable in admin). Leaflet + OpenStreetMap tiles, loaded client-side only.
 */
export default function RouteMap({ stops }: { stops: RouteStop[] }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current || !stops.length) return;
    let disposed = false;
    let map: import("leaflet").Map | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !container.current) return;

      map = L.map(container.current, {
        // A page that scrolls must not get stuck zooming the map.
        scrollWheelZoom: false,
        attributionControl: true,
        zoomControl: true,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const points = stops.map((s) => L.latLng(s.lat, s.lon));
      if (points.length > 1) {
        L.polyline(points, { color: "#113e67", weight: 3, opacity: 0.75, dashArray: "8 8" }).addTo(map);
      }
      stops.forEach((stop, index) => {
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:30px;height:30px;border-radius:9999px;background:#113e67;color:#fff;border:3px solid #f2bd4a;display:flex;align-items:center;justify-content:center;font:700 13px/1 Manrope,system-ui,sans-serif;box-shadow:0 4px 12px rgba(8,47,82,.35)">${index + 1}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        const label = [stop.name, stop.country].filter(Boolean).join(", ");
        L.marker(points[index], { icon, title: label, alt: label })
          .addTo(map!)
          .bindTooltip(`${index + 1}. ${label}${stop.days ? ` · ${stop.days}` : ""}`, { direction: "top", offset: [0, -14] });
      });

      // Regional zoom: close stops would otherwise fill the frame with street labels.
      if (points.length === 1) map.setView(points[0], 6);
      else map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 7 });
    })();

    return () => {
      disposed = true;
      map?.remove();
    };
  }, [stops]);

  if (!stops.length) return null;

  return (
    // `isolate`: Leaflet's panes use z-index 400+, which would otherwise
    // slide over the sticky site header while scrolling.
    <div className="isolate overflow-hidden rounded-2xl border border-border bg-card">
      <div ref={container} className="z-0 h-72 w-full bg-secondary sm:h-80" role="img" aria-label="Аяллын маршрутын газрын зураг" />
      <ol className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border px-4 py-3 text-sm">
        {stops.map((stop, index) => (
          <li key={`${stop.lat},${stop.lon}`} className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              {index + 1}
            </span>
            <span className="font-semibold">{stop.name}</span>
            {stop.days && <span className="text-xs text-muted-foreground">{stop.days}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
