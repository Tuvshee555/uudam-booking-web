-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "homeHeroBadge" TEXT,
ADD COLUMN     "homeHeroEyebrow" TEXT,
ADD COLUMN     "homeHeroPrimaryCta" TEXT,
ADD COLUMN     "homeHeroSecondaryCta" TEXT,
ADD COLUMN     "trustFacts" JSONB,
ADD COLUMN     "trustPhoneText" TEXT;
