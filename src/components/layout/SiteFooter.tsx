"use client";

import Link from "next/link";
import { Facebook, Instagram, Mail, MapPin, Phone } from "lucide-react";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { CONTACT, hasLink } from "@/lib/contact";

export default function SiteFooter() {
  const { locale } = useI18n();
  const base = `/${locale}`;

  return (
    <footer className="mt-20 border-t border-border bg-secondary/40">
      <div className="uudam-container grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-lg font-extrabold tracking-wide text-primary">UUDAM</div>
          <div className="uudam-eyebrow mt-1">Travel Agency</div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Гадаад, дотоодын аяллын багц. Хөтөлбөр, үнэ, хөдлөх огноог ил тод харуулна.
            Хүсэлт үлдээвэл ажилтан тань руу залгаж дэлгэрэнгүйг тодруулна.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Аялал</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li>
              <Link href={`${base}/trips`} className="hover:text-primary">
                Бүх аялал
              </Link>
            </li>
            <li>
              <Link href={`${base}/trips?featured=true`} className="hover:text-primary">
                Онцлох аялал
              </Link>
            </li>
            <li>
              <Link href={`${base}/contact`} className="hover:text-primary">
                Зөвлөгөө авах
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Компани</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li>
              <Link href={`${base}/about`} className="hover:text-primary">
                Бидний тухай
              </Link>
            </li>
            <li>
              <Link href={`${base}/contact`} className="hover:text-primary">
                Холбоо барих
              </Link>
            </li>
            <li>
              <Link href={`${base}/terms`} className="hover:text-primary">
                Үйлчилгээний нөхцөл
              </Link>
            </li>
            <li>
              <Link href={`${base}/data-deletion`} className="hover:text-primary">
                Мэдээлэл устгах
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Холбоо барих</h3>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            {hasLink(CONTACT.phone) && (
              <li className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <a href={CONTACT.phoneHref} className="hover:text-primary">
                  {CONTACT.phone}
                </a>
              </li>
            )}
            {hasLink(CONTACT.email) && (
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <a href={`mailto:${CONTACT.email}`} className="hover:text-primary">
                  {CONTACT.email}
                </a>
              </li>
            )}
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{CONTACT.address}</span>
            </li>
          </ul>

          <div className="mt-5 flex gap-2">
            <a
              href={CONTACT.facebook}
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
              className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Facebook className="h-4 w-4" />
            </a>
            {hasLink(CONTACT.instagram) && (
              <a
                href={CONTACT.instagram}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Instagram className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="uudam-container flex flex-col gap-2 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Uudam Travel Agency. Бүх эрх хуулиар хамгаалагдсан.</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            Аяллын мэргэжлийн баг
          </span>
        </div>
      </div>
    </footer>
  );
}
