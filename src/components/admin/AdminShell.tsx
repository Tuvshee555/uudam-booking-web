"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Coins,
  FolderTree,
  Inbox,
  LayoutDashboard,
  Menu,
  ExternalLink,
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
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { locale } = useI18n();
  const { setAuthToken } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

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
  const navigation = (
    <nav aria-label="Админ цэс" className="space-y-0.5 p-3">
      {nav.map(({ href, label, icon: Icon, exact }, index) => {
        const active = exact ? pathname === href : pathname === href || pathname?.startsWith(`${href}/`);
        const group = index === 0 ? "Өдөр тутам" : index === 3 ? "Аяллын сан" : index === 7 ? "Контент" : index === 10 ? "Удирдлага" : null;
        return <div key={href}>{group && <p className="px-3 pb-2 pt-4 text-xs font-medium text-muted-foreground">{group}</p>}
          <Link href={href} aria-current={active ? "page" : undefined} onClick={() => setMenuOpen(false)} className={cn("flex min-h-10 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors", active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}><Icon className="h-4 w-4 shrink-0" /><span className="min-w-0 break-words">{label}</span></Link>
        </div>;
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-secondary/30 lg:flex">
      <aside className="sticky top-0 hidden h-dvh shrink-0 border-r border-border bg-background lg:flex lg:w-56 lg:flex-col">
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-border px-5">
          <Image src="/uudam-logo.jpg" alt="Uudam" width={30} height={30} className="rounded-md" />
          <span className="text-sm font-semibold text-foreground">UUDAM · Админ</span>
        </div>

        <div className="flex-1 overflow-y-auto">{navigation}</div>

        <div className="shrink-0 space-y-0.5 border-t border-border p-3">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
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
            <span className="text-sm font-semibold text-foreground">UUDAM · Админ</span>

            <div className="ml-auto flex items-center gap-2">
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild><button type="button" title="Админ цэс" aria-label="Админ цэс" className="rounded-md p-2 hover:bg-secondary"><Menu className="h-5 w-5" /></button></SheetTrigger>
                <SheetContent side="left" className="w-72 overflow-y-auto p-0">
                  <SheetTitle className="border-b border-border px-6 py-5 text-sm">UUDAM · Админ</SheetTitle>
                  {navigation}
                </SheetContent>
              </Sheet>
              <Link
                href={`/${locale}`}
                title="Сайт харах"
                aria-label="Сайт харах"
                className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <ExternalLink className="h-5 w-5" />
              </Link>
              <button
                type="button"
                onClick={() => setAuthToken(null)}
                title="Гарах"
                aria-label="Гарах"
                className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

        </div>

        <div className="uudam-container py-8">{children}</div>
      </div>
    </div>
  );
}
