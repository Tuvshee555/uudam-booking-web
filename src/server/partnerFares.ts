import type { PartnerFare } from "@/lib/tripHealth";

/**
 * Trips priced from a partner company's published table. GTC Mongolia
 * (global-travel.mn) exposes theirs as public JSON; their "adult_price" rows
 * are the Хөтөлбөргүй package and "program_*" the Хөтөлбөртэй one. Hotel names
 * map GTC's spelling to ours. Add a trip here when staff start following
 * another partner table.
 */
export const PARTNER_TRIPS: Array<{
  sourceTripId: string;
  partner: "GTC";
  slug: string;
  hotels: Record<string, string>;
}> = [
  {
    sourceTripId: "trip-poster-5bf8e4a6-55cc-4074-bcbf-669527e2530c",
    partner: "GTC",
    slug: "hainan-aylal",
    hotels: {
      Gentlgrown: "Gentle Crown 4*",
      "Grandmetro park": "Grand Metropark Bay",
      Paxton: "Paxton 4*",
      Phoenix: "Phoenix Island 5*",
      "Phoenix+Paxton": "Phoenix Island + Paxton",
    },
  },
];

type GtcRow = Record<string, string | null> & { departure_date: string; hotel_name: string; deleted_at: string | null };
const amount = (value: string | null | undefined) => {
  const parsed = Number(value);
  return value != null && value !== "" && Number.isFinite(parsed) ? parsed : null;
};

/** GTC's table as our fare rows; unknown hotel names are kept as-is so they surface as missing rows. */
export async function fetchGtcFares(slug: string, hotels: Record<string, string>): Promise<PartnerFare[]> {
  const response = await fetch(`https://api.global-travel.mn/api/tours/${encodeURIComponent(slug)}/price-table`, {
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`GTC ${response.status}`);
  const rows = ((await response.json()) as { data?: GtcRow[] }).data ?? [];
  return rows.filter((row) => !row.deleted_at).flatMap((row) => {
    const hotel = hotels[row.hotel_name] ?? row.hotel_name;
    const shared = { date: row.departure_date, hotel, infant: amount(row.infant_price), single: amount(row.single_supply_price) };
    return [
      { ...shared, packageId: "Хөтөлбөргүй", adult: amount(row.adult_price), child611: amount(row.child_6_11_price), child25: amount(row.child_2_5_price) },
      { ...shared, packageId: "Хөтөлбөртэй", adult: amount(row.program_adult_price), child611: amount(row.program_child_6_11_price), child25: amount(row.program_child_2_5_price) },
    ];
  });
}
