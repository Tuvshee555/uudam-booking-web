-- A sale price and an "Онцлох" flag on ONE departure date (2026-11-22). Additive: old code keeps working,
-- and the chatbot's sync never writes these columns, so staff choices survive every resync.
ALTER TABLE "Departure" ADD COLUMN IF NOT EXISTS "salePrice" DOUBLE PRECISION;
ALTER TABLE "Departure" ADD COLUMN IF NOT EXISTS "saleChildPrice" DOUBLE PRECISION;
ALTER TABLE "Departure" ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false;
