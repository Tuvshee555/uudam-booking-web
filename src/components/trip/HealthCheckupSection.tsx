"use client";

import { useState } from "react";
import { Check, Gift, Info, Stethoscope } from "lucide-react";

import { checkupItemCount, type CheckupList } from "@/lib/healthCheckup";

function Note({ text }: { text: string }) {
  const Icon = /бэлэг|бэлгэн/i.test(text) ? Gift : Info;
  return (
    <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {text}
    </p>
  );
}

/**
 * "Эрүүл мэндийн шинжилгээ": the clinic's test list as grouped cards, with a
 * switch when the clinic lists men and women separately. Text that did not
 * parse into a list (src/lib/healthCheckup.ts) is shown as it was written.
 */
export default function HealthCheckupSection({ lists, fallbackText }: { lists: CheckupList[]; fallbackText?: string }) {
  const [active, setActive] = useState(0);
  const list = lists[Math.min(active, lists.length - 1)];
  if (!list && !fallbackText?.trim()) return null;

  return (
    <section id="checkup" className="mt-8 scroll-mt-28 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Stethoscope className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold leading-tight">Эрүүл мэндийн шинжилгээ</h2>
            {list && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {checkupItemCount(list)} төрлийн үзлэг, шинжилгээ
              </p>
            )}
          </div>
        </div>

        {lists.length > 1 && (
          <div role="tablist" aria-label="Хэнд зориулсан жагсаалт" className="inline-flex rounded-full border border-border bg-background p-1">
            {lists.map((entry, index) => (
              <button
                key={entry.title}
                type="button"
                role="tab"
                aria-selected={index === active}
                onClick={() => setActive(index)}
                className={
                  "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors " +
                  (index === active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
                }
              >
                {entry.audience}
                <span className={"ml-1.5 text-xs font-medium " + (index === active ? "opacity-80" : "opacity-60")}>
                  {checkupItemCount(entry)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {list ? (
        <div role={lists.length > 1 ? "tabpanel" : undefined} className="mt-5 gap-3 sm:columns-2">
          {list.groups.map((group, index) => (
            <div key={`${group.title}-${index}`} className="mb-3 break-inside-avoid rounded-xl border border-border bg-background p-4">
              {group.items.length > 0 && (
                <>
                  {group.title && (
                    <h3 className="flex items-baseline justify-between gap-2 text-sm font-bold text-primary">
                      {group.title}
                      <span className="text-xs font-medium text-muted-foreground">{group.items.length}</span>
                    </h3>
                  )}
                  <ul className={(group.title ? "mt-2.5 " : "") + "space-y-2"}>
                    {group.items.map((item, itemIndex) => (
                      <li key={`${item.label}-${itemIndex}`} className="flex items-start gap-2 text-sm leading-snug">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>
                          {item.label}
                          {item.detail && <span className="mt-0.5 block text-xs text-muted-foreground">{item.detail}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {group.notes.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {group.notes.map((note) => <Note key={note} text={note} />)}
                </div>
              )}
            </div>
          ))}
          {list.notes.length > 0 && (
            <div className="mb-3 break-inside-avoid space-y-1.5">
              {list.notes.map((note) => <Note key={note} text={note} />)}
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed">{fallbackText}</p>
      )}
    </section>
  );
}
