import { Suspense } from "react";
import EnquiriesClient from "./EnquiriesClient";

/**
 * The list reads `?status=` via useSearchParams, which forces a client-side
 * bailout — Next needs a Suspense boundary around it or prerendering fails.
 */
export default function EnquiriesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-secondary/30 p-8">
          <div className="mx-auto h-40 max-w-7xl animate-pulse rounded-2xl bg-card" />
        </div>
      }
    >
      <EnquiriesClient />
    </Suspense>
  );
}
