"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";

// Pages a staff member reaches before they're authenticated — these render
// their own centered card and must never carry the sidebar/nav.
const UNSHELLED_SUFFIXES = ["/admin/log-in", "/admin/forgot-password", "/admin/reset-password"];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const unshelled = UNSHELLED_SUFFIXES.some((suffix) => pathname?.endsWith(suffix));

  if (unshelled) return <>{children}</>;

  return <AdminShell>{children}</AdminShell>;
}
