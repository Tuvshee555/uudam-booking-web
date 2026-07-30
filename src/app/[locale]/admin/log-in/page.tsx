import { Suspense } from "react";
import AdminLoginForm from "./AdminLoginForm";

/**
 * The form reads `?from=` via useSearchParams, which forces a client-side
 * bailout — Next requires a Suspense boundary around it or prerendering fails.
 */
export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-secondary/40">
          <div className="h-64 w-full max-w-sm animate-pulse rounded-2xl bg-card" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
