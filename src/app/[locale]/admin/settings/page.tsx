"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ExternalLink, Loader2, Plus, Save, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { api, apiErrorMessage } from "@/lib/api";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
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
import { Textarea } from "@/components/ui/textarea";
import ImageUploadField from "@/components/admin/trip-form/ImageUploadField";
import { ErrorState, FormField, PageHeader, Panel, useConfirm } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

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

const ICON_NAMES: Record<string, string> = {
  globe: "Дэлхий",
  compass: "Луужин",
  shield: "Бамбай",
  heart: "Халамж",
  users: "Хүмүүс",
  clock: "Цаг",
  award: "Шагнал",
  phone: "Утас",
  pin: "Байршил",
  sparkles: "Гялбаа",
};

const SECTIONS = [
  { id: "trip-notice", label: "Бүх аялалд харагдах тэмдэглэл" },
  { id: "bank", label: "Банкны мэдээлэл" },
  { id: "home-hero", label: "Нүүр хуудас: дээд хэсэг" },
  { id: "trust", label: "Нүүр хуудас: итгэлийн зурвас" },
  { id: "home-cta", label: "Нүүр хуудас: «Огноо тохирохгүй»" },
  { id: "custom-trip", label: "Захиалгат аяллын хуудас" },
  { id: "gift", label: "Бэлгийн хуудас" },
  { id: "about", label: "Бидний тухай" },
  { id: "faq", label: "Түгээмэл асуулт" },
  { id: "terms", label: "Үйлчилгээний нөхцөл" },
];

function move<T>(list: T[], index: number, by: -1 | 1): T[] {
  const target = index + by;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Up / down / remove for one entry of an editable list. */
function ItemControls({ index, count, onMove, onRemove, removeLabel }: { index: number; count: number; onMove: (by: -1 | 1) => void; onRemove: () => void; removeLabel: string }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={index === 0} onClick={() => onMove(-1)} title="Дээш зөөх" aria-label="Дээш зөөх">
        <ArrowUp />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={index === count - 1} onClick={() => onMove(1)} title="Доош зөөх" aria-label="Доош зөөх">
        <ArrowDown />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={onRemove} title={removeLabel} aria-label={removeLabel}>
        <Trash2 />
      </Button>
    </div>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary"
    >
      <Plus className="h-4 w-4" />
      {children}
    </button>
  );
}

/** Pick an icon by looking at it, not by its code name. */
function IconPicker({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Дүрс сонгох" className="flex flex-wrap gap-1">
      {ABOUT_ICON_OPTIONS.map((key) => {
        const Icon = aboutIcon(key);
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={ICON_NAMES[key] ?? key}
            title={ICON_NAMES[key] ?? key}
            onClick={() => onChange(key)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

function Section({ id, title, hint, viewHref, children }: { id: string; title: string; hint?: string; viewHref?: string; children: ReactNode }) {
  return (
    <Panel
      id={id}
      title={title}
      description={hint}
      actions={
        viewHref && (
          <a href={viewHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Сайт дээр харах
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )
      }
    >
      {children}
    </Panel>
  );
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { locale } = useI18n();
  const site = `/${locale}`;

  const { data, isLoading, isError, error, refetch } = useQuery<SettingsResponse>({
    queryKey: ["settings"],
    queryFn: async () => (await api.get("/settings")).data,
  });

  // Undefined means "not yet touched" — the field shows the loaded value in
  // that state. Editing switches to the typed value, so a save sends exactly
  // what's on screen instead of racing a useEffect against the query.
  const [tripNoticeDraft, setTripNoticeDraft] = useState<string | undefined>(undefined);
  const [bankDetailsDraft, setBankDetailsDraft] = useState<string | undefined>(undefined);

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

  const drafts = [
    tripNoticeDraft, bankDetailsDraft, aboutTitleDraft, aboutSubtitleDraft, aboutValuesDraft,
    homeEyebrowDraft, homeTitleDraft, homeAccentDraft, homeSubtitleDraft, homeImagesDraft,
    homePrimaryCtaDraft, homeSecondaryCtaDraft, homeBadgeDraft, trustFactsDraft, trustPhoneTextDraft,
    homeCtaTitleDraft, homeCtaBodyDraft, customTripTitleDraft, customTripBodyDraft, giftTitleDraft,
    giftBodyDraft, faqsDraft, termsDraft,
  ];
  const dirty = drafts.some((draft) => draft !== undefined);

  function resetDrafts() {
    for (const reset of [
      setTripNoticeDraft, setBankDetailsDraft, setAboutTitleDraft, setAboutSubtitleDraft, setHomeEyebrowDraft,
      setHomeTitleDraft, setHomeAccentDraft, setHomeSubtitleDraft, setHomePrimaryCtaDraft, setHomeSecondaryCtaDraft,
      setHomeBadgeDraft, setTrustPhoneTextDraft, setHomeCtaTitleDraft, setHomeCtaBodyDraft, setCustomTripTitleDraft,
      setCustomTripBodyDraft, setGiftTitleDraft, setGiftBodyDraft,
    ]) reset(undefined);
    setAboutValuesDraft(undefined);
    setHomeImagesDraft(undefined);
    setTrustFactsDraft(undefined);
    setFaqsDraft(undefined);
    setTermsDraft(undefined);
  }

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const tripNotice = tripNoticeDraft ?? data?.tripNotice ?? "";
  const bankDetails = bankDetailsDraft ?? data?.bankDetails ?? "";

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

  function updateTrustFact(index: number, patch: Partial<TrustFact>) {
    setTrustFactsDraft(trustFacts.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }
  function updateAboutValue(index: number, patch: Partial<AboutValue>) {
    setAboutValuesDraft(aboutValues.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }
  function updateFaq(index: number, patch: Partial<FaqItem>) {
    setFaqsDraft(faqs.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }
  function updateTerm(index: number, patch: Partial<TermsSection>) {
    setTermsDraft(terms.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  const save = useMutation({
    mutationFn: async () =>
      (
        await api.put<SettingsResponse>("/settings", {
          tripNotice: tripNotice.trim() || null,
          bankDetails: bankDetails.trim() || null,
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
        })
      ).data,
    onSuccess: (saved) => {
      // The saved row is what the page shows next — so clearing the drafts
      // can't flash the old values while the refetch is in flight.
      queryClient.setQueryData(["settings"], saved);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      resetDrafts();
      toast.success("Хадгалагдлаа. Сайт дээр шууд харагдана.");
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Хадгалахад алдаа гарлаа")),
  });

  async function discard() {
    const ok = await confirm({
      title: "Өөрчлөлтөө болих уу?",
      description: "Хадгалаагүй бүх өөрчлөлт арилж, сүүлд хадгалсан хувилбар руу буцна.",
      confirmLabel: "Өөрчлөлтийг болих",
      tone: "danger",
    });
    if (ok) resetDrafts();
  }

  if (isLoading) {
    return (
      <>
        <PageHeader title="Тохиргоо" />
        <div className="h-96 max-w-3xl animate-pulse rounded-xl bg-card" />
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader title="Тохиргоо" />
        <Panel>
          <ErrorState error={error} onRetry={() => refetch()} />
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Тохиргоо"
        description="Сайтын хуудсууд дээрх бичвэр, зураг болон банкны мэдээллийг энд засна. Хоосон орхисон талбарт анхны бичвэр харагдсаар байна. Өөрчлөлтөө доод талын «Хадгалах» товчоор хадгална."
      />

      <div className="grid gap-6 xl:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Тохиргооны хэсгүүд" className="hidden xl:block">
          <ul className="sticky top-6 space-y-0.5 text-sm">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="block rounded-md px-3 py-1.5 text-muted-foreground hover:bg-card hover:text-foreground">
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 max-w-3xl space-y-6">
          <label className="block xl:hidden">
            <span className="sr-only">Хэсэг рүү очих</span>
            <select
              defaultValue=""
              onChange={(event) => {
                document.getElementById(event.target.value)?.scrollIntoView({ behavior: "smooth", block: "start" });
                event.target.value = "";
              }}
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm"
            >
              <option value="" disabled>
                Хэсэг рүү очих…
              </option>
              {SECTIONS.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
          </label>

          <Section id="trip-notice" title="Бүх аялалд харагдах чухал тэмдэглэл" hint="Аялал бүрийн хуудсан дахь шар «Чухал тэмдэглэл» хайрцагт харагдана.">
            <FormField
              label="Тэмдэглэл"
              hint="Мөр бүр тусдаа тэмдэглэл болж харагдана. Зөвхөн нэг аялалд хамаатай тэмдэглэлийг тухайн аяллын засах хуудасны «Нөхцөл, багц» хэсэгт бичнэ — хоёулаа хамт харагдана. Хоосон орхивол харагдахгүй."
            >
              <Textarea
                value={tripNotice}
                onChange={(event) => setTripNoticeDraft(event.target.value)}
                rows={6}
                placeholder={"Жишээ нь:\nҮнэ болон гарах огноог админ удахгүй баталгаажуулна.\nШинжилгээ өгөх аялагчид 3-р өдөр өглөөний цай уухгүй, өлөн байна."}
              />
            </FormField>
          </Section>

          <Section
            id="bank"
            title="Банкны мэдээлэл (онлайн захиалга)"
            hint="Үйлчлүүлэгч онлайнаар захиалга хийсний дараа энэ мэдээллээр мөнгөө шилжүүлнэ. Захиалгын дэлгэц болон баталгаажуулах и-мэйлд харагдана."
          >
            <FormField
              label="Шилжүүлэх данс"
              hint="Банкныхаа бичдэг шиг бичнэ: банкны нэр, дансны дугаар, хүлээн авагчийн нэр. Гүйлгээний утгад захиалгын дугаараа бичихийг сайт өөрөө сануулдаг."
            >
              <Textarea
                value={bankDetails}
                onChange={(event) => setBankDetailsDraft(event.target.value)}
                rows={4}
                placeholder={"Жишээ нь:\nХаан банк · 5000 123 456\nХүлээн авагч: Үүдам Трэвел ХХК"}
              />
            </FormField>
            {!bankDetails.trim() && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-400/10 dark:text-amber-100">
                Одоогоор хоосон байна. Онлайнаар захиалсан хүн хаашаа мөнгө шилжүүлэхээ мэдэхгүй тул заавал бөглөнө үү.
              </p>
            )}
          </Section>

          <Section id="home-hero" title="Нүүр хуудас: дээд хэсэг" hint="Сайтад орсон даруйд хамгийн түрүүнд харагдах бичвэр, зураг." viewHref={site}>
            <div className="space-y-4">
              <FormField label="Жижиг бичвэр (гарчгийн дээр)">
                <Input value={homeEyebrow} onChange={(e) => setHomeEyebrowDraft(e.target.value)} />
              </FormField>
              <FormField label="Гарчиг — 1-р мөр">
                <Input value={homeTitle} onChange={(e) => setHomeTitleDraft(e.target.value)} />
              </FormField>
              <FormField label="Гарчиг — 2-р мөр (шар өнгөөр)">
                <Input value={homeAccent} onChange={(e) => setHomeAccentDraft(e.target.value)} />
              </FormField>
              <FormField label="Дэд гарчиг">
                <Textarea value={homeSubtitle} onChange={(e) => setHomeSubtitleDraft(e.target.value)} rows={2} />
              </FormField>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Товч 1 (цагаан)">
                  <Input value={homePrimaryCta} onChange={(e) => setHomePrimaryCtaDraft(e.target.value)} />
                </FormField>
                <FormField label="Товч 2 (хүрээтэй)">
                  <Input value={homeSecondaryCta} onChange={(e) => setHomeSecondaryCtaDraft(e.target.value)} />
                </FormField>
              </div>
              <FormField label="Баруун доод булангийн бичвэр">
                <Input value={homeBadge} onChange={(e) => setHomeBadgeDraft(e.target.value)} />
              </FormField>

              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium">Ээлжлэн солигдох зургууд</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Хэдэн ч зураг байж болно, дарааллаараа ээлжлэн солигдоно. Нэг ч зураг үлдээгээгүй бол анхны стандарт зургууд харагдана.
                </p>
                <div className="mt-3 space-y-3">
                  {homeImages.map((url, index) => (
                    <div key={index} className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
                      <div className="min-w-0 flex-1">
                        <ImageUploadField
                          label={`Зураг ${index + 1}`}
                          value={url}
                          onChange={(next) => setHomeImagesDraft(homeImages.map((v, i) => (i === index ? next : v)))}
                        />
                      </div>
                      <ItemControls
                        index={index}
                        count={homeImages.length}
                        onMove={(by) => setHomeImagesDraft(move(homeImages, index, by))}
                        onRemove={() => setHomeImagesDraft(homeImages.filter((_, i) => i !== index))}
                        removeLabel="Зургийг хасах"
                      />
                    </div>
                  ))}
                </div>
                <AddButton onClick={() => setHomeImagesDraft([...homeImages, ""])}>Зураг нэмэх</AddButton>
              </div>
            </div>
          </Section>

          <Section
            id="trust"
            title="Нүүр хуудас: итгэлийн зурвас"
            hint="Нүүр хуудасны гарчгийн доорх жижиг хайрцгууд. Утасны хайрцаг болон аяллын тоо нь тусдаа — аяллын тоо бодит тоо тул автоматаар гарна."
            viewHref={site}
          >
            <div className="space-y-3">
              {trustFacts.map((fact, index) => (
                <div key={index} className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <IconPicker value={fact.icon} onChange={(icon) => updateTrustFact(index, { icon })} />
                    <ItemControls
                      index={index}
                      count={trustFacts.length}
                      onMove={(by) => setTrustFactsDraft(move(trustFacts, index, by))}
                      onRemove={() => setTrustFactsDraft(trustFacts.filter((_, i) => i !== index))}
                      removeLabel="Хайрцгийг хасах"
                    />
                  </div>
                  <Input
                    value={fact.title}
                    onChange={(e) => updateTrustFact(index, { title: e.target.value })}
                    placeholder="Гарчиг"
                    aria-label={`${index + 1}-р хайрцгийн гарчиг`}
                    className="mt-2 font-medium"
                  />
                  <Textarea
                    value={fact.text}
                    onChange={(e) => updateTrustFact(index, { text: e.target.value })}
                    placeholder="Тайлбар"
                    aria-label={`${index + 1}-р хайрцгийн тайлбар`}
                    rows={2}
                    className="mt-2"
                  />
                </div>
              ))}
              <AddButton onClick={() => setTrustFactsDraft([...trustFacts, { icon: "sparkles", title: "", text: "" }])}>Хайрцаг нэмэх</AddButton>

              <div className="border-t border-border pt-4">
                <FormField label="Утасны хайрцгийн бичвэр" hint="«{{phone}}» гэж бичсэн газар байгууллагын утасны дугаар автоматаар орно.">
                  <Textarea value={trustPhoneText} onChange={(e) => setTrustPhoneTextDraft(e.target.value)} rows={2} />
                </FormField>
              </div>
            </div>
          </Section>

          <Section id="home-cta" title="Нүүр хуудас: «Огноо тохирохгүй байна уу?»" hint="Нүүр хуудасны доод хэсэгт байх захиалгат аяллын товч урилга." viewHref={site}>
            <div className="space-y-4">
              <FormField label="Гарчиг">
                <Input value={homeCtaTitle} onChange={(e) => setHomeCtaTitleDraft(e.target.value)} />
              </FormField>
              <FormField label="Тайлбар">
                <Textarea value={homeCtaBody} onChange={(e) => setHomeCtaBodyDraft(e.target.value)} rows={3} />
              </FormField>
            </div>
          </Section>

          <Section id="custom-trip" title="Захиалгат аяллын хуудас" viewHref={`${site}/custom-trip`}>
            <div className="space-y-4">
              <FormField label="Гарчиг">
                <Input value={customTripTitle} onChange={(e) => setCustomTripTitleDraft(e.target.value)} />
              </FormField>
              <FormField label="Тайлбар">
                <Textarea value={customTripBody} onChange={(e) => setCustomTripBodyDraft(e.target.value)} rows={4} />
              </FormField>
            </div>
          </Section>

          <Section id="gift" title="Бэлэг захиалах хуудас" viewHref={`${site}/gift`}>
            <div className="space-y-4">
              <FormField label="Гарчиг">
                <Input value={giftTitle} onChange={(e) => setGiftTitleDraft(e.target.value)} />
              </FormField>
              <FormField label="Тайлбар">
                <Textarea value={giftBody} onChange={(e) => setGiftBodyDraft(e.target.value)} rows={4} />
              </FormField>
            </div>
          </Section>

          <Section id="about" title="Бидний тухай хуудас" hint="Хуудасны гарчиг болон доорх онцлох хайрцгууд." viewHref={`${site}/about`}>
            <div className="space-y-4">
              <FormField label="Гарчиг">
                <Input value={aboutTitle} onChange={(e) => setAboutTitleDraft(e.target.value)} />
              </FormField>
              <FormField label="Дэд гарчиг">
                <Textarea value={aboutSubtitle} onChange={(e) => setAboutSubtitleDraft(e.target.value)} rows={3} />
              </FormField>

              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium">Онцлох хайрцгууд</p>
                <div className="mt-2 space-y-3">
                  {aboutValues.map((value, index) => (
                    <div key={index} className="rounded-lg border border-border bg-muted/30 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <IconPicker value={value.icon} onChange={(icon) => updateAboutValue(index, { icon })} />
                        <ItemControls
                          index={index}
                          count={aboutValues.length}
                          onMove={(by) => setAboutValuesDraft(move(aboutValues, index, by))}
                          onRemove={() => setAboutValuesDraft(aboutValues.filter((_, i) => i !== index))}
                          removeLabel="Хайрцгийг хасах"
                        />
                      </div>
                      <Input
                        value={value.title}
                        onChange={(e) => updateAboutValue(index, { title: e.target.value })}
                        placeholder="Гарчиг"
                        aria-label={`${index + 1}-р хайрцгийн гарчиг`}
                        className="mt-2 font-medium"
                      />
                      <Textarea
                        value={value.text}
                        onChange={(e) => updateAboutValue(index, { text: e.target.value })}
                        placeholder="Тайлбар"
                        aria-label={`${index + 1}-р хайрцгийн тайлбар`}
                        rows={2}
                        className="mt-2"
                      />
                    </div>
                  ))}
                </div>
                <AddButton onClick={() => setAboutValuesDraft([...aboutValues, { icon: "sparkles", title: "", text: "" }])}>Хайрцаг нэмэх</AddButton>
              </div>
            </div>
          </Section>

          <Section id="faq" title="Түгээмэл асуулт" hint="Сайтын «Түгээмэл асуулт» хуудсанд энэ дарааллаар харагдана." viewHref={`${site}/faq`}>
            <div className="space-y-3">
              {faqs.map((item, index) => (
                <div key={index} className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 w-6 shrink-0 text-center text-xs font-bold text-muted-foreground">{index + 1}</span>
                    <Input
                      value={item.q}
                      onChange={(e) => updateFaq(index, { q: e.target.value })}
                      placeholder="Асуулт"
                      aria-label={`${index + 1}-р асуулт`}
                      className="flex-1 font-medium"
                    />
                    <ItemControls
                      index={index}
                      count={faqs.length}
                      onMove={(by) => setFaqsDraft(move(faqs, index, by))}
                      onRemove={() => setFaqsDraft(faqs.filter((_, i) => i !== index))}
                      removeLabel="Асуултыг хасах"
                    />
                  </div>
                  <Textarea
                    value={item.a}
                    onChange={(e) => updateFaq(index, { a: e.target.value })}
                    placeholder="Хариулт"
                    aria-label={`${index + 1}-р асуултын хариулт`}
                    rows={2}
                    className="mt-2"
                  />
                </div>
              ))}
            </div>
            <AddButton onClick={() => setFaqsDraft([...faqs, { q: "", a: "" }])}>Асуулт нэмэх</AddButton>
          </Section>

          <Section id="terms" title="Үйлчилгээний нөхцөл" hint="Хугацаа, төлбөр, цуцлалтын нөхцөл зэрэг заалтууд." viewHref={`${site}/terms`}>
            <div className="space-y-3">
              {terms.map((section, index) => (
                <div key={index} className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 w-6 shrink-0 text-center text-xs font-bold text-muted-foreground">{index + 1}</span>
                    <Input
                      value={section.title}
                      onChange={(e) => updateTerm(index, { title: e.target.value })}
                      placeholder="Заалтын гарчиг"
                      aria-label={`${index + 1}-р заалтын гарчиг`}
                      className="flex-1 font-medium"
                    />
                    <ItemControls
                      index={index}
                      count={terms.length}
                      onMove={(by) => setTermsDraft(move(terms, index, by))}
                      onRemove={() => setTermsDraft(terms.filter((_, i) => i !== index))}
                      removeLabel="Заалтыг хасах"
                    />
                  </div>
                  <Textarea
                    value={section.body}
                    onChange={(e) => updateTerm(index, { body: e.target.value })}
                    placeholder="Заалтын бичвэр"
                    aria-label={`${index + 1}-р заалтын бичвэр`}
                    rows={4}
                    className="mt-2"
                  />
                </div>
              ))}
            </div>
            <AddButton onClick={() => setTermsDraft([...terms, { title: "", body: "" }])}>Заалт нэмэх</AddButton>
          </Section>
        </div>
      </div>

      <div className="sticky bottom-0 z-30 -mx-4 mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card/95 px-4 py-3 shadow-[0_-4px_12px_-8px_rgba(0,0,0,0.15)] backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <span className={cn("inline-flex items-center gap-1.5 text-sm", dirty ? "font-medium text-amber-800 dark:text-amber-300" : "text-muted-foreground")}>
          {dirty && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500" />}
          {dirty ? "Хадгалаагүй өөрчлөлт байна" : "Бүх өөрчлөлт хадгалагдсан"}
        </span>
        <div className="flex gap-2">
          {dirty && (
            <Button variant="outline" onClick={discard} disabled={save.isPending}>
              <Undo2 />
              Болих
            </Button>
          )}
          <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            {save.isPending ? "Хадгалж байна…" : "Хадгалах"}
          </Button>
        </div>
      </div>
    </>
  );
}
