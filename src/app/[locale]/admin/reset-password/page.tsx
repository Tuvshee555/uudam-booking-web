"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { Check, Loader2, Lock } from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { locale } = useI18n();

  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!token) {
      toast.error("Холбоос хүчингүй байна");
      return;
    }
    if (password.length < 8) {
      toast.error("Нууц үг дор хаяж 8 тэмдэгт байна");
      return;
    }
    if (password !== confirm) {
      toast.error("Нууц үг таарахгүй байна");
      return;
    }

    setBusy(true);
    try {
      await api.post("/users/reset-password", { token, newPassword: password });
      setDone(true);
      setTimeout(() => router.push(`/${locale}/admin/log-in`), 2000);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Сэргээхэд алдаа гарлаа"));
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
          <h1 className="mt-4 text-xl font-bold">Шинэ нууц үг</h1>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {!token ? (
            <div className="text-center text-sm text-muted-foreground">
              Холбоос хүчингүй байна.{" "}
              <Link href={`/${locale}/admin/forgot-password`} className="text-primary hover:underline">
                Дахин илгээх
              </Link>
            </div>
          ) : done ? (
            <div className="text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                <Check className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm text-muted-foreground">
                Нууц үг солигдлоо. Нэвтрэх хуудас руу шилжиж байна…
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="new-password">Шинэ нууц үг</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="confirm-password">Нууц үг давтах</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </div>

              <Button type="submit" disabled={busy} className="w-full">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                Нууц үг солих
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
