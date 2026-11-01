/** Placeholder while the catalogue's client part reads the URL on first load. */
export default function CatalogSkeleton() {
  return (
    <div className="site-container pb-20 pt-8" aria-busy="true" aria-label="Ачаалж байна">
      <div className="h-14 animate-pulse rounded-full bg-sand" />
      <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-9 lg:grid-cols-3 lg:gap-x-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index}>
            <div className="aspect-[4/5] animate-pulse rounded-lg bg-sand" />
            <div className="mt-4 h-3 w-1/3 animate-pulse rounded bg-sand" />
            <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-sand" />
          </div>
        ))}
      </div>
    </div>
  );
}
