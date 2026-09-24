-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "customTripBody" TEXT,
ADD COLUMN     "customTripTitle" TEXT,
ADD COLUMN     "faqs" JSONB,
ADD COLUMN     "giftBody" TEXT,
ADD COLUMN     "giftTitle" TEXT,
ADD COLUMN     "homeCustomCtaBody" TEXT,
ADD COLUMN     "homeCustomCtaTitle" TEXT,
ADD COLUMN     "homeHeroSubtitle" TEXT,
ADD COLUMN     "homeHeroTitle" TEXT,
ADD COLUMN     "homeHeroTitleAccent" TEXT,
ADD COLUMN     "termsSections" JSONB;
