import { Suspense } from "react";
import { LoadingRows } from "@/components/admin/ui";
import BookingsClient from "./BookingsClient";

/** Filters live in the URL (useSearchParams), so the client needs a Suspense boundary to prerender. */
export default function AdminBookingsPage() {
  return (
    <Suspense fallback={<LoadingRows rows={6} rowClassName="h-24" />}>
      <BookingsClient />
    </Suspense>
  );
}
