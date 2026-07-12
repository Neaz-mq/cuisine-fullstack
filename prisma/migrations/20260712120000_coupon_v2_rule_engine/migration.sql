-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENT', 'FIXED');

-- DropForeignKey (v1 single-use link from Coupon -> Order)
ALTER TABLE "Coupon" DROP CONSTRAINT IF EXISTS "Coupon_usedByOrderId_fkey";

-- DropIndex (v1 single-use unique constraint)
DROP INDEX IF EXISTS "Coupon_usedByOrderId_key";

-- AlterTable: Coupon — drop v1 single-use columns, add v2 rule-engine columns
ALTER TABLE "Coupon"
  DROP COLUMN IF EXISTS "usedByOrderId",
  DROP COLUMN IF EXISTS "usedAt",
  ADD COLUMN     "type" "CouponDiscountType" NOT NULL DEFAULT 'PERCENT',
  ADD COLUMN     "fixedOff" DOUBLE PRECISION,
  ADD COLUMN     "maxDiscountAmount" DOUBLE PRECISION,
  ADD COLUMN     "minOrderValue" DOUBLE PRECISION,
  ADD COLUMN     "startsAt" TIMESTAMP(3),
  ADD COLUMN     "expiresAt" TIMESTAMP(3),
  ADD COLUMN     "usageLimit" INTEGER,
  ADD COLUMN     "usageCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN     "perCustomerLimit" INTEGER DEFAULT 1;

ALTER TABLE "Coupon" ALTER COLUMN "percentOff" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Coupon_isActive_idx" ON "Coupon"("isActive");

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerKey" TEXT NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_orderId_key" ON "CouponRedemption"("orderId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_customerKey_idx" ON "CouponRedemption"("couponId", "customerKey");

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
