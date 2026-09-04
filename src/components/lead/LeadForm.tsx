"use client";

import { useState } from "react";
import { Check, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";

import { api, apiErrorMessage } from "@/lib/api";
import { CONTACT, hasLink } from "@/lib/contact";
import { getVisitorId } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const set = (name: string, value: string) =>
    setValues((current) => ({ ...current, [name]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!firstName.trim()) {
      toast.error("Нэрээ оруулна уу");
      return;
    }
    if (phone.replace(/\D/g, "").length < 6) {
      toast.error("Утасны дугаараа зөв оруулна уу");
      return;
    }

    const missing = fields.find((field) => field.required && !values[field.name]?.trim());
    if (missing) {
      toast.error(`${missing.label} талбарыг бөглөнө үү`);
      return;
    }

    setBusy(true);
    try {
      const { data } = await api.post("/enquiries", {
        kind,
        firstName: firstName.trim(),
        phone: phone.trim(),
        ...values,
        source: typeof window !== "undefined" ? window.location.pathname : undefined,
        visitorId: getVisitorId(),
        referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
      });

      setReference(data.reference);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Илгээхэд алдаа гарлаа"));
    } finally {
      setBusy(false);
    }
  };

  if (reference) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
          <Check className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-lg font-bold">Хүсэлт илгээгдлээ</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{successNote}</p>
        <div className="mt-3 text-lg font-bold tracking-wider text-primary">{reference}</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Залгах эсвэл бичихдээ энэ дугаараа хэлээрэй.
        </p>

        <div className="mx-auto mt-5 grid max-w-xs gap-2">
          {hasLink(CONTACT.phone) && (
            <Button asChild variant="outline">
              <a href={CONTACT.phoneHref}>
                <Phone className="mr-2 h-4 w-4" />
                {CONTACT.phone}
              </a>
            </Button>
          )}
          {hasLink(CONTACT.messenger) && (
            <Button asChild variant="ghost">
              <a href={CONTACT.messenger} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                Messenger-ээр бичих
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
    >
      <div className="grid gap-4">
        {fields.map((field) => (
          <div key={field.name}>
            <Label htmlFor={field.name}>
              {field.label}
              {!field.required && (
                <span className="ml-1 font-normal text-muted-foreground">(заавал биш)</span>
              )}
            </Label>
            {field.type === "textarea" ? (
              <textarea
                id={field.name}
                value={values[field.name] ?? ""}
                onChange={(event) => set(field.name, event.target.value)}
                placeholder={field.placeholder}
                rows={4}
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            ) : (
              <Input
                id={field.name}
                type={field.type === "number" ? "number" : "text"}
                inputMode={field.type === "number" ? "numeric" : undefined}
                value={values[field.name] ?? ""}
                onChange={(event) => set(field.name, event.target.value)}
                placeholder={field.placeholder}
                className="mt-1.5"
              />
            )}
            {field.hint && <p className="mt-1 text-xs text-muted-foreground">{field.hint}</p>}
          </div>
        ))}

        <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="lead-name">Таны нэр</Label>
            <Input
              id="lead-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="lead-phone">Утас</Label>
            <Input
              id="lead-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="9911 2233"
              className="mt-1.5"
            />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={busy} className="mt-6 w-full">
        {busy ? "Илгээж байна…" : submitLabel}
      </Button>

      {hasLink(CONTACT.messenger) && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Эсвэл{" "}
          <a
            href={CONTACT.messenger}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            Messenger-ээр шууд бичээрэй
          </a>
        </p>
      )}
    </form>
  );
}
