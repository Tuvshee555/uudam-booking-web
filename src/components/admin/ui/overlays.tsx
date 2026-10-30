"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, HelpCircle, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title: string;
  /** What will happen, in plain words — the reason this dialog exists. */
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  /** Just a message with one button — for explaining why something can't be done. */
  infoOnly?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * One styled confirmation dialog for the whole admin, replacing the browser's
 * bare confirm() box. `await confirm({...})` resolves true only when the
 * person presses the confirm button; Escape, the backdrop and "Болих" all
 * resolve false. Focus starts on "Болих", so a stray Enter never deletes.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Kept after closing so the text doesn't vanish mid-animation.
  const [options, setOptions] = useState<ConfirmOptions>({ title: "" });
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    resolver.current?.(false);
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function settle(ok: boolean) {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(false);
  }

  const danger = options.tone === "danger";
  const Icon = danger ? AlertTriangle : options.infoOnly ? Info : HelpCircle;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={open} onOpenChange={(next) => !next && settle(false)}>
        <DialogContent className="max-w-md gap-5">
          <DialogHeader className="flex-row items-start gap-3 space-y-0 text-left">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                danger ? "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-300" : "bg-primary/10 text-primary",
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 space-y-1.5 pr-6">
              <DialogTitle className="text-base leading-snug">{options.title}</DialogTitle>
              {options.description ? (
                <DialogDescription className="leading-relaxed">{options.description}</DialogDescription>
              ) : (
                <DialogDescription className="sr-only">{options.title}</DialogDescription>
              )}
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:space-x-0">
            {options.infoOnly ? (
              <Button onClick={() => settle(false)}>{options.confirmLabel ?? "Ойлголоо"}</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => settle(false)}>
                  {options.cancelLabel ?? "Болих"}
                </Button>
                <Button variant={danger ? "destructive" : "default"} onClick={() => settle(true)}>
                  {options.confirmLabel ?? "Тийм"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

/** Ask before doing something that is hard to undo. Falls back to the browser box outside the admin shell. */
export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext);
  return (
    context ??
    (async (options: ConfirmOptions) =>
      window.confirm(typeof options.description === "string" ? `${options.title}\n\n${options.description}` : options.title))
  );
}

/**
 * A panel that slides in from the right to show one record in full without
 * leaving the list behind it. Full width on phones.
 */
export function SidePanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn("flex w-full flex-col gap-0 p-0 sm:max-w-xl", className)}
        aria-describedby={undefined}
      >
        <div className="border-b border-border px-5 py-4 pr-12">
          <SheetTitle className="text-lg font-bold leading-snug">{title}</SheetTitle>
          {description && <SheetDescription className="mt-1">{description}</SheetDescription>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="border-t border-border bg-card px-5 py-3">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}
