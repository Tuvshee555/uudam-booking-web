-- The phone numbers become an admin setting (2026-11-22). Additive and nullable: old code keeps working.
ALTER TABLE "SiteSettings" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "SiteSettings" ADD COLUMN "contactOtherPhones" JSONB;
