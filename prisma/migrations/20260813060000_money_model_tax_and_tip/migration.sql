-- ===========================================================================
-- Money model: Float -> Decimal, পূর্ণ bill breakdown, কর/service charge/tip
--
-- তিনটা আলাদা কাজ একসাথে করা হচ্ছে ইচ্ছাকৃতভাবে, কারণ তিনটাই একই
-- column গুলো ছোঁয় — আলাদা করলে একই টেবিল দুবার rewrite হতো, আর মাঝের
-- অবস্থায় deploy আটকে গেলে অর্ধেক টাকা Float অর্ধেক Decimal থাকতো।
--
--   ১. প্রতিটা money column double precision -> numeric(12,3)
--   ২. Order-এ subtotal / serviceCharge / deliveryFee / taxAmount /
--      tipAmount / grandTotal + কর snapshot
--   ৩. RestaurantSettings-এ দেশভেদে কনফিগার করার মতো নিয়মগুলো
--
-- ⚠️ এটা একটা table-rewrite migration। বড় Order টেবিলে ALTER COLUMN TYPE
--    পুরো টেবিল লক করে রাখে, তাই ট্র্যাফিক কম থাকা সময়ে চালাবেন।
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- ১. Float -> Decimal
--
-- numeric(12,3): ১২ অঙ্ক, তার মধ্যে ৩টা দশমিকের পরে। ৩ দশমিক লাগে কারণ
-- কুয়েতি/বাহরাইনি দিনার আর ওমানি রিয়াল ১০০০ ভাগে বিভক্ত। বাকিদের জন্য
-- বাড়তি ঘরটা নিছক অব্যবহৃত, ক্ষতিকর নয়।
--
-- USING ... ::numeric নিরাপদ: Postgres double -> numeric রূপান্তরে
-- দশমিক প্রতিরূপ ব্যবহার করে, তাই 19.989999999999998 এখানে এসে
-- 19.990 হয়ে যায়। অর্থাৎ migration নিজেই জমে থাকা float ভুল পরিষ্কার
-- করে দেয়।
--
-- অক্ষত রইল যেগুলো, ইচ্ছাকৃতভাবে:
--   DeliveryTracking.riderLat/riderLng/destLat/destLng — টাকা নয়,
--     ভৌগোলিক স্থানাঙ্ক; সেখানে double precision-ই সঠিক ধরন।
--   InventoryItem.currentStock, MenuItemIngredient.quantityRequired,
--     StockMovement.quantityChange/resultingStock,
--     PurchaseOrderItem.quantityOrdered/quantityReceived — পরিমাণ,
--     টাকা নয়। এগুলোতেও float drift হয়, কিন্তু সেখানে drift-এর ফল
--     "হিসাবের সাথে বাস্তব মজুদের সামান্য গরমিল", যা physical count-এ
--     এমনিতেই সংশোধন হয়। টাকার drift-এর ফল "গ্রাহকের ব্যালেন্স হারিয়ে
--     গেল"। এক migration-এ সব ধরলে এই সীমিত, যাচাইযোগ্য পরিবর্তনটা
--     inventory-র প্রতিটা arithmetic call site ছোঁয়া একটা বড় refactor
--     হয়ে যেতো। পরিমাণের রূপান্তর আলাদা migration-এ।
-- ---------------------------------------------------------------------------

ALTER TABLE "StaffProfile"
  ALTER COLUMN "salary" TYPE numeric(12,3) USING "salary"::numeric;

ALTER TABLE "MenuItem"
  ALTER COLUMN "price" TYPE numeric(12,3) USING "price"::numeric;

ALTER TABLE "OrderItem"
  ALTER COLUMN "price" TYPE numeric(12,3) USING "price"::numeric;

ALTER TABLE "Order"
  ALTER COLUMN "totalAmount"          TYPE numeric(12,3) USING "totalAmount"::numeric,
  ALTER COLUMN "discountAmount"       TYPE numeric(12,3) USING "discountAmount"::numeric,
  ALTER COLUMN "giftCardAmount"       TYPE numeric(12,3) USING "giftCardAmount"::numeric,
  ALTER COLUMN "tierDiscountAmount"   TYPE numeric(12,3) USING "tierDiscountAmount"::numeric,
  ALTER COLUMN "pointsRedeemedAmount" TYPE numeric(12,3) USING "pointsRedeemedAmount"::numeric;

ALTER TABLE "Coupon"
  ALTER COLUMN "fixedOff"          TYPE numeric(12,3) USING "fixedOff"::numeric,
  ALTER COLUMN "maxDiscountAmount" TYPE numeric(12,3) USING "maxDiscountAmount"::numeric,
  ALTER COLUMN "minOrderValue"     TYPE numeric(12,3) USING "minOrderValue"::numeric;

ALTER TABLE "CouponRedemption"
  ALTER COLUMN "discountAmount" TYPE numeric(12,3) USING "discountAmount"::numeric;

-- এই দুটোই আসল কারণ কাজটা জরুরি ছিল: gift card ধাপে ধাপে খরচ হয়, আর
-- 50 − 19.99 − 12.35 − 17.66 double precision-এ শূন্য হয় না, ~1.8e-15
-- হয়। ফলে কার্ড চিরকাল "ব্যালেন্স আছে" দেখাতো অথচ কিছু কেনা যেতো না।
ALTER TABLE "GiftCard"
  ALTER COLUMN "initialAmount" TYPE numeric(12,3) USING "initialAmount"::numeric,
  ALTER COLUMN "balance"       TYPE numeric(12,3) USING "balance"::numeric;

ALTER TABLE "GiftCardTransaction"
  ALTER COLUMN "amount" TYPE numeric(12,3) USING "amount"::numeric;

ALTER TABLE "InventoryItem"
  ALTER COLUMN "costPerUnit" TYPE numeric(12,3) USING "costPerUnit"::numeric;

ALTER TABLE "PurchaseOrder"
  ALTER COLUMN "totalCost" TYPE numeric(12,3) USING "totalCost"::numeric;

ALTER TABLE "PurchaseOrderItem"
  ALTER COLUMN "costPerUnit" TYPE numeric(12,3) USING "costPerUnit"::numeric;

-- জমে থাকা float ধুলো ঝেড়ে ফেলা: রূপান্তরের পর 0.0000000000000018
-- ধরনের ব্যালেন্স যেন সত্যিকারের শূন্য হয়ে যায়, নইলে পুরোনো কার্ডগুলো
-- Decimal-এ গিয়েও "ব্যবহারযোগ্য" থেকে যেতো।
UPDATE "GiftCard" SET "balance" = 0 WHERE "balance" > 0 AND "balance" < 0.001;

-- ---------------------------------------------------------------------------
-- ২. Order — বিলের ভাঙানো হিসাব
-- ---------------------------------------------------------------------------

CREATE TYPE "TaxMode" AS ENUM ('INCLUSIVE', 'EXCLUSIVE');

ALTER TABLE "Order"
  ADD COLUMN "subtotal"      numeric(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN "serviceCharge" numeric(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN "deliveryFee"   numeric(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN "taxAmount"     numeric(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN "tipAmount"     numeric(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN "grandTotal"    numeric(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN "currency"      text          NOT NULL DEFAULT 'BDT',
  ADD COLUMN "taxName"       text          NOT NULL DEFAULT 'VAT',
  ADD COLUMN "taxRate"       numeric(8,5)  NOT NULL DEFAULT 0,
  ADD COLUMN "taxMode"       "TaxMode"     NOT NULL DEFAULT 'EXCLUSIVE';

-- Backfill: পুরোনো order-গুলোতে কর, service charge বা tip ছিল না — কারণ
-- system-এ সেই ধারণাগুলোই ছিল না। তাই সেগুলো ০ (default-ই ঠিক আছে), আর
-- বাকি দুটো পুরোনো অর্থ থেকে পুনর্গঠন করা হচ্ছে:
--
--   grandTotal = গ্রাহক যা দিয়েছে + যা prepaid দিয়ে মিটেছে
--              = totalAmount + giftCardAmount + pointsRedeemedAmount
--
--   subtotal   = grandTotal + ফিরিয়ে দেওয়া ছাড়
--              = grandTotal + discountAmount + tierDiscountAmount
--
-- taxRate ইচ্ছাকৃতভাবে ০ রাখা হচ্ছে, settings-এর নতুন হার দিয়ে ভরা
-- হচ্ছে না। পুরোনো চালানে কর নেওয়া *হয়নি*; সেখানে আজকের হার বসানো
-- মানে ইতিহাস জাল করা। snapshot column-এর পুরো উদ্দেশ্যই সেটা ঠেকানো।
UPDATE "Order" SET
  "grandTotal" = "totalAmount" + "giftCardAmount" + "pointsRedeemedAmount",
  "subtotal"   = "totalAmount" + "giftCardAmount" + "pointsRedeemedAmount"
                 + "discountAmount" + "tierDiscountAmount";

-- ---------------------------------------------------------------------------
-- ৩. RestaurantSettings — দেশভেদে যা বদলায়
--
-- Default গুলো একটা বাংলাদেশি non-AC রেস্তোরাঁ (৫% VAT দামের উপরে,
-- service charge নেই, tip বন্ধ)। এর বেশি কোনো অর্থ নেই — fresh install
-- কিছু একটা নিয়ে চালু হতে হয়। owner সেটআপে নিজের দেশ অনুযায়ী বদলাবে।
-- ---------------------------------------------------------------------------

ALTER TABLE "RestaurantSettings"
  ADD COLUMN "currency"             text          NOT NULL DEFAULT 'BDT',
  ADD COLUMN "currencyMinorUnits"   integer       NOT NULL DEFAULT 2,
  ADD COLUMN "taxEnabled"           boolean       NOT NULL DEFAULT true,
  ADD COLUMN "taxName"              text          NOT NULL DEFAULT 'VAT',
  ADD COLUMN "taxMode"              "TaxMode"     NOT NULL DEFAULT 'EXCLUSIVE',
  ADD COLUMN "taxRateDineIn"        numeric(8,5)  NOT NULL DEFAULT 0.05,
  ADD COLUMN "taxRateDelivery"      numeric(8,5)  NOT NULL DEFAULT 0.05,
  ADD COLUMN "serviceChargeRate"    numeric(8,5)  NOT NULL DEFAULT 0,
  ADD COLUMN "serviceChargeTaxable" boolean       NOT NULL DEFAULT true,
  ADD COLUMN "deliveryFeeFlat"      numeric(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN "deliveryFeeTaxable"   boolean       NOT NULL DEFAULT true,
  ADD COLUMN "tipEnabled"           boolean       NOT NULL DEFAULT false,
  ADD COLUMN "tipPresetPercents"    integer[]     NOT NULL DEFAULT ARRAY[10, 15, 20];

-- ⚠️ ইতিমধ্যে চালু থাকা install-এ: এই migration চলার পর প্রতিটা নতুন
-- order-এ ৫% VAT যোগ হতে শুরু করবে, কারণ taxEnabled default true।
-- বাংলাদেশের বাইরে (বা VAT-নিবন্ধিত নয় এমন রেস্তোরাঁয়) migration-এর
-- সাথে সাথে /admin/settings-এ গিয়ে হার ঠিক করে নিতে হবে, নয়তো
-- গ্রাহকের কাছ থেকে ভুল কর আদায় হবে।
