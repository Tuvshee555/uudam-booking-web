"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api, apiErrorMessage } from "@/lib/api";
import {
  ABOUT_ICON_OPTIONS,
  aboutIcon,
  DEFAULT_ABOUT_HERO_SUBTITLE,
  DEFAULT_ABOUT_HERO_TITLE,
  DEFAULT_ABOUT_VALUES,
  type AboutValue,
} from "@/lib/aboutContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SettingsResponse = {
  tripNotice: string | null;
  bankDetails: string | null;
  aboutHeroTitle: string | null;
  aboutHeroSubtitle: string | null;
  aboutValues: AboutValue[] | null;
};

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<SettingsResponse>({
    queryKey: ["settings"],
    queryFn: async () => (await api.get("/settings")).data,
  });

  // Undefined means "not yet touched" — the field shows the loaded value in
  // that state. Editing switches to the typed value, so a save sends exactly
  // what's on screen instead of racing a useEffect against the query.
  const [tripNoticeDraft, setTripNoticeDraft] = useState<string | undefined>(undefined);
  const [heroTitleDraft, setHeroTitleDraft] = useState<string | undefined>(undefined);
  const [heroSubtitleDraft, setHeroSubtitleDraft] = useState<string | undefined>(undefined);
  const [valuesDraft, setValuesDraft] = useState<AboutValue[] | undefined>(undefined);

  const tripNotice = tripNoticeDraft ?? data?.tripNotice ?? "";
  const heroTitle = heroTitleDraft ?? data?.aboutHeroTitle ?? DEFAULT_ABOUT_HERO_TITLE;
  const heroSubtitle = heroSubtitleDraft ?? data?.aboutHeroSubtitle ?? DEFAULT_ABOUT_HERO_SUBTITLE;
  const values =
    valuesDraft ?? (data?.aboutValues && data.aboutValues.length > 0 ? data.aboutValues : DEFAULT_ABOUT_VALUES);

  function updateValue(index: number, patch: Partial<AboutValue>) {
    setValuesDraft(values.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function removeValue(index: number) {
    setValuesDraft(values.filter((_, i) => i !== index));
  }

  function addValue() {
    setValuesDraft([...values, { icon: "sparkles", title: "", text: "" }]);
  }

  const save = useMutation({
    mutationFn: async () =>
      api.put("/settings", {
        tripNotice: tripNotice.trim() || null,
        aboutHeroTitle: heroTitle.trim() || null,
        aboutHeroSubtitle: heroSubtitle.trim() || null,
        aboutValues: values,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Хадгаллаа");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Хадгалахад алдаа гарлаа")),
  });

  return (
    <>
      <h1 className="text-xl font-bold">Тохиргоо</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Энд бичсэн зүйл бүх аяллын хуудсан дээр харагдана. Тухайн нэг аялалд л
        зориулсан тэмдэглэл байвал тухайн аяллыг засах хуудсан дахь
        &ldquo;Чухал тэмдэглэл&rdquo; хэсэгт бичнэ — энэ хоёр хамт харагдана.
      </p>

      <div className="mt-6 max-w-2xl rounded-2xl border border-border bg-card p-5">
        <Label htmlFor="trip-notice">Бүх аялал дээр харагдах тэмдэглэл</Label>

        {isLoading ? (
          <div className="mt-1.5 h-32 animate-pulse rounded-md bg-secondary" />
        ) : (
          <textarea
            id="trip-notice"
            value={tripNotice}
            onChange={(event) => setTripNoticeDraft(event.target.value)}
            rows={6}
            placeholder="Жишээ нь: Бид гуравдагч этгээдийн үйлчилгээний чанарт хариуцлага хүлээхгүй болно…"
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        )}

        <p className="mt-2 text-xs text-muted-foreground">
          Хоосон орхивол ямар ч аялал дээр харагдахгүй.
        </p>
      </div>

      <div className="mt-6 max-w-2xl rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Бидний тухай хуудас</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          &ldquo;Бидний тухай&rdquo; хуудасны гарчиг болон доорх 4 хайрцгийг
          энд засна.
        </p>

        {isLoading ? (
          <div className="mt-4 h-64 animate-pulse rounded-md bg-secondary" />
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="about-hero-title">Гарчиг</Label>
              <Input
                id="about-hero-title"
                value={heroTitle}
                onChange={(e) => setHeroTitleDraft(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="about-hero-subtitle">Дэд гарчиг</Label>
              <Textarea
                id="about-hero-subtitle"
                value={heroSubtitle}
                onChange={(e) => setHeroSubtitleDraft(e.target.value)}
                rows={3}
                className="mt-1.5"
              />
            </div>

            <div className="border-t border-border pt-4">
              <Label>Хайрцгууд</Label>

              <div className="mt-2 space-y-3">
                {values.map((value, index) => {
                  const Icon = aboutIcon(value.icon);
                  return (
                    <div key={index} className="rounded-xl border border-border bg-secondary/30 p-3">
                      <div className="flex items-start gap-2">
                        <select
                          value={value.icon}
                          onChange={(e) => updateValue(index, { icon: e.target.value })}
                          className="flex h-9 shrink-0 items-center rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          aria-label="Icon"
                        >
                          {ABOUT_ICON_OPTIONS.map((key) => (
                            <option key={key} value={key}>
                              {key}
                            </option>
                          ))}
                        </select>
                        <Icon className="mt-2 h-4 w-4 shrink-0 text-primary" />
                        <Input
                          value={value.title}
                          onChange={(e) => updateValue(index, { title: e.target.value })}
                          placeholder="Гарчиг"
                          className="flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => removeValue(index)}
                          className="mt-1.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Устгах"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <Textarea
                        value={value.text}
                        onChange={(e) => updateValue(index, { text: e.target.value })}
                        placeholder="Тайлбар"
                        rows={2}
                        className="mt-2"
                      />
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addValue}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
              >
                <Plus className="h-4 w-4" />
                Хайрцаг нэмэх
              </button>
            </div>
          </div>
        )}
      </div>

      <Button onClick={() => save.mutate()} disabled={save.isPending || isLoading} className="mt-6">
        {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Хадгалах
      </Button>
    </>
  );
}
