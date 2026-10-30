"use client";

import { useI18n } from "@/components/i18n/ClientI18nProvider";
import TripForm from "@/components/admin/trip-form/TripForm";
import { PageHeader } from "@/components/admin/ui";

export default function NewTripPage() {
  const { locale } = useI18n();

  return (
    <>
      <PageHeader
        back={{ href: `/${locale}/admin/trips`, label: "Аялалууд" }}
        title="Шинэ аялал нэмэх"
        description="Аяллын нэр, үнэ, үндсэн зургийг заавал оруулна. Бусдыг дараа нь нэмж болно. «Аялал үүсгэх» дарсны дараа үргэлжлүүлэн засах боломжтой."
      />
      <TripForm mode="create" />
    </>
  );
}
