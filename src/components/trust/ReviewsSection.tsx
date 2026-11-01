import Link from "next/link";
import { Star } from "lucide-react";

import SectionHeading from "@/components/site/SectionHeading";
import { getPublishedTestimonials } from "@/server/catalog";
import { canonicalPath } from "@/lib/locales";

function formatTravelDate(value: string | null) {
  if (!value) return null;
  const [year, month] = value.slice(0, 7).split("-").map(Number);
  return `${year} оны ${month}-р сар`;
}

/**
 * Traveler reviews, mixed across trips. Staff-entered — there are no
 * customer accounts, so these are collected the way the agency collects
 * everything else, by phone/Messenger after a trip, not submitted
 * self-service. Renders nothing at all when there are none yet, rather than
 * an empty "Reviews" heading over a blank space.
 */
export default async function ReviewsSection() {
  const reviews = await getPublishedTestimonials();

  if (reviews.length === 0) return null;

  return (
    <section aria-labelledby="reviews-title" className="site-container pt-20 lg:pt-28">
      <SectionHeading id="reviews-title" eyebrow="Сэтгэгдэл" title="Аялагчдын сэтгэгдэл" />
      <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review) => {
          const dateLabel = formatTravelDate(review.travelDate);
          return (
            <li key={review.id}>
              <figure className="flex h-full flex-col rounded-xl border border-border bg-card p-7">
                <div className="flex items-center gap-0.5" aria-label={`${review.rating}/5 үнэлгээ`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} aria-hidden="true" className={i < review.rating ? "h-4 w-4 fill-gold text-gold" : "h-4 w-4 text-muted-foreground/30"} />
                  ))}
                </div>
                <blockquote className="mt-5 flex-1 font-display text-[1.2rem] leading-relaxed text-foreground">&ldquo;{review.comment}&rdquo;</blockquote>
                <figcaption className="mt-6 text-sm">
                  <span className="font-semibold text-foreground">{review.authorName}</span>
                  {(review.trip || dateLabel) && (
                    <span className="mt-1 block text-[13px] text-muted-foreground">
                      {review.trip ? (
                        <Link href={canonicalPath(`/trips/${review.trip.slug}`)} className="link-draw hover:text-foreground">
                          {review.trip.title}
                        </Link>
                      ) : null}
                      {review.trip && dateLabel ? " · " : ""}
                      {dateLabel}
                    </span>
                  )}
                </figcaption>
              </figure>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
