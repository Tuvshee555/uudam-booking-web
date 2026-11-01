"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Facebook, Instagram, Link2, Mail, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

type Target = "copy" | "facebook" | "messenger" | "instagram" | "gmail";

const MENU_HEIGHT = 220;

const isPhone = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/**
 * The agency sells in Facebook Messenger, so a shared trip link is the single
 * most common way a customer meets this page. The operating system's share
 * sheet listed a dozen apps nobody here uses; this menu offers the five the
 * agency's customers actually use. Messenger (on a computer) and Instagram
 * can't receive a link from a web page, so for those the link is copied and
 * the app opened, ready to paste.
 */
export default function ShareButton({
  title,
  tripId,
  className,
}: {
  title: string;
  tripId?: string;
  className?: string;
}) {
  // Where the menu sits on screen; null while closed. It is drawn in a portal
  // with fixed coordinates because the sticky section tabs and the site header
  // below/above the button would otherwise paint over it.
  const [anchor, setAnchor] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = anchor !== null;
  const placeMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const right = Math.max(8, window.innerWidth - rect.right);
    // Open upwards when the button sits too low for the menu to fit below it.
    return rect.bottom + MENU_HEIGHT + 16 > window.innerHeight
      ? { bottom: window.innerHeight - rect.top + 8, right }
      : { top: rect.bottom + 8, right };
  };
  const setOpen = (value: boolean) => setAnchor(value ? placeMenu() : null);

  useEffect(() => {
    if (!open) return;
    const close = () => setAnchor(null);
    // Follow the button instead of closing: phones fire scroll/resize when the
    // address bar slides away, which would otherwise shut the menu at once.
    const follow = () => setAnchor(placeMenu());
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", follow, { passive: true });
    window.addEventListener("resize", follow);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", follow);
      window.removeEventListener("resize", follow);
    };
  }, [open]);

  const copy = async (message = "Холбоос хуулагдлаа") => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success(message);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      toast.error("Холбоос хуулж чадсангүй");
      return false;
    }
  };

  const shareTo = async (target: Target) => {
    const url = window.location.href;
    const link = encodeURIComponent(url);
    track("share_click", { tripId, properties: { method: target } });
    setOpen(false);

    switch (target) {
      case "copy":
        await copy();
        return;
      case "facebook":
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${link}`, "_blank", "noopener,width=640,height=560");
        return;
      case "messenger":
        if (isPhone()) {
          window.location.assign(`fb-messenger://share/?link=${link}`);
          return;
        }
        if (await copy("Холбоос хуулагдлаа — Messenger дээр буулгаад илгээнэ үү")) {
          window.open("https://www.messenger.com/", "_blank", "noopener");
        }
        return;
      case "instagram":
        if (await copy("Холбоос хуулагдлаа — Instagram дээр буулгаад илгээнэ үү")) {
          window.open("https://www.instagram.com/direct/inbox/", "_blank", "noopener");
        }
        return;
      case "gmail": {
        const subject = encodeURIComponent(title);
        const body = encodeURIComponent(`${title}\n${url}`);
        if (isPhone()) {
          window.location.assign(`mailto:?subject=${subject}&body=${body}`);
          return;
        }
        window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`, "_blank", "noopener");
        return;
      }
    }
  };

  const options: { target: Target; label: string; icon: React.ReactNode }[] = [
    { target: "copy", label: "Холбоос хуулах", icon: <Link2 className="h-4 w-4 text-muted-foreground" /> },
    { target: "facebook", label: "Facebook", icon: <Facebook className="h-4 w-4 text-[#1877F2]" /> },
    { target: "messenger", label: "Messenger", icon: <MessageCircle className="h-4 w-4 text-[#0084FF]" /> },
    { target: "instagram", label: "Instagram", icon: <Instagram className="h-4 w-4 text-[#E1306C]" /> },
    { target: "gmail", label: "Gmail", icon: <Mail className="h-4 w-4 text-[#EA4335]" /> },
  ];

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Аяллыг хуваалцах"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:border-primary hover:text-primary",
          className,
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
        Хуваалцах
      </button>

      {anchor && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label="Хуваалцах"
          style={anchor}
          className="fixed z-[70] w-52 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg"
        >
          {options.map((option) => (
            <button
              key={option.target}
              type="button"
              role="menuitem"
              onClick={() => shareTo(option.target)}
              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm font-medium transition-colors hover:bg-secondary"
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
