import type { Metadata } from "next";

import TripsPageClient from "./TripsPageClient";

export const metadata: Metadata = {
  title: "Бүх аялал",
  description:
    "Uudam Travel-ийн бүх аяллын багц нэг дороос. Чиглэл, үнэ, хугацаагаар шүүж өөрт тохирох аялалаа олоорой.",
  openGraph: {
    title: "Бүх аялал · Uudam Travel",
    description: "Чиглэл, үнэ, хугацаагаар шүүж өөрт тохирох аялалаа олоорой.",
    type: "website",
  },
};

export default function TripsPage() {
  return <TripsPageClient />;
}
