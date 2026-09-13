-- TransactionMethod এখন "কী দেখানো হবে"-র সেটিং, "কী কী আছে"-র তালিকা নয়।
--
-- ⚠️ টেবিলটা নতুন করে বানানো হচ্ছে, ALTER নয়। আগের আকৃতিতে কেবল একটা
--    `name` কলাম ছিল আর সেখানে হাতে লেখা নাম জমত — সেগুলোর কোনোটাই
--    checkout-এ কখনো ব্যবহার হয়নি, তাই রক্ষা করার মতো তথ্য নেই।

DROP TABLE IF EXISTS "TransactionMethod";

DO $$ BEGIN
  CREATE TYPE "TransactionMethodKind" AS ENUM ('PAYMENT', 'SHIPPING');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "TransactionMethod" (
    "id" TEXT NOT NULL,
    "kind" "TransactionMethodKind" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionMethod_pkey" PRIMARY KEY ("id")
);

-- এক ধরনে এক কোড একবারই।
CREATE UNIQUE INDEX "TransactionMethod_kind_code_key" ON "TransactionMethod"("kind", "code");

-- ⚠️ কোনো seed সারি বসানো হচ্ছে না, ইচ্ছাকৃতভাবে। সারি না থাকলে
--    src/lib/transaction-methods.ts-এর ডিফল্টই চলে, তাই খালি টেবিল মানেই
--    "সব মাধ্যম চালু, কোডের নামেই" — যা নতুন ইনস্টলে ঠিক যা দরকার।
