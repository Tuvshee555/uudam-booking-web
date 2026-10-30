import { Suspense } from "react";
import { LoadingRows } from "@/components/admin/ui";
import TripsClient from "./TripsClient";

/** Filters live in the URL (useSearchParams), so the client needs a Suspense boundary to prerender. */
export default function AdminTripsPage() {
  return (
    <Suspense fallback={<LoadingRows rows={8} rowClassName="h-16" />}>
      <TripsClient />
    </Suspense>
  );
}
