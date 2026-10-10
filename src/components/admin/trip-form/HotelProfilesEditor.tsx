"use client";

import { ExternalLink, Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { HotelProfile } from "@/lib/hotelLinks";
import MediaListEditor from "./MediaListEditor";

const EMPTY_HOTEL: HotelProfile = { name: "", url: "", description: "", media: [] };

function shortLink(value: string) {
  try { return new URL(value).hostname.replace(/^www\./, ""); }
  catch { return ""; }
}

export default function HotelProfilesEditor({
  hotels,
  onChange,
}: {
  hotels: HotelProfile[];
  onChange: (hotels: HotelProfile[]) => void;
}) {
  const rows = hotels.length ? hotels : [EMPTY_HOTEL];
  const update = (index: number, patch: Partial<HotelProfile>) => {
    const current = hotels.length ? hotels : [EMPTY_HOTEL];
    onChange(current.map((hotel, i) => i === index ? { ...hotel, ...patch } : hotel));
  };

  return (
    <div className="space-y-4">
      {rows.map((hotel, index) => (
        <section key={index} className="rounded-lg border border-border p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-semibold">Зочид буудал {index + 1}</h3>
            {(hotels.length > 1 || hotel.name || hotel.url || hotel.media.length > 0) && (
              <button
                type="button"
                onClick={() => onChange(hotels.filter((_, i) => i !== index))}
                className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Зочид буудал ${index + 1} устгах`}
                title="Зочид буудал устгах"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`hotel-name-${index}`}>Буудлын нэр</Label>
              <Input id={`hotel-name-${index}`} value={hotel.name} onChange={(event) => update(index, { name: event.target.value })} placeholder="Жишээ: Jomtien Palm Beach Hotel & Resort" />
            </div>
            <div className="min-w-0">
              <Label htmlFor={`hotel-link-${index}`}>Буудлын албан ёсны холбоос</Label>
              <Input id={`hotel-link-${index}`} type="url" value={hotel.url} onChange={(event) => update(index, { url: event.target.value })} placeholder="https://hotel.com" />
              {shortLink(hotel.url) && (
                <a href={hotel.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" />{shortLink(hotel.url)}
                </a>
              )}
            </div>
          </div>

          <div className="mt-4">
            <Label htmlFor={`hotel-description-${index}`}>Тайлбар</Label>
            <Textarea id={`hotel-description-${index}`} rows={2} value={hotel.description} onChange={(event) => update(index, { description: event.target.value })} placeholder="Байршил, зэрэглэл, онцлог" />
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <MediaListEditor
              label="Зураг, бичлэг"
              hint="Энд оруулсан зураг, бичлэг зөвхөн энэ буудалд харагдана."
              items={hotel.media}
              onChange={(media) => update(index, { media })}
              hideUploadedUrl
            />
          </div>
        </section>
      ))}

      <button
        type="button"
        onClick={() => onChange([...(hotels.length ? hotels : []), { ...EMPTY_HOTEL }])}
        className="inline-flex items-center gap-2 rounded-md border border-dashed border-primary/50 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5"
      >
        <Plus className="h-4 w-4" />
        Зочид буудал нэмэх
      </button>
    </div>
  );
}
