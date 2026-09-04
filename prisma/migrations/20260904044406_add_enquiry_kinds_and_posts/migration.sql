-- CreateEnum
CREATE TYPE "EnquiryKind" AS ENUM ('TRIP', 'CUSTOM', 'GIFT');

-- AlterTable
ALTER TABLE "Enquiry" ADD COLUMN     "budgetPerPerson" DOUBLE PRECISION,
ADD COLUMN     "destination" TEXT,
ADD COLUMN     "giftAmount" DOUBLE PRECISION,
ADD COLUMN     "giftRecipient" TEXT,
ADD COLUMN     "kind" "EnquiryKind" NOT NULL DEFAULT 'TRIP',
ADD COLUMN     "preferredDates" TEXT;

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,
    "coverImage" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");

-- CreateIndex
CREATE INDEX "Post_isPublished_publishedAt_idx" ON "Post"("isPublished", "publishedAt");
