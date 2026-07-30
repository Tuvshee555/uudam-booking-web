"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { useI18n } from "@/components/i18n/ClientI18nProvider";
import AdminShell from "@/components/admin/AdminShell";
import TripForm from "@/components/admin/trip-form/TripForm";

export default function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
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
      <h1 className="mb-5 text-2xl font-bold">Аялал засах</h1>
      {/* key forces a fresh TripForm instance per trip id — without it, navigating
          directly between two trips' edit URLs would reuse the same instance and
          the one-time hydration guard would keep showing the first trip's data. */}
      <TripForm key={id} mode="edit" tripId={id} />
    </AdminShell>
  );
}
