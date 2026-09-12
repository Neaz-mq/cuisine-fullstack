-- OrderReview: অর্ডার শেষে গ্রাহকের "How Was Your Food Experience?"
--
-- ⚠️ এটা Review টেবিলের নকল নয় — ওটা পদের রেটিং (rating + userId
--    বাধ্যতামূলক), এটা পুরো অর্ডারের অভিজ্ঞতা আর অতিথি অর্ডারেও চলে।
--    বিস্তারিত schema.prisma-র মন্তব্যে।

CREATE TABLE "OrderReview" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT,
    "authorName" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderReview_pkey" PRIMARY KEY ("id")
);

-- এক অর্ডারে একটাই রিভিউ — দ্বিতীয়বার submit করলে upsert আগেরটাই বদলায়।
CREATE UNIQUE INDEX "OrderReview_orderId_key" ON "OrderReview"("orderId");

CREATE INDEX "OrderReview_status_createdAt_idx" ON "OrderReview"("status", "createdAt");
CREATE INDEX "OrderReview_userId_idx" ON "OrderReview"("userId");

ALTER TABLE "OrderReview" ADD CONSTRAINT "OrderReview_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ⚠️ SET NULL, CASCADE নয়: অ্যাকাউন্ট মুছে গেলে রিভিউটা রেস্তোরাঁর
--    রেকর্ডে থেকে যায়, শুধু ব্যক্তির সাথে সংযোগটা কাটে।
ALTER TABLE "OrderReview" ADD CONSTRAINT "OrderReview_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
