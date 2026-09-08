"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Coins,
  FolderTree,
  Inbox,
  LayoutDashboard,
  LogOut,
  Map,
  MessageSquareQuote,
  Newspaper,
  Sparkles,
  Settings,
  ShoppingBag,
  Tag,
  Users,
} from "lucide-react";

import { useAuth } from "@/app/[locale]/provider/AuthProvider";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { cn } from "@/lib/utils";

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { locale } = useI18n();
  const { setAuthToken } = useAuth();

  const base = `/${locale}/admin`;

  const nav = [
    { href: base, label: "Хяналт", icon: LayoutDashboard, exact: true },
    { href: `${base}/enquiries`, label: "Хүсэлтүүд", icon: Inbox },
    { href: `${base}/bookings`, label: "Захиалгууд", icon: ShoppingBag },
    { href: `${base}/trips`, label: "Аялалууд", icon: Map },
    { href: `${base}/categories`, label: "Ангилалууд", icon: FolderTree },
    { href: `${base}/tags`, label: "Шошгууд", icon: Tag },
    { href: `${base}/price-bands`, label: "Үнийн ангилал", icon: Coins },
    { href: `${base}/testimonials`, label: "Сэтгэгдэл", icon: MessageSquareQuote },
    { href: `${base}/posts`, label: "Зөвлөгөө", icon: Newspaper },
    { href: `${base}/knowledge`, label: "Танин мэдэхүй", icon: Sparkles },
    { href: `${base}/analytics`, label: "Хандалт", icon: BarChart3 },
    { href: `${base}/staff`, label: "Ажилтнууд", icon: Users },
    { href: `${base}/settings`, label: "Тохиргоо", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-secondary/30 lg:flex">
      <aside className="hidden shrink-0 border-r border-border bg-background lg:flex lg:w-60 lg:flex-col">
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-border px-5">
          <Image src="/uudam-logo.jpg" alt="Uudam" width={30} height={30} className="rounded-md" />
          <span className="text-sm font-extrabold tracking-wide text-foreground">UUDAM · Админ</span>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {nav.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 space-y-0.5 border-t border-border p-3">
          <Link
            href={`/${locale}`}
            className="flex items-center rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            Сайт харах
          </Link>
          <button
            type="button"
            onClick={() => setAuthToken(null)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Гарах
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="border-b border-border bg-background lg:hidden">
          <div className="uudam-container flex h-16 items-center gap-3">
            <Image src="/uudam-logo.jpg" alt="Uudam" width={32} height={32} className="rounded-md" />
            <span className="text-sm font-extrabold tracking-wide text-foreground">UUDAM · Админ</span>

            <div className="ml-auto flex items-center gap-2">
              <Link
                href={`/${locale}`}
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                Сайт харах
              </Link>
              <button
                type="button"
                onClick={() => setAuthToken(null)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                Гарах
              </button>
            </div>
          </div>

          <div className="uudam-container flex gap-1 overflow-x-auto pb-2 no-scrollbar">
            {nav.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname?.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    active ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="uudam-container py-8">{children}</div>
      </div>
    </div>
  );
}
