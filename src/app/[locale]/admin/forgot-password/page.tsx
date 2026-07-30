"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail } from "lucide-react";

import { api, apiErrorMessage } from "@/lib/api";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const { locale } = useI18n();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      toast.error("И-мэйлээ оруулна уу");
      return;
    }

    setBusy(true);
    try {
      await api.post("/users/forgot-password", { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Илгээхэд алдаа гарлаа"));
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
          <h1 className="mt-4 text-xl font-bold">Нууц үг сэргээх</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Бүртгэлтэй и-мэйлээ оруулбал сэргээх холбоос илгээнэ
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {sent ? (
            <div className="text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Хэрэв ийм бүртгэл байгаа бол сэргээх холбоос таны и-мэйлд илгээгдлээ.
                Холбоос 15 минутын дараа хүчингүй болно.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="email">И-мэйл</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoFocus
                />
              </div>

              <Button type="submit" disabled={busy} className="w-full">
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Холбоос илгээх
              </Button>
            </form>
          )}
        </div>

        <Link
          href={`/${locale}/admin/log-in`}
          className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Нэвтрэх хуудас руу буцах
        </Link>
      </div>
    </div>
  );
}
