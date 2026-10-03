-- Allow trips to appear under multiple storefront categories while keeping
-- Trip.categoryId as the primary/backwards-compatible category.
CREATE TABLE "_TripCategories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

INSERT INTO "_TripCategories" ("A", "B")
SELECT "categoryId", id
FROM "Trip"
WHERE "categoryId" IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX "_TripCategories_AB_unique" ON "_TripCategories"("A", "B");
CREATE INDEX "_TripCategories_B_index" ON "_TripCategories"("B");

ALTER TABLE "_TripCategories" ADD CONSTRAINT "_TripCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_TripCategories" ADD CONSTRAINT "_TripCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
