"use client";

import { use } from "react";

import { useI18n } from "@/components/i18n/ClientI18nProvider";
import TripForm from "@/components/admin/trip-form/TripForm";
import { PageHeader } from "@/components/admin/ui";
import { useTrip } from "@/hooks/useTrips";

export default function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { locale } = useI18n();
  // Shares TripForm's cached query, so naming the page costs no extra request.
  const { data: trip } = useTrip(id);

  return (
    <>
      <PageHeader
        back={{ href: `/${locale}/admin/trips`, label: "Аялалууд" }}
        title={trip?.title ?? "Аялал засах"}
        description="Хэсэг бүрийг дээд талын табаар сонгоно. Өөрчлөлт доод талын «Хадгалах» дарсны дараа сайтад гарна."
      />
      {/* key forces a fresh TripForm instance per trip id — without it, navigating
          directly between two trips' edit URLs would reuse the same instance and
          the one-time hydration guard would keep showing the first trip's data. */}
      <TripForm key={id} mode="edit" tripId={id} />
    </>
  );
}
