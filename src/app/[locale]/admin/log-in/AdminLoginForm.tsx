"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/app/[locale]/provider/AuthProvider";
import { useI18n } from "@/components/i18n/ClientI18nProvider";

/** What each ?login_error= from /api/admin/google/* means to the person who just tried. */
const LOGIN_ERRORS: Record<string, string> = {
  google_not_configured: "Google нэвтрэлт одоогоор тохируулагдаагүй байна. Хөгжүүлэгчид хандана уу.",
  google_state_mismatch: "Нэвтрэх хугацаа дууссан. Дахин оролдоно уу.",
  google_cancelled: "Нэвтрэлтийг цуцаллаа.",
  google_exchange_failed: "Google-тэй холбогдож чадсангүй. Дахин оролдоно уу.",
  google_token_invalid: "Google-ийн хариу буруу байна. Дахин оролдоно уу.",
  google_email_unverified: "Энэ Google хаяг баталгаажаагүй байна.",
  google_email_not_allowed: "Энэ Google хаягаар нэвтрэх эрхгүй. Зөвшөөрөгдсөн хаягаар нэвтэрнэ үү.",
  google_handoff_missing: "Нэвтрэх хугацаа дууссан. Google-ээр дахин нэвтэрнэ үү.",
  session_expired: "Нэвтрэх хугацаа дууссан. Google-ээр дахин нэвтэрнэ үү.",
};

/** Only an in-app admin path may be the landing spot — an absolute URL here would be an open redirect. */
function safeFrom(from: string | null, locale: string) {
  return from && from.startsWith("/") && !from.startsWith("//") ? from : `/${locale}/admin`;
}

/**
 * Staff sign-in: Google only. The address must be on ADMIN_GOOGLE_EMAILS; there is no password.
 * After Google, the callback lands here with ?google=1 and this page swaps the one-minute
 * hand-off cookie for the session token.
 */
export default function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { locale } = useI18n();
  const { setAuthToken } = useAuth();

  const from = safeFrom(params.get("from"), locale);
  const returning = params.get("google") === "1";
  const loginError = params.get("login_error");

  const [finishing, setFinishing] = useState(returning);
  const [error, setError] = useState<string | null>(loginError ? LOGIN_ERRORS[loginError] ?? "Нэвтэрч чадсангүй." : null);
  const started = useRef(false);

  useEffect(() => {
    if (!returning || started.current) return;
    started.current = true;
    api
      .post("/admin/google/session")
      .then(({ data }) => {
        setAuthToken(data.token, data.email);
        router.replace(from);
      })
      .catch((err) => {
        setError(apiErrorMessage(err, LOGIN_ERRORS.google_handoff_missing));
        setFinishing(false);
      });
  }, [returning, from, router, setAuthToken]);

  const startHref = `/api/admin/google/start?from=${encodeURIComponent(from)}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/uudam-logo.jpg" alt="Uudam Travel Agency" width={56} height={56} className="rounded-xl" priority />
          <h1 className="mt-4 text-xl font-bold">Удирдлагын хэсэгт нэвтрэх</h1>
          <p className="mt-1 text-sm text-muted-foreground">Зөвхөн Uudam-ын ажилтнуудад зориулсан</p>
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          {finishing ? (
            <p className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Нэвтэрч байна…
            </p>
          ) : (
            <a
              href={startHref}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50"
            >
              <GoogleMark />
              Google-ээр нэвтрэх
            </a>
          )}

          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            Зөвхөн зөвшөөрөгдсөн Gmail хаягаар нэвтэрнэ. Нууц үг шаардлагагүй.
          </p>
        </div>

        <Link
          href={`/${locale}`}
          className="mx-auto mt-5 flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Сайт руу буцах
        </Link>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
