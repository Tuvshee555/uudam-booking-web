"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, MapPin, Search, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, apiErrorMessage } from "@/lib/api";
import type { StoredTripWeather, WeatherPlace } from "@/lib/weather";

type GeocodeResult = { name: string; country: string; lat: number; lon: number; label: string };

/**
 * Which cities a trip's weather card covers. Detected automatically from the
 * trip's own text; staff can re-run detection, or search and set the stops
 * by hand. Saves on its own (it is not part of the trip form's payload).
 */
export default function WeatherPlacesEditor({ tripId }: { tripId: string }) {
  const queryClient = useQueryClient();
  const key = ["admin", "trip-weather", tripId];

  const { data, isPending } = useQuery<StoredTripWeather | null>({
    queryKey: key,
    queryFn: async () => (await api.get<StoredTripWeather | null>(`/trips/${tripId}/weather`)).data,
  });

  const [draft, setDraft] = useState<WeatherPlace[] | null>(null);
  const places = draft ?? data?.places ?? [];
  const dirty = draft !== null;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);

  const search = useMutation({
    mutationFn: async (q: string) => (await api.get<GeocodeResult[]>("/weather/geocode", { params: { q } })).data,
    onSuccess: (found) => {
      setResults(found);
      if (!found.length) toast.error("Олдсонгүй. Өөрөөр бичээд үзнэ үү (жишээ нь англиар).");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Хайхад алдаа гарлаа")),
  });

  const detect = useMutation({
    mutationFn: async () => (await api.post<StoredTripWeather>(`/trips/${tripId}/weather`)).data,
    onSuccess: (saved) => {
      queryClient.setQueryData(key, saved);
      queryClient.invalidateQueries({ queryKey: ["trip-weather"] });
      setDraft(null);
      toast.success(saved.places.length ? "Хотуудыг автоматаар тодорхойллоо" : "Аяллын мэдээллээс хот олдсонгүй");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Тодорхойлж чадсангүй")),
  });

  const save = useMutation({
    mutationFn: async (next: WeatherPlace[]) =>
      (await api.put<StoredTripWeather>(`/trips/${tripId}/weather`, { places: next })).data,
    onSuccess: (saved) => {
      queryClient.setQueryData(key, saved);
      queryClient.invalidateQueries({ queryKey: ["trip-weather"] });
      setDraft(null);
      toast.success("Цаг агаарын хотуудыг хадгаллаа");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Хадгалахад алдаа гарлаа")),
  });

  function update(next: WeatherPlace[]) {
    setDraft(next);
  }

  function move(index: number, by: -1 | 1) {
    const next = [...places];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    update(next);
  }

  function add(result: GeocodeResult) {
    if (places.length >= 4) return toast.error("Хамгийн ихдээ 4 хот нэмнэ");
    update([
      ...places,
      { name: result.name, country: result.country, lat: result.lat, lon: result.lon, timezone: "" },
    ]);
    setResults([]);
    setQuery("");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Аяллын хуудасны “Цаг агаар” хэсэг болон чатбот эдгээр хотын цаг агаарыг харуулна. Аяллын нэр, хөтөлбөрөөс
        автоматаар олсон — буруу бол засна уу.
      </p>

      {isPending ? (
        <div className="h-16 animate-pulse rounded-xl bg-secondary" />
      ) : (
        <>
          {data?.error && !dirty && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Сүүлийн автомат тодорхойлолт амжилтгүй болсон. Доороос хотоо хайж нэмэх эсвэл дахин оролдоно уу.
            </p>
          )}

          {places.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
              Хот алга — цаг агаар харагдахгүй байна.
            </p>
          ) : (
            <ol className="space-y-2">
              {places.map((place, index) => (
                <li
                  key={`${place.lat},${place.lon},${index}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 px-3 py-2"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Input
                      value={place.name}
                      onChange={(e) =>
                        update(places.map((p, i) => (i === index ? { ...p, name: e.target.value } : p)))
                      }
                      className="h-8 font-semibold"
                      aria-label="Хотын нэр"
                    />
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {place.country && `${place.country} · `}
                      {place.lat.toFixed(2)}, {place.lon.toFixed(2)}
                      {place.timezone && ` · ${place.timezone}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      className="rounded p-1.5 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                      aria-label="Дээш"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === places.length - 1}
                      className="rounded p-1.5 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                      aria-label="Доош"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => update(places.filter((_, i) => i !== index))}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Устгах"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (query.trim().length >= 2) search.mutate(query.trim());
                    }
                  }}
                  placeholder="Хот нэмэх — нэрээр хайх"
                  className="pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={query.trim().length < 2 || search.isPending}
                onClick={() => search.mutate(query.trim())}
              >
                {search.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Хайх"}
              </Button>
            </div>
            {results.length > 0 && (
              <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
                {results.map((result) => (
                  <li key={`${result.lat},${result.lon}`}>
                    <button
                      type="button"
                      onClick={() => add(result)}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                    >
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="font-semibold">{result.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{result.label}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={!dirty || save.isPending} onClick={() => save.mutate(places)}>
              {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Хотуудыг хадгалах
            </Button>
            {dirty && (
              <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                Болих
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="ml-auto gap-1.5"
              disabled={detect.isPending}
              onClick={() => detect.mutate()}
            >
              {detect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Дахин автоматаар олох
            </Button>
          </div>
          {data && !dirty && (
            <p className="text-[11px] text-muted-foreground">
              {data.source === "manual" ? "Гараар тохируулсан" : "Автоматаар тодорхойлсон"} ·{" "}
              {new Date(data.updatedAt).toLocaleString("mn-MN")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
