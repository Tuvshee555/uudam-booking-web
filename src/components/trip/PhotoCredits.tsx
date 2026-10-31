import { photoCreditsFor } from "@/lib/photoCredits";
import type { Trip } from "@/types/trip";

/**
 * "Зургийн эх сурвалж": author, license and source for the licensed photos on
 * this page, as CC BY / CC BY-SA require. Renders nothing when none are used.
 */
export default function PhotoCredits({ trip }: { trip: Trip }) {
  const credits = photoCreditsFor(trip);
  if (!credits.length) return null;
  return (
    <section aria-labelledby="photo-credits-heading" className="mt-10 border-t border-border pt-5 text-xs text-muted-foreground" data-print="hide">
      <h2 id="photo-credits-heading" className="text-[13px] font-semibold text-foreground">Зургийн эх сурвалж</h2>
      <ul className="mt-2 space-y-1">
        {credits.map((credit) => (
          <li key={credit.src} className="break-words">
            {credit.subject}
            {credit.author && <> — {credit.author}</>}
            {", "}
            {credit.licenseUrl ? (
              <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer license" className="underline underline-offset-2 hover:text-foreground">{credit.license}</a>
            ) : credit.license}
            {", "}
            {credit.page ? (
              <a href={credit.page} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">{credit.provider}</a>
            ) : credit.provider}
          </li>
        ))}
      </ul>
    </section>
  );
}
