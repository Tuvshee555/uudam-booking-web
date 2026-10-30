"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock } from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/app/[locale]/provider/AuthProvider";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Staff sign-in — this User table has no customer rows at all (customers
 * never sign in), so email + password matching a row here is enough; there is
 * no separate role to request.
 */
export default function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { locale } = useI18n();
  const { setAuthToken } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email.trim() || !password) {
      setError("И-мэйл болон нууц үгээ оруулна уу");
      return;
    }
    setError(null);

    setBusy(true);
    try {
      const { data } = await api.post("/users/login", {
        email: email.trim().toLowerCase(),
        password,
      });

      setAuthToken(data.token, data.user?.email);

      // Send the user back where the middleware intercepted them, but only if
      // it was an in-app path — an attacker-supplied absolute URL here would
      // be an open redirect.
      const from = params.get("from");
      const target = from && from.startsWith("/") && !from.startsWith("//")
        ? from
        : `/${locale}/admin`;

      router.replace(target);
    } catch (err) {
      const message = apiErrorMessage(err, "Нэвтрэх боломжгүй");
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/uudam-logo.jpg"
            alt="Uudam Travel Agency"
            width={56}
            height={56}
            className="rounded-xl"
            priority
          />
          <h1 className="mt-4 text-xl font-bold">Удирдлагын хэсэгт нэвтрэх</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Зөвхөн Uudam-ын ажилтнуудад зориулсан
          </p>
        </div>

        <form
          onSubmit={submit}
          noValidate
          className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div>
            <Label htmlFor="email">И-мэйл</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Нууц үг</Label>
              <Link
                href={`/${locale}/admin/forgot-password`}
                className="text-xs font-medium text-primary hover:underline"
              >
                Мартсан уу?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Нууц үгийг нуух" : "Нууц үгийг харуулах"}
                title={showPassword ? "Нууц үгийг нуух" : "Нууц үгийг харуулах"}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Lock className="mr-2 h-4 w-4" />
            )}
            Нэвтрэх
          </Button>
        </form>

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
