/**
 * Structured data for search engines. It used to go through `next/script`,
 * which injects the tag in the browser after hydration, so a crawler that
 * doesn't run JavaScript got a page with no business or trip data at all. A
 * plain `<script>` in a server component is part of the first HTML response.
 *
 * `<` is escaped so a trip title or description containing "</script>" can't
 * close the tag early.
 */
export default function JsonLd({ id, data }: { id: string; data: unknown }) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
