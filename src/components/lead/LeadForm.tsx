"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { api, apiErrorMessage } from "@/lib/api";
import { getVisitorId, track } from "@/lib/analytics";
import { formatPhoneInput, nameError, phoneError } from "@/lib/formValidation";
import { canonicalPath } from "@/lib/locales";
import FormField, { inputClass, revealConfirmation, useSubmitGuard } from "@/components/site/FormField";
import Honeypot from "@/components/site/Honeypot";
import { ChannelLink } from "@/components/site/channels";
import { cn } from "@/lib/utils";

export type LeadField = {
  name: string;
  label: string;
  placeholder?: string;
  hint?: string;
  type?: "text" | "number" | "textarea";
  required?: boolean;
};

/**
 * Shared shell for the non-trip lead forms (custom trip, gift certificate).
 *
 * Both end where every enquiry ends — a reference code and a human to call —
 * so the confirmation, the validation and the Messenger fallback live here
 * once rather than being reimplemented per page and drifting apart.
 */
export default function LeadForm({
  kind,
  fields,
  submitLabel,
  successNote,
}: {
  kind: "CUSTOM" | "GIFT";
  fields: LeadField[];
  submitLabel: string;
  successNote: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const { busy, run } = useSubmitGuard();

  const set = (name: string, value: string) => setValues((current) => ({ ...current, [name]: value }));

  const fieldError = (field: LeadField) => (field.required && !values[field.name]?.trim() ? `${field.label.replace(/\?$/, "")} — бөглөнө үү` : null);
  const errors = { firstName: nameError(firstName), phone: phoneError(phone) };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const missing = fields.find((field) => fieldError(field));
    if (missing || errors.firstName || errors.phone) {
      setShowErrors(true);
      document.getElementById(missing ? `lead-${missing.name}` : errors.firstName ? "lead-name" : "lead-phone")?.focus();
      return;
    }

    await run(async () => {
      try {
        const { data } = await api.post("/enquiries", {
          kind,
          firstName: firstName.trim(),
          phone: phone.trim(),
          ...values,
          website,
          source: typeof window !== "undefined" ? window.location.pathname : undefined,
          visitorId: getVisitorId(),
          referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
        });
        track(kind === "CUSTOM" ? "custom_trip_submit" : "gift_submit");
        setReference(data.reference);
      } catch (err) {
        toast.error(apiErrorMessage(err, "Илгээхэд алдаа гарлаа. Дахин оролдоно уу."));
      }
    });
  };

  if (reference) {
    return (
      <div ref={revealConfirmation} className="scroll-mt-24 rounded-xl border border-border bg-card p-8 text-center shadow-panel">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
          <Check className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 tabIndex={-1} className="display-3 mt-5 text-foreground focus:outline-none">Хүсэлт илгээгдлээ</h2>
        <p className="mx-auto mt-2 max-w-sm text-[14.5px] leading-relaxed text-muted-foreground">{successNote}</p>
        <p className="mt-4 text-[1.5rem] font-bold tracking-[0.08em] text-foreground">{reference}</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">Залгах эсвэл бичихдээ энэ дугаараа хэлээрэй.</p>
        <div className="mx-auto mt-6 grid max-w-xs gap-2">
          <ChannelLink channelKey="phone" from={`lead-${kind.toLowerCase()}`} className="flex h-11 items-center justify-center rounded-full bg-primary text-[14px] font-semibold text-primary-foreground focus-ring">
            Одоо залгах
          </ChannelLink>
          <ChannelLink channelKey="messenger" from={`lead-${kind.toLowerCase()}`} className="flex h-11 items-center justify-center rounded-full border border-border text-[14px] font-semibold text-foreground focus-ring">
            Messenger-ээр бичих
          </ChannelLink>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="relative rounded-xl border border-border bg-card p-6 shadow-panel sm:p-8">
      <div className="grid gap-5">
        {fields.map((field) => (
          <FormField key={field.name} id={`lead-${field.name}`} label={field.label} required={field.required} hint={field.hint} error={showErrors ? fieldError(field) : null}>
            {(props) =>
              field.type === "textarea" ? (
                <textarea {...props} value={values[field.name] ?? ""} onChange={(event) => set(field.name, event.target.value)} placeholder={field.placeholder} rows={4} className={cn(inputClass, "h-auto py-3")} />
              ) : (
                <input
                  {...props}
                  type={field.type === "number" ? "number" : "text"}
                  inputMode={field.type === "number" ? "numeric" : undefined}
                  min={field.type === "number" ? 0 : undefined}
                  value={values[field.name] ?? ""}
                  onChange={(event) => set(field.name, event.target.value)}
                  placeholder={field.placeholder}
                  className={inputClass}
                />
              )
            }
          </FormField>
        ))}

        <div className="grid gap-5 border-t border-border pt-5 sm:grid-cols-2">
          <FormField id="lead-name" label="Таны нэр" required error={showErrors ? errors.firstName : null}>
            {(props) => <input {...props} value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" className={inputClass} />}
          </FormField>
          <FormField id="lead-phone" label="Утасны дугаар" required error={showErrors ? errors.phone : null}>
            {(props) => (
              <input {...props} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(formatPhoneInput(event.target.value))} placeholder="9911 2233" className={inputClass} />
            )}
          </FormField>
        </div>
      </div>
      <Honeypot value={website} onChange={setWebsite} />

      <p className="mt-5 flex gap-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
        <span>
          Энэ нь хүсэлт — ажилтан тантай холбогдож нөхцөл, үнийг тохирсны дараа баталгаажна. Мэдээллийг зөвхөн энэ хүсэлтэд ашиглана (<Link href={canonicalPath("/terms")} className="underline underline-offset-2 hover:text-foreground">нөхцөл</Link>).
        </span>
      </p>

      <button
        type="submit"
        disabled={busy}
        className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gold text-[15px] font-semibold text-navy-night transition-colors hover:bg-[hsl(41_88%_55%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {busy ? "Илгээж байна…" : submitLabel}
      </button>
    </form>
  );
}
