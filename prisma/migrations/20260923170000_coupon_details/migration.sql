-- Coupons (/admin/coupons): card text, "Applies To", and free-delivery coupons.
-- Only additions — nothing existing is changed or removed.

-- AlterEnum
ALTER TYPE "CouponDiscountType" ADD VALUE 'FREE_DELIVERY';

-- CreateEnum
CREATE TYPE "CouponAudience" AS ENUM ('ALL', 'NEW_CUSTOMERS', 'MEMBERS');

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN "label" TEXT,
ADD COLUMN "headline" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "audience" "CouponAudience" NOT NULL DEFAULT 'ALL';
