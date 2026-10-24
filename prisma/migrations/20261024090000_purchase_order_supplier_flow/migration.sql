-- Supplier restock flow:
--   ORDERED (Pending) -> supplier accepts -> ON_THE_WAY -> admin confirms -> RECEIVED (Delivered)

-- AlterEnum
ALTER TYPE "PurchaseOrderStatus" ADD VALUE 'ON_THE_WAY';

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "supplierEmailedAt" TIMESTAMP(3);
