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
import {
  DEFAULT_CUSTOM_TRIP_BODY,
  DEFAULT_CUSTOM_TRIP_TITLE,
  DEFAULT_FAQS,
  DEFAULT_GIFT_BODY,
  DEFAULT_GIFT_TITLE,
  DEFAULT_HOME_CUSTOM_CTA_BODY,
  DEFAULT_HOME_CUSTOM_CTA_TITLE,
  DEFAULT_HOME_HERO_BADGE,
  DEFAULT_HOME_HERO_EYEBROW,
  DEFAULT_HOME_HERO_IMAGES,
  DEFAULT_HOME_HERO_PRIMARY_CTA,
  DEFAULT_HOME_HERO_SECONDARY_CTA,
  DEFAULT_HOME_HERO_SUBTITLE,
  DEFAULT_HOME_HERO_TITLE,
  DEFAULT_HOME_HERO_TITLE_ACCENT,
  DEFAULT_TERMS_SECTIONS,
  DEFAULT_TRUST_FACTS,
  DEFAULT_TRUST_PHONE_TEXT,
  type FaqItem,
  type TermsSection,
  type TrustFact,
} from "@/lib/siteContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ImageUploadField from "@/components/admin/trip-form/ImageUploadField";

type SettingsResponse = {
  tripNotice: string | null;
  bankDetails: string | null;
  aboutHeroTitle: string | null;
  aboutHeroSubtitle: string | null;
  aboutValues: AboutValue[] | null;
  homeHeroEyebrow: string | null;
  homeHeroTitle: string | null;
  homeHeroTitleAccent: string | null;
  homeHeroSubtitle: string | null;
  homeHeroImages: string[] | null;
  homeHeroPrimaryCta: string | null;
  homeHeroSecondaryCta: string | null;
  homeHeroBadge: string | null;
  homeCustomCtaTitle: string | null;
  homeCustomCtaBody: string | null;
  customTripTitle: string | null;
  customTripBody: string | null;
  giftTitle: string | null;
  giftBody: string | null;
  faqs: FaqItem[] | null;
  termsSections: TermsSection[] | null;
  trustFacts: TrustFact[] | null;
  trustPhoneText: string | null;
};

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 max-w-2xl rounded-2xl border border-border bg-card p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function TitleBodyFields({
  titleLabel,
  bodyLabel,
  title,
  body,
  onTitleChange,
  onBodyChange,
  bodyRows = 3,
}: {
  titleLabel: string;
  bodyLabel: string;
  title: string;
  body: string;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  bodyRows?: number;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>{titleLabel}</Label>
        <Input value={title} onChange={(e) => onTitleChange(e.target.value)} className="mt-1.5" />
      </div>
      <div>
        <Label>{bodyLabel}</Label>
        <Textarea value={body} onChange={(e) => onBodyChange(e.target.value)} rows={bodyRows} className="mt-1.5" />
      </div>
    </div>
  );
}

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

  const [aboutTitleDraft, setAboutTitleDraft] = useState<string | undefined>(undefined);
  const [aboutSubtitleDraft, setAboutSubtitleDraft] = useState<string | undefined>(undefined);
  const [aboutValuesDraft, setAboutValuesDraft] = useState<AboutValue[] | undefined>(undefined);

  const [homeEyebrowDraft, setHomeEyebrowDraft] = useState<string | undefined>(undefined);
  const [homeTitleDraft, setHomeTitleDraft] = useState<string | undefined>(undefined);
  const [homeAccentDraft, setHomeAccentDraft] = useState<string | undefined>(undefined);
  const [homeSubtitleDraft, setHomeSubtitleDraft] = useState<string | undefined>(undefined);
  const [homeImagesDraft, setHomeImagesDraft] = useState<string[] | undefined>(undefined);
  const [homePrimaryCtaDraft, setHomePrimaryCtaDraft] = useState<string | undefined>(undefined);
  const [homeSecondaryCtaDraft, setHomeSecondaryCtaDraft] = useState<string | undefined>(undefined);
  const [homeBadgeDraft, setHomeBadgeDraft] = useState<string | undefined>(undefined);

  const [trustFactsDraft, setTrustFactsDraft] = useState<TrustFact[] | undefined>(undefined);
  const [trustPhoneTextDraft, setTrustPhoneTextDraft] = useState<string | undefined>(undefined);

  const [homeCtaTitleDraft, setHomeCtaTitleDraft] = useState<string | undefined>(undefined);
  const [homeCtaBodyDraft, setHomeCtaBodyDraft] = useState<string | undefined>(undefined);
  const [customTripTitleDraft, setCustomTripTitleDraft] = useState<string | undefined>(undefined);
  const [customTripBodyDraft, setCustomTripBodyDraft] = useState<string | undefined>(undefined);
  const [giftTitleDraft, setGiftTitleDraft] = useState<string | undefined>(undefined);
  const [giftBodyDraft, setGiftBodyDraft] = useState<string | undefined>(undefined);

  const [faqsDraft, setFaqsDraft] = useState<FaqItem[] | undefined>(undefined);
  const [termsDraft, setTermsDraft] = useState<TermsSection[] | undefined>(undefined);

  const tripNotice = tripNoticeDraft ?? data?.tripNotice ?? "";

  const aboutTitle = aboutTitleDraft ?? data?.aboutHeroTitle ?? DEFAULT_ABOUT_HERO_TITLE;
  const aboutSubtitle = aboutSubtitleDraft ?? data?.aboutHeroSubtitle ?? DEFAULT_ABOUT_HERO_SUBTITLE;
  const aboutValues =
    aboutValuesDraft ??
    (data?.aboutValues && data.aboutValues.length > 0 ? data.aboutValues : DEFAULT_ABOUT_VALUES);

  const homeEyebrow = homeEyebrowDraft ?? data?.homeHeroEyebrow ?? DEFAULT_HOME_HERO_EYEBROW;
  const homeTitle = homeTitleDraft ?? data?.homeHeroTitle ?? DEFAULT_HOME_HERO_TITLE;
  const homeAccent = homeAccentDraft ?? data?.homeHeroTitleAccent ?? DEFAULT_HOME_HERO_TITLE_ACCENT;
  const homeSubtitle = homeSubtitleDraft ?? data?.homeHeroSubtitle ?? DEFAULT_HOME_HERO_SUBTITLE;
  const homeImages =
    homeImagesDraft ?? (data?.homeHeroImages && data.homeHeroImages.length > 0 ? data.homeHeroImages : DEFAULT_HOME_HERO_IMAGES);
  const homePrimaryCta = homePrimaryCtaDraft ?? data?.homeHeroPrimaryCta ?? DEFAULT_HOME_HERO_PRIMARY_CTA;
  const homeSecondaryCta = homeSecondaryCtaDraft ?? data?.homeHeroSecondaryCta ?? DEFAULT_HOME_HERO_SECONDARY_CTA;
  const homeBadge = homeBadgeDraft ?? data?.homeHeroBadge ?? DEFAULT_HOME_HERO_BADGE;

  const trustFacts =
    trustFactsDraft ?? (data?.trustFacts && data.trustFacts.length > 0 ? data.trustFacts : DEFAULT_TRUST_FACTS);
  const trustPhoneText = trustPhoneTextDraft ?? data?.trustPhoneText ?? DEFAULT_TRUST_PHONE_TEXT;

  const homeCtaTitle = homeCtaTitleDraft ?? data?.homeCustomCtaTitle ?? DEFAULT_HOME_CUSTOM_CTA_TITLE;
  const homeCtaBody = homeCtaBodyDraft ?? data?.homeCustomCtaBody ?? DEFAULT_HOME_CUSTOM_CTA_BODY;
  const customTripTitle = customTripTitleDraft ?? data?.customTripTitle ?? DEFAULT_CUSTOM_TRIP_TITLE;
  const customTripBody = customTripBodyDraft ?? data?.customTripBody ?? DEFAULT_CUSTOM_TRIP_BODY;
  const giftTitle = giftTitleDraft ?? data?.giftTitle ?? DEFAULT_GIFT_TITLE;
  const giftBody = giftBodyDraft ?? data?.giftBody ?? DEFAULT_GIFT_BODY;

  const faqs = faqsDraft ?? (data?.faqs && data.faqs.length > 0 ? data.faqs : DEFAULT_FAQS);
  const terms = termsDraft ?? (data?.termsSections && data.termsSections.length > 0 ? data.termsSections : DEFAULT_TERMS_SECTIONS);

  function updateHomeImage(index: number, url: string) {
    setHomeImagesDraft(homeImages.map((v, i) => (i === index ? url : v)));
  }
  function removeHomeImage(index: number) {
    setHomeImagesDraft(homeImages.filter((_, i) => i !== index));
  }
  function addHomeImage() {
    setHomeImagesDraft([...homeImages, ""]);
  }

  function updateTrustFact(index: number, patch: Partial<TrustFact>) {
    setTrustFactsDraft(trustFacts.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }
  function removeTrustFact(index: number) {
    setTrustFactsDraft(trustFacts.filter((_, i) => i !== index));
  }
  function addTrustFact() {
    setTrustFactsDraft([...trustFacts, { icon: "sparkles", title: "", text: "" }]);
  }

  function updateAboutValue(index: number, patch: Partial<AboutValue>) {
    setAboutValuesDraft(aboutValues.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }
  function removeAboutValue(index: number) {
    setAboutValuesDraft(aboutValues.filter((_, i) => i !== index));
  }
  function addAboutValue() {
    setAboutValuesDraft([...aboutValues, { icon: "sparkles", title: "", text: "" }]);
  }

  function updateFaq(index: number, patch: Partial<FaqItem>) {
    setFaqsDraft(faqs.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }
  function removeFaq(index: number) {
    setFaqsDraft(faqs.filter((_, i) => i !== index));
  }
  function addFaq() {
    setFaqsDraft([...faqs, { q: "", a: "" }]);
  }

  function updateTerm(index: number, patch: Partial<TermsSection>) {
    setTermsDraft(terms.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }
  function removeTerm(index: number) {
    setTermsDraft(terms.filter((_, i) => i !== index));
  }
  function addTerm() {
    setTermsDraft([...terms, { title: "", body: "" }]);
  }

  const save = useMutation({
    mutationFn: async () =>
      api.put("/settings", {
        tripNotice: tripNotice.trim() || null,
        aboutHeroTitle: aboutTitle.trim() || null,
        aboutHeroSubtitle: aboutSubtitle.trim() || null,
        aboutValues,
        homeHeroEyebrow: homeEyebrow.trim() || null,
        homeHeroTitle: homeTitle.trim() || null,
        homeHeroTitleAccent: homeAccent.trim() || null,
        homeHeroSubtitle: homeSubtitle.trim() || null,
        homeHeroImages: homeImages.filter((url) => url.trim().length > 0),
        homeHeroPrimaryCta: homePrimaryCta.trim() || null,
        homeHeroSecondaryCta: homeSecondaryCta.trim() || null,
        homeHeroBadge: homeBadge.trim() || null,
        trustFacts,
        trustPhoneText: trustPhoneText.trim() || null,
        homeCustomCtaTitle: homeCtaTitle.trim() || null,
        homeCustomCtaBody: homeCtaBody.trim() || null,
        customTripTitle: customTripTitle.trim() || null,
        customTripBody: customTripBody.trim() || null,
        giftTitle: giftTitle.trim() || null,
        giftBody: giftBody.trim() || null,
        faqs,
        termsSections: terms,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Хадгаллаа");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Хадгалахад алдаа гарлаа")),
  });

  if (isLoading) {
    return (
      <>
        <h1 className="text-xl font-bold">Тохиргоо</h1>
        <div className="mt-6 h-96 max-w-2xl animate-pulse rounded-2xl bg-secondary" />
      </>
    );
  }

  return (
    <>
      <h1 className="text-xl font-bold">Тохиргоо</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Вебсайтын бүх хуудсан дээрх бичвэрийг энд засна. Юу ч бичихгүй орхивол
        анхны бичвэр харагдсаар байна.
      </p>

      <Card title="Бүх аялал дээр харагдах тэмдэглэл">
        <textarea
          value={tripNotice}
          onChange={(event) => setTripNoticeDraft(event.target.value)}
          rows={6}
          placeholder="Жишээ нь: Бид гуравдагч этгээдийн үйлчилгээний чанарт хариуцлага хүлээхгүй болно…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Тухайн нэг аялалд л зориулсан тэмдэглэл байвал тухайн аяллыг засах
          хуудсан дахь &ldquo;Чухал тэмдэглэл&rdquo; хэсэгт бичнэ — энэ хоёр
          хамт харагдана. Хоосон орхивол ямар ч аялал дээр харагдахгүй.
        </p>
      </Card>

      <Card title="Нүүр хуудасны толгой хэсэг" hint="Сайтад орсон даруйдаа хамгийн түрүүнд харагдах бичвэр.">
        <div className="space-y-4">
          <div>
            <Label>Жижиг бичвэр (гарчгийн дээр)</Label>
            <Input value={homeEyebrow} onChange={(e) => setHomeEyebrowDraft(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Гарчиг (1-р мөр)</Label>
            <Input value={homeTitle} onChange={(e) => setHomeTitleDraft(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Гарчиг (2-р мөр, шар өнгөөр)</Label>
            <Input value={homeAccent} onChange={(e) => setHomeAccentDraft(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Дэд гарчиг</Label>
            <Textarea value={homeSubtitle} onChange={(e) => setHomeSubtitleDraft(e.target.value)} rows={2} className="mt-1.5" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Товч 1 (цагаан)</Label>
              <Input value={homePrimaryCta} onChange={(e) => setHomePrimaryCtaDraft(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Товч 2 (хүрээтэй)</Label>
              <Input value={homeSecondaryCta} onChange={(e) => setHomeSecondaryCtaDraft(e.target.value)} className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label>Баруун доод булангийн бичвэр</Label>
            <Input value={homeBadge} onChange={(e) => setHomeBadgeDraft(e.target.value)} className="mt-1.5" />
          </div>

          <div className="border-t border-border pt-4">
            <Label>Эргэлддэг зурагнууд</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Хэдэн ч зураг байж болно, зэрэгцэн эргэлдэнэ. Нэг ч зураг
              нэмээгүй бол одоогийн стандарт зургууд харагдана.
            </p>
            <div className="mt-2 space-y-3">
              {homeImages.map((url, index) => (
                <div key={index} className="flex items-start gap-2 rounded-xl border border-border bg-secondary/30 p-3">
                  <div className="flex-1">
                    <ImageUploadField
                      label={`Зураг ${index + 1}`}
                      value={url}
                      onChange={(next) => updateHomeImage(index, next)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeHomeImage(index)}
                    className="mt-7 shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Устгах"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addHomeImage}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
            >
              <Plus className="h-4 w-4" />
              Зураг нэмэх
            </button>
          </div>
        </div>
      </Card>

      <Card
        title="Итгэлийн зурвас (нүүр хуудас, гарчгийн доор)"
        hint='Эхний 2 хайрцаг чөлөөтэй засварлана. 3-р хайрцгийн бичвэрт "{{phone}}" гэж бичвэл таны утасны дугаараар автоматаар солигдоно. 4-р хайрцаг (аяллын тоо) бодит тоо тул засварлагдахгүй.'
      >
        <div className="space-y-3">
          {trustFacts.map((fact, index) => {
            const Icon = aboutIcon(fact.icon);
            return (
              <div key={index} className="rounded-xl border border-border bg-secondary/30 p-3">
                <div className="flex items-start gap-2">
                  <select
                    value={fact.icon}
                    onChange={(e) => updateTrustFact(index, { icon: e.target.value })}
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
                    value={fact.title}
                    onChange={(e) => updateTrustFact(index, { title: e.target.value })}
                    placeholder="Гарчиг"
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeTrustFact(index)}
                    className="mt-1.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Устгах"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <Textarea
                  value={fact.text}
                  onChange={(e) => updateTrustFact(index, { text: e.target.value })}
                  placeholder="Тайлбар"
                  rows={2}
                  className="mt-2"
                />
              </div>
            );
          })}
          <button
            type="button"
            onClick={addTrustFact}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
          >
            <Plus className="h-4 w-4" />
            Хайрцаг нэмэх
          </button>

          <div className="border-t border-border pt-3">
            <Label>3-р хайрцгийн бичвэр (утас)</Label>
            <Textarea
              value={trustPhoneText}
              onChange={(e) => setTrustPhoneTextDraft(e.target.value)}
              rows={2}
              className="mt-1.5"
            />
          </div>
        </div>
      </Card>

      <Card title="&ldquo;Огноо тохирохгүй байна уу?&rdquo; хэсэг (нүүр хуудас)" hint="Нүүр хуудасны доод хэсэгт харагдах товч урилга.">
        <TitleBodyFields
          titleLabel="Гарчиг"
          bodyLabel="Тайлбар"
          title={homeCtaTitle}
          body={homeCtaBody}
          onTitleChange={setHomeCtaTitleDraft}
          onBodyChange={setHomeCtaBodyDraft}
        />
      </Card>

      <Card title="Захиалгат аялал хуудас">
        <TitleBodyFields
          titleLabel="Гарчиг"
          bodyLabel="Тайлбар"
          title={customTripTitle}
          body={customTripBody}
          onTitleChange={setCustomTripTitleDraft}
          onBodyChange={setCustomTripBodyDraft}
          bodyRows={4}
        />
      </Card>

      <Card title="Бэлэг захиалах хуудас">
        <TitleBodyFields
          titleLabel="Гарчиг"
          bodyLabel="Тайлбар"
          title={giftTitle}
          body={giftBody}
          onTitleChange={setGiftTitleDraft}
          onBodyChange={setGiftBodyDraft}
          bodyRows={4}
        />
      </Card>

      <Card title="Бидний тухай хуудас" hint="&ldquo;Бидний тухай&rdquo; хуудасны гарчиг болон доорх хайрцгуудыг энд засна.">
        <div className="space-y-4">
          <div>
            <Label>Гарчиг</Label>
            <Input value={aboutTitle} onChange={(e) => setAboutTitleDraft(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>Дэд гарчиг</Label>
            <Textarea value={aboutSubtitle} onChange={(e) => setAboutSubtitleDraft(e.target.value)} rows={3} className="mt-1.5" />
          </div>

          <div className="border-t border-border pt-4">
            <Label>Хайрцгууд</Label>
            <div className="mt-2 space-y-3">
              {aboutValues.map((value, index) => {
                const Icon = aboutIcon(value.icon);
                return (
                  <div key={index} className="rounded-xl border border-border bg-secondary/30 p-3">
                    <div className="flex items-start gap-2">
                      <select
                        value={value.icon}
                        onChange={(e) => updateAboutValue(index, { icon: e.target.value })}
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
                        onChange={(e) => updateAboutValue(index, { title: e.target.value })}
                        placeholder="Гарчиг"
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeAboutValue(index)}
                        className="mt-1.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Устгах"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <Textarea
                      value={value.text}
                      onChange={(e) => updateAboutValue(index, { text: e.target.value })}
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
              onClick={addAboutValue}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
            >
              <Plus className="h-4 w-4" />
              Хайрцаг нэмэх
            </button>
          </div>
        </div>
      </Card>

      <Card title="Түгээмэл асуулт (FAQ)" hint="Асуулт болон хариултыг энд нэмнэ, засна, устгана.">
        <div className="space-y-3">
          {faqs.map((item, index) => (
            <div key={index} className="rounded-xl border border-border bg-secondary/30 p-3">
              <div className="flex items-start gap-2">
                <Input
                  value={item.q}
                  onChange={(e) => updateFaq(index, { q: e.target.value })}
                  placeholder="Асуулт"
                  className="flex-1 font-medium"
                />
                <button
                  type="button"
                  onClick={() => removeFaq(index)}
                  className="mt-1.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Устгах"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Textarea
                value={item.a}
                onChange={(e) => updateFaq(index, { a: e.target.value })}
                placeholder="Хариулт"
                rows={2}
                className="mt-2"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addFaq}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
        >
          <Plus className="h-4 w-4" />
          Асуулт нэмэх
        </button>
      </Card>

      <Card title="Үйлчилгээний нөхцөл" hint="Хугацаа, төлбөр, цуцлалтын нөхцөл зэрэг заалтуудыг энд засна.">
        <div className="space-y-3">
          {terms.map((section, index) => (
            <div key={index} className="rounded-xl border border-border bg-secondary/30 p-3">
              <div className="flex items-start gap-2">
                <Input
                  value={section.title}
                  onChange={(e) => updateTerm(index, { title: e.target.value })}
                  placeholder="Гарчиг"
                  className="flex-1 font-medium"
                />
                <button
                  type="button"
                  onClick={() => removeTerm(index)}
                  className="mt-1.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Устгах"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Textarea
                value={section.body}
                onChange={(e) => updateTerm(index, { body: e.target.value })}
                placeholder="Заалтын бичвэр"
                rows={4}
                className="mt-2"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addTerm}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
        >
          <Plus className="h-4 w-4" />
          Заалт нэмэх
        </button>
      </Card>

      <Button onClick={() => save.mutate()} disabled={save.isPending} className="mt-6">
        {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Хадгалах
      </Button>
    </>
  );
}
