-- ===========================================================================
-- Distance-based delivery charge
--
-- ⚠️ এই migration-টা হাতে লেখা নয় বলে ধরে নেবেন না — schema.prisma-য়
-- schema-additions.prisma-র ব্লকগুলো বসিয়ে `prisma migrate dev --name
-- delivery_zones` চালালে Prisma প্রায় হুবহু এটাই তৈরি করবে। এখানে সেটা
-- আগেভাগে দেওয়া হলো যাতে (ক) কী ঘটবে তা আগে পড়ে নেওয়া যায়, আর (খ)
-- নিচের ডিফল্ট সিঁড়ি বসানোর UPDATE-টা, যা Prisma নিজে থেকে লিখত না।
--
-- সবগুলো column nullable বা default-সহ, তাই বিদ্যমান row-গুলোর জন্য
-- কোনো backfill লাগে না আর table lock-ও কার্যত তাৎক্ষণিক।
-- ===========================================================================

-- ── ১. Delivery fee mode ───────────────────────────────────────────────
CREATE TYPE "DeliveryFeeMode" AS ENUM ('FLAT', 'DISTANCE');

-- ⚠️ ডিফল্ট FLAT, DISTANCE নয়।
--
-- এই migration চালানোমাত্র কোনো চালু দোকানের delivery charge বদলে
-- যাওয়া উচিত নয়। owner /admin/settings-এ গিয়ে ধাপগুলো দেখে, দাম
-- ঠিক করে, তারপর নিজে DISTANCE-এ যাবেন। নীরবে হিসাব বদলে দেওয়া
-- টাকার কোডে সবচেয়ে খারাপ ধরনের migration।
ALTER TABLE "RestaurantSettings"
  ADD COLUMN "deliveryFeeMode" "DeliveryFeeMode" NOT NULL DEFAULT 'FLAT',
  ADD COLUMN "deliveryZones"   JSONB,
  ADD COLUMN "restaurantLat"   DOUBLE PRECISION,
  ADD COLUMN "restaurantLng"   DOUBLE PRECISION;

-- ── ২. Order — ফি কীভাবে এলো তার প্রমাণ ────────────────────────────────
ALTER TABLE "Order"
  ADD COLUMN "deliveryLat"          DOUBLE PRECISION,
  ADD COLUMN "deliveryLng"          DOUBLE PRECISION,
  ADD COLUMN "deliveryDistanceKm"   DOUBLE PRECISION,
  ADD COLUMN "deliveryZoneLabel"    TEXT,
  ADD COLUMN "deliveryZoneFallback" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deliveryZones"        JSONB;

-- ── ৩. ডিফল্ট সিঁড়ি বসানো ──────────────────────────────────────────────
--
-- Figma-র ধাপগুলোই (0–1 $2 … 8+ $14)। owner DISTANCE-এ যাওয়ার আগেই
-- যেন settings পাতায় একটা সম্পূর্ণ, সম্পাদনযোগ্য তালিকা দেখতে পান —
-- খালি পাতা দেখিয়ে "এখন পাঁচটা ধাপ বানান" বলা অনেক খারাপ শুরু।
--
-- ⚠️ শেষ ধাপের upToKm null = সীমাহীন। সেটা না থাকলে তালিকার বাইরের
-- ঠিকানা মানে "আমরা ওখানে যাই না", আর checkout সেখানে থেমে যাবে
-- (lib/delivery-zones.ts-এর OUT_OF_RANGE)। ডিফল্টে সেই আচরণ চাওয়া
-- হয়নি — নতুন করে চালু করা কোনো দোকানের অর্ডার প্রথম দিনেই আটকে
-- যাওয়ার চেয়ে একটা সর্বোচ্চ ফি নেওয়া ভালো।
UPDATE "RestaurantSettings"
SET "deliveryZones" = '[
  {"upToKm": 1,    "fee": 2},
  {"upToKm": 3,    "fee": 5},
  {"upToKm": 5,    "fee": 7},
  {"upToKm": 8,    "fee": 10},
  {"upToKm": null, "fee": 14}
]'::jsonb
WHERE "deliveryZones" IS NULL;

-- ── ৪. index লাগে না, ইচ্ছাকৃতভাবে ─────────────────────────────────────
--
-- নতুন column-গুলোর কোনোটাতেই কখনো WHERE বা ORDER BY হয় না — সবই
-- একটা নির্দিষ্ট order পড়ার সময় সাথে আসে। "ভবিষ্যতে লাগতে পারে" বলে
-- index বসানো মানে প্রতিটা order INSERT-এ বিনা কারণে খরচ, আর এই
-- table-এ INSERT-ই সবচেয়ে ঘন কাজ।