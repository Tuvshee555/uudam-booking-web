"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BarChart3, FolderTree, Inbox, LayoutDashboard, LogOut, Map, Users } from "lucide-react";

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
    { href: `${base}/trips`, label: "Аялалууд", icon: Map },
    { href: `${base}/categories`, label: "Ангилалууд", icon: FolderTree },
    { href: `${base}/analytics`, label: "Хандалт", icon: BarChart3 },
    { href: `${base}/staff`, label: "Ажилтнууд", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="uudam-navy-surface">
        <div className="uudam-container flex h-16 items-center gap-3">
          <Image src="/uudam-logo.jpg" alt="Uudam" width={32} height={32} className="rounded-md" />
          <span className="text-sm font-extrabold tracking-wide">UUDAM · Админ</span>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href={`/${locale}`}
              className="rounded-lg px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 hover:text-white"
            >
              Сайт харах
            </Link>
            <button
              type="button"
              onClick={() => setAuthToken(null)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 hover:text-white"
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
                  active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
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
  );
}
