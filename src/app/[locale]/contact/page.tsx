import type { Metadata } from "next";
import { Clock, Facebook, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { CONTACT, hasLink } from "@/lib/contact";
import WhatsAppIcon from "@/components/icons/WhatsAppIcon";

export const metadata: Metadata = {
  title: "Холбоо барих",
  description: "Uudam Travel Agency-тэй холбогдох.",
};

export default function ContactPage() {
  return (
    <div className="uudam-container max-w-3xl py-12">
      <h1 className="text-3xl font-bold">Холбоо барих</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Аяллын талаар асуух зүйл байвал бидэнтэй чөлөөтэй холбогдоорой. Ажлын цагаар
        хамгийн хурдан хариулна.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {hasLink(CONTACT.phone) && (
          <a
            href={CONTACT.phoneHref}
            className="flex items-start gap-3 rounded-2xl border border-border p-5 transition-colors hover:border-primary/40"
          >
            <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Phone className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold">Утас</span>
              <span className="block text-sm text-muted-foreground">{CONTACT.phone}</span>
            </span>
          </a>
        )}

        {hasLink(CONTACT.email) && (
          <a
            href={`mailto:${CONTACT.email}`}
            className="flex items-start gap-3 rounded-2xl border border-border p-5 transition-colors hover:border-primary/40"
          >
            <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Mail className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold">И-мэйл</span>
              <span className="block text-sm text-muted-foreground">{CONTACT.email}</span>
            </span>
          </a>
        )}

        <div className="flex items-start gap-3 rounded-2xl border border-border p-5">
          <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <MapPin className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold">Хаяг</span>
            <span className="block text-sm text-muted-foreground">{CONTACT.address}</span>
          </span>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-border p-5">
          <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Clock className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold">Ажиллах цаг</span>
            <span className="block text-sm text-muted-foreground">{CONTACT.workingHours}</span>
          </span>
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        {hasLink(CONTACT.whatsapp) && (
          <a
            href={CONTACT.whatsapp}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
          >
            <WhatsAppIcon className="h-4 w-4" />
            WhatsApp
          </a>
        )}
        {hasLink(CONTACT.messenger) && (
          <a
            href={CONTACT.messenger}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
          >
            <MessageCircle className="h-4 w-4" />
            Messenger
          </a>
        )}
        {hasLink(CONTACT.facebook) && (
          <a
            href={CONTACT.facebook}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
          >
            <Facebook className="h-4 w-4" />
            Facebook
          </a>
        )}
      </div>
    </div>
  );
}
