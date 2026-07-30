"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { useI18n } from "@/components/i18n/ClientI18nProvider";
import AdminShell from "@/components/admin/AdminShell";
import TripForm from "@/components/admin/trip-form/TripForm";

export default function NewTripPage() {
  const { locale } = useI18n();

  return (
    <AdminShell>
      <Link
        href={`/${locale}/admin/trips`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Аялалууд руу буцах
      </Link>
      <h1 className="mb-5 text-2xl font-bold">Шинэ аялал</h1>
      <TripForm mode="create" />
    </AdminShell>
  );
}
