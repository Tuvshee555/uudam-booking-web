"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Coins,
  ExternalLink,
  FolderTree,
  Inbox,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  MessageSquareQuote,
  Newspaper,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  Ticket,
  Users,
} from "lucide-react";

import { useAuth } from "@/app/[locale]/provider/AuthProvider";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { useAdminSummary } from "@/hooks/useAdminSummary";
import { useTripHealth } from "@/hooks/useTripHealth";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { ConfirmProvider, CountBadge } from "./ui";
import styles from "./admin-workspace.module.css";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  badge?: number;
  badgeTone?: "warning" | "danger" | "brand";
  badgeLabel?: string;
};

type NavGroup = { label: string; items: NavItem[] };

function isActive(pathname: string | null, item: NavItem) {
  if (!pathname) return false;
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { locale } = useI18n();
  const { setAuthToken, email } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: summary } = useAdminSummary();
  const { data: health } = useTripHealth({ enabled: false });

  const base = `/${locale}/admin`;

  // Grouped by what staff are doing, most frequent first. The badges are the
  // only numbers here: each one is work that is waiting on someone.
  const groups: NavGroup[] = [
    {
      label: "Өдөр тутмын ажил",
      items: [
        { href: base, label: "Нүүр", icon: LayoutDashboard, exact: true },
        {
          href: `${base}/enquiries`,
          label: "Хүсэлтүүд",
          icon: Inbox,
          badge: summary?.enquiries.new,
          badgeTone: "warning",
          badgeLabel: "шинэ хүсэлт залгахыг хүлээж байна",
        },
        {
          href: `${base}/bookings`,
          label: "Захиалгууд",
          icon: Ticket,
          badge: summary?.bookings.awaiting,
          badgeTone: "warning",
          badgeLabel: "захиалга төлбөр хүлээж байна",
        },
      ],
    },
    {
      label: "Аялал",
      items: [
        { href: `${base}/trips`, label: "Аялалууд", icon: Map },
        { href: `${base}/categories`, label: "Ангилалууд", icon: FolderTree },
        { href: `${base}/tags`, label: "Шошгууд", icon: Tag },
        { href: `${base}/price-bands`, label: "Үнийн шүүлтүүр", icon: Coins },
      ],
    },
    {
      label: "Сайтын агуулга",
      items: [
        { href: `${base}/testimonials`, label: "Сэтгэгдлүүд", icon: MessageSquareQuote },
        { href: `${base}/posts`, label: "Зөвлөгөө", icon: Newspaper },
        { href: `${base}/knowledge`, label: "Танин мэдэхүй", icon: Sparkles },
      ],
    },
    {
      label: "Тайлан, тохиргоо",
      items: [
        { href: `${base}/analytics`, label: "Хандалт", icon: BarChart3 },
        {
          href: `${base}/health`,
          label: "Сайтын шалгалт",
          icon: ShieldCheck,
          badge: health?.errors,
          badgeTone: "danger",
          badgeLabel: "алдаа илэрсэн",
        },
        { href: `${base}/staff`, label: "Ажилтнууд", icon: Users },
        { href: `${base}/settings`, label: "Тохиргоо", icon: Settings },
      ],
    },
  ];

  const current = groups.flatMap((group) => group.items).find((item) => isActive(pathname, item));

  // On a short screen the list scrolls; keep the page you're on in view.
  const desktopNav = useRef<HTMLDivElement>(null);
  useEffect(() => {
    desktopNav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  const navigation = (
    <nav aria-label="Админ цэс" className="space-y-4 px-3 py-3">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/45">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "relative flex min-h-9 items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[hsl(var(--uudam-gold))]",
                      active ? "bg-white/10 font-semibold text-white" : "text-white/70 hover:bg-white/[0.06] hover:text-white",
                    )}
                  >
                    {active && (
                      <span aria-hidden="true" className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[hsl(var(--uudam-gold))]" />
                    )}
                    <Icon className={cn("h-4 w-4 shrink-0", active && "text-[hsl(var(--uudam-gold))]")} />
                    <span className="min-w-0 flex-1 break-words">{item.label}</span>
                    {item.badge ? (
                      <>
                        <CountBadge count={item.badge} tone={item.badgeTone} />
                        <span className="sr-only">
                          {item.badge} {item.badgeLabel}
                        </span>
                      </>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const accountFooter = (
    <div className="shrink-0 space-y-0.5 border-t border-white/10 px-3 py-2">
      <a
        href={`/${locale}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-9 items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-white/70 hover:bg-white/[0.06] hover:text-white"
      >
        <ExternalLink className="h-4 w-4 shrink-0" />
        <span className="flex-1">Сайтыг харах</span>
        <span className="text-[11px] text-white/40">шинэ цонх</span>
      </a>
      <div className="flex items-center gap-3 rounded-lg px-3 py-2">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold uppercase text-white"
        >
          {(email ?? "?").charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-white/45">Нэвтэрсэн</p>
          <p className="truncate text-sm text-white/85" title={email ?? undefined}>
            {email ?? "Ажилтан"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAuthToken(null)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm text-white/70 hover:bg-white/[0.08] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[hsl(var(--uudam-gold))]"
        >
          <LogOut className="h-4 w-4" />
          Гарах
        </button>
      </div>
    </div>
  );

  const brand = (
    <div className="flex h-16 shrink-0 items-center gap-3 px-5">
      <Image src="/uudam-logo.jpg" alt="" width={32} height={32} className="rounded-lg ring-1 ring-white/20" />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-bold tracking-wide text-white">UUDAM</span>
        <span className="text-[11px] font-medium text-white/55">Удирдлагын хэсэг</span>
      </span>
    </div>
  );

  return (
    <ConfirmProvider>
      <div className="min-h-screen bg-muted/50 lg:flex">
        <a
          href="#admin-main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
        >
          Үндсэн хэсэг рүү шилжих
        </a>

        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-[hsl(var(--uudam-navy-deep))] lg:flex">
          {brand}
          <div ref={desktopNav} className="min-h-0 flex-1 overflow-y-auto">{navigation}</div>
          {accountFooter}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="sticky top-0 z-40 bg-[hsl(var(--uudam-navy-deep))] text-white lg:hidden">
            <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  aria-label="Цэс нээх"
                  aria-expanded={menuOpen}
                  className="relative flex h-10 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-white hover:bg-white/10"
                >
                  <Menu className="h-5 w-5" />
                  Цэс
                  {(summary?.enquiries.new ?? 0) + (summary?.bookings.awaiting ?? 0) > 0 && (
                    <span aria-hidden="true" className="absolute right-1 top-1.5 h-2 w-2 rounded-full bg-[hsl(var(--uudam-gold))]" />
                  )}
                </button>
                <SheetContent
                  side="left"
                  className="flex w-[18rem] flex-col gap-0 border-0 bg-[hsl(var(--uudam-navy-deep))] p-0 text-white [&>button]:text-white"
                >
                  <SheetTitle className="sr-only">Админ цэс</SheetTitle>
                  <SheetDescription className="sr-only">Админ хэсгийн бүх хуудас</SheetDescription>
                  {brand}
                  <div className="min-h-0 flex-1 overflow-y-auto">{navigation}</div>
                  {accountFooter}
                </SheetContent>
              </Sheet>
              <span className="min-w-0 flex-1 truncate text-center text-sm font-semibold">{current?.label ?? "Админ"}</span>
              <Image src="/uudam-logo.jpg" alt="Uudam" width={28} height={28} className="mr-1 rounded-md" />
            </div>
          </div>

          <main id="admin-main" tabIndex={-1} className={cn(styles.content, "mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8")}>
            {children}
          </main>
        </div>
      </div>
    </ConfirmProvider>
  );
}
