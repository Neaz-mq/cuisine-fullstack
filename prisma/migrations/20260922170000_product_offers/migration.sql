-- Product offers (/admin/offers): a price cut on one dish for a time window.

-- CreateEnum
CREATE TYPE "OfferAudience" AS ENUM ('ALL', 'MEMBERS');

-- CreateTable
CREATE TABLE "ProductOffer" (
    "id" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "type" "CouponDiscountType" NOT NULL DEFAULT 'PERCENT',
    "percentOff" INTEGER,
    "fixedOff" DECIMAL(12,3),
    "audience" "OfferAudience" NOT NULL DEFAULT 'ALL',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOffer_pkey" PRIMARY KEY ("id")
);

-- AlterTable: remember the offer on each order line it discounted.
ALTER TABLE "OrderItem" ADD COLUMN "originalPrice" DECIMAL(12,3),
ADD COLUMN "offerId" TEXT;

-- CreateIndex
CREATE INDEX "ProductOffer_menuItemId_idx" ON "ProductOffer"("menuItemId");

-- CreateIndex
CREATE INDEX "ProductOffer_startsAt_endsAt_idx" ON "ProductOffer"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "OrderItem_offerId_idx" ON "OrderItem"("offerId");

-- AddForeignKey
ALTER TABLE "ProductOffer" ADD CONSTRAINT "ProductOffer_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "ProductOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
