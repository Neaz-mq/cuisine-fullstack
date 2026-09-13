-- TransactionMethod: Payment/Shipping Summary কার্ডের "Add Method"।
--
-- ⚠️ PaymentMethod / ShippingMethod enum-এর বিকল্প নয় — বিস্তারিত
--    schema.prisma-র মন্তব্যে।

CREATE TYPE "TransactionMethodKind" AS ENUM ('PAYMENT', 'SHIPPING');

CREATE TABLE "TransactionMethod" (
    "id" TEXT NOT NULL,
    "kind" "TransactionMethodKind" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionMethod_pkey" PRIMARY KEY ("id")
);

-- একই ধরনে একই নাম দুবার নয়।
CREATE UNIQUE INDEX "TransactionMethod_kind_name_key" ON "TransactionMethod"("kind", "name");

CREATE INDEX "TransactionMethod_kind_createdAt_idx" ON "TransactionMethod"("kind", "createdAt");
