import Link from "next/link";
import { Star } from "lucide-react";

import { getPublishedTestimonials } from "@/server/catalog";

function formatTravelDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("mn-MN", { year: "numeric", month: "long" });
}

/**
 * Traveler reviews, mixed across trips. Staff-entered — there are no
 * customer accounts, so these are collected the way the agency collects
 * everything else, by phone/Messenger after a trip, not submitted
 * self-service. Renders nothing at all when there are none yet, rather than
 * an empty "Reviews" heading over a blank space.
 */
export default async function ReviewsSection({ locale }: { locale: string }) {
  const reviews = await getPublishedTestimonials();

  if (reviews.length === 0) return null;

  return (
    <section className="uudam-container py-14">
      <span className="uudam-eyebrow text-primary">Сэтгэгдэл</span>
      <h2 className="mt-1 text-2xl font-bold md:text-3xl">Аялагчдын сэтгэгдэл</h2>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review) => {
          const dateLabel = formatTravelDate(review.travelDate);
          const context = [review.trip?.title, dateLabel].filter(Boolean).join(" · ");

          const card = (
            <div className="flex h-full flex-col rounded-2xl border border-border p-5">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={
                      i < review.rating
                        ? "h-3.5 w-3.5 fill-gold text-gold"
                        : "h-3.5 w-3.5 text-muted-foreground/30"
                    }
                  />
                ))}
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                &ldquo;{review.comment}&rdquo;
              </p>
              <div className="mt-4 text-sm font-semibold">{review.authorName}</div>
              {context && <div className="text-xs text-muted-foreground">{context}</div>}
            </div>
          );

          return review.trip ? (
            <Link
              key={review.id}
              href={`/${locale}/trips/${review.trip.slug}`}
              className="transition-opacity hover:opacity-80"
            >
              {card}
            </Link>
          ) : (
            <div key={review.id}>{card}</div>
          );
        })}
      </div>
    </section>
  );
}
