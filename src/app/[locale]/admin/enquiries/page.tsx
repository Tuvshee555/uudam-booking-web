import { Suspense } from "react";
import { LoadingRows } from "@/components/admin/ui";
import EnquiriesClient from "./EnquiriesClient";

/**
 * The list keeps its filters in the URL (useSearchParams), which forces a
 * client-side bailout — Next needs a Suspense boundary around it or
 * prerendering fails.
 */
export default function EnquiriesPage() {
  return (
    <Suspense fallback={<LoadingRows rows={8} />}>
      <EnquiriesClient />
    </Suspense>
  );
}
