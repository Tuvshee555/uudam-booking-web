"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export type PageSection = { id: string; label: string };

/** Header (76px) plus this bar (48px) plus a little air. */
const READING_LINE = 160;

/**
 * In-page tabs under the header, following the section being read: the last
 * section whose top has passed the reading line, or the first one while the
 * page is still above it.
 */
export default function SectionNav({ sections }: { sections: PageSection[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = sections[0]?.id;
      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= READING_LINE) current = section.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [sections]);

  if (sections.length < 2) return null;

  return (
    <nav aria-label="Хуудасны хэсгүүд" data-print="hide" className="sticky top-16 z-30 border-b border-border bg-background/95 backdrop-blur-md lg:top-[76px]">
      <div className="site-container">
        <ul className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto">
          {sections.map((section) => (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                aria-current={active === section.id ? "location" : undefined}
                className={cn(
                  "relative inline-flex h-12 items-center whitespace-nowrap px-3 text-[13.5px] font-semibold transition-colors focus-ring",
                  active === section.id
                    ? "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:bg-gold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
