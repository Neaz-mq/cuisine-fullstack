-- Reservation-এর অগ্রিম (Figma-র "Advance Payment")।

ALTER TABLE "Reservation"
  ADD COLUMN "depositAmount"   DECIMAL(12,3),
  ADD COLUMN "depositPaidAt"   TIMESTAMP(3),
  ADD COLUMN "stripeSessionId" TEXT;

-- ⚠️ UNIQUE, আর এটাই webhook-এর idempotency-র ভিত্তি: Stripe একই event
-- একাধিকবার পাঠায়, আর একই session দুবার এলে দ্বিতীয়বার কিছু ঘটা উচিত
-- নয়। GiftCard.stripeSessionId-এও হুবহু একই constraint।
CREATE UNIQUE INDEX "Reservation_stripeSessionId_key"
  ON "Reservation"("stripeSessionId");

-- ⚠️ ডিফল্ট ০ = অগ্রিম বন্ধ। এই migration চালানোমাত্র কোনো চালু
-- রেস্তোরাঁর গ্রাহক হঠাৎ payment পাতায় গিয়ে পড়বেন না — owner
-- /admin/settings থেকে নিজে অঙ্কটা বসাবেন।
ALTER TABLE "RestaurantSettings"
  ADD COLUMN "reservationDepositAmount" DECIMAL(12,3) NOT NULL DEFAULT 0;
