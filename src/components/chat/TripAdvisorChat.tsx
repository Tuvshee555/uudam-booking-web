"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bot, Loader2, MessageCircle, MessageSquareText, Send, X } from "lucide-react";

import { api } from "@/lib/api";
import { CONTACT, hasLink } from "@/lib/contact";
import { track } from "@/lib/analytics";
import { formatMnt } from "@/lib/pricing";
import { useI18n } from "@/components/i18n/ClientI18nProvider";
import { isAllowedImageHost } from "@/lib/imageHosts";
import { cn } from "@/lib/utils";

type ChatItem = {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  durationDays: number;
  country: string | null;
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  items?: ChatItem[];
};

const SUGGESTIONS = ["Азийн 5 хоногийн аялал", "Гэр бүлээрээ явах", "1 сая хүртэлх үнэтэй"];

const GREETING: ChatMessage = {
  role: "assistant",
  text: "Сайн байна уу! Ямар чиглэлийн, ямар төсвийн аялал хайж байгаагаа хэлээрэй, би багцаас тохирохыг санал болгоё.",
};

/**
 * Floating widget for the trip-advisor backend (/api/ai/chat). The API was
 * fully built — catalog search plus an optional Gemini rephrase — but had no
 * customer-facing surface at all before this.
 */
export default function TripAdvisorChat() {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || sending) return;

    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setSending(true);

    try {
      const { data } = await api.post("/ai/chat", { message: question, history });
      setMessages((prev) => [...prev, { role: "assistant", text: data.reply, items: data.items }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Уучлаарай, одоо хариулж чадсангүй. Утсаар холбогдвол илүү хурдан туслах болно.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open && (
        <div className="mb-3 flex h-[min(560px,70vh)] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-foreground">Аяллын зөвлөх</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Хаах"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground",
                  )}
                >
                  <p className="whitespace-pre-line">{m.text}</p>

                  {m.items && m.items.length > 0 && (
                    <div className="mt-2.5 space-y-2">
                      {m.items.map((item) => (
                        <Link
                          key={item.id}
                          href={`/${locale}/trips/${item.slug}`}
                          className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2 transition-colors hover:border-primary/40"
                        >
                          <div className="relative h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-secondary">
                            {item.image && isAllowedImageHost(item.image) && (
                              <Image src={item.image} alt={item.name} fill sizes="56px" className="object-cover" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-foreground">{item.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {item.durationDays} хоног · {formatMnt(item.price)}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-secondary px-3.5 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Бодож байна…
                </div>
              </div>
            )}

            {messages.length === 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {hasLink(CONTACT.messenger) && (
            <a
              href={CONTACT.messenger}
              target="_blank"
              rel="noreferrer"
              onClick={() => track("messenger_click")}
              className="flex items-center justify-center gap-2 border-t border-border bg-secondary/50 px-4 py-2.5 text-xs font-semibold text-primary hover:bg-secondary"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Ажилтантай шууд чатлах
            </a>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-border p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Асуултаа бичнэ үү…"
              className="h-10 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
              aria-label="Илгээх"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gold text-navy-deep shadow-lg transition-transform hover:scale-105"
        aria-label={open ? "Зөвлөхийг хаах" : "Аяллын зөвлөхтэй ярих"}
      >
        {open ? <X className="h-6 w-6" /> : <MessageSquareText className="h-6 w-6" />}
      </button>
    </div>
  );
}
