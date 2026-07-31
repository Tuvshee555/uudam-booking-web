-- Fields preserved from the chatbot trip catalogue import.
ALTER TABLE "Trip"
  ADD COLUMN "importantNotes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "sourceTripId" TEXT,
  ADD COLUMN "sourceMetadata" JSONB,
  ADD COLUMN "hotel" TEXT,
  ADD COLUMN "foodIncluded" BOOLEAN,
  ADD COLUMN "departureRule" TEXT,
  ADD COLUMN "extraFees" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "roomPrices" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "childPriceNotes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "brochurePdfUrl" TEXT;

CREATE UNIQUE INDEX "Trip_sourceTripId_key" ON "Trip"("sourceTripId");
CREATE INDEX "Trip_sourceTripId_idx" ON "Trip"("sourceTripId");
