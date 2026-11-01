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
import { cn } from "@/lib/utils";

/**
 * A general question from the contact page. It lands in the same enquiry
 * queue staff already work from (as a lead with no trip attached), so
 * nothing new has to be watched.
 */
export default function ContactForm() {
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const { busy, run } = useSubmitGuard();

  const errors = {
    firstName: nameError(firstName),
    phone: phoneError(phone),
    message: message.trim().length < 3 ? "Асуух зүйлээ бичнэ үү" : null,
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (errors.firstName || errors.phone || errors.message) {
      setShowErrors(true);
      document.getElementById(errors.firstName ? "contact-name" : errors.phone ? "contact-phone" : "contact-message")?.focus();
      return;
    }
    await run(async () => {
      try {
        const { data } = await api.post("/enquiries", {
          firstName: firstName.trim(),
          phone: phone.trim(),
          message: message.trim(),
          website,
          source: typeof window !== "undefined" ? window.location.pathname : undefined,
          visitorId: getVisitorId(),
          referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
        });
        track("contact_submit");
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
        <h2 tabIndex={-1} className="display-3 mt-5 text-foreground focus:outline-none">Асуултыг тань хүлээн авлаа</h2>
        <p className="mx-auto mt-2 max-w-sm text-[14.5px] leading-relaxed text-muted-foreground">
          Манай ажилтан ажлын цагаар тань руу залгаж хариулна. Залгахдаа энэ дугаарыг хэлээрэй:
        </p>
        <p className="mt-4 text-[1.5rem] font-bold tracking-[0.08em] text-foreground">{reference}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="relative rounded-xl border border-border bg-card p-6 shadow-panel sm:p-8">
      <h2 className="display-3 text-foreground">Асуулт илгээх</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">Нэр, утсаа үлдээвэл ажилтан тань руу залгаж хариулна.</p>
      <div className="mt-6 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="contact-name" label="Таны нэр" required error={showErrors ? errors.firstName : null}>
            {(props) => <input {...props} value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" className={inputClass} />}
          </FormField>
          <FormField id="contact-phone" label="Утасны дугаар" required error={showErrors ? errors.phone : null}>
            {(props) => (
              <input {...props} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(formatPhoneInput(event.target.value))} placeholder="9911 2233" className={inputClass} />
            )}
          </FormField>
        </div>
        <FormField id="contact-message" label="Асуух зүйл" required error={showErrors ? errors.message : null}>
          {(props) => (
            <textarea {...props} rows={5} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ямар аялал сонирхож байна, хэдэн хүн, хэзээ…" className={cn(inputClass, "h-auto py-3")} />
          )}
        </FormField>
      </div>
      <Honeypot value={website} onChange={setWebsite} />
      <p className="mt-5 flex gap-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
        <span>
          Нэр, утсыг зөвхөн таны асуултад хариулахад ашиглана (<Link href={canonicalPath("/terms")} className="underline underline-offset-2 hover:text-foreground">нөхцөл</Link>).
        </span>
      </p>
      <button
        type="submit"
        disabled={busy}
        className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-ring disabled:cursor-wait disabled:opacity-70"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {busy ? "Илгээж байна…" : "Илгээх"}
      </button>
    </form>
  );
}
