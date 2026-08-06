-- 20260806120000_stock_deduction_unique-এ যোগ করা দুটো unique index
-- ভুল ছিল। StockMovement-এ deduction প্রতি ingredient-এ একটা করে row
-- লেখে, তাই "orderId প্রতি একটাই ORDER_DEDUCTION" শর্তটা দুই-উপকরণের
-- যেকোনো order-কেই P2002 দিয়ে আটকে দিত।
--
-- আগের migration-টা সম্পাদনা না করে নতুন migration দিয়ে সরানো হচ্ছে,
-- কারণ সেটা ইতিমধ্যে applied — Prisma প্রতিটা applied migration-এর
-- checksum রাখে, তাই ফাইল বদলালে migrate status/deploy চেঁচাবে।
--
-- দুবার deduct হওয়া ঠেকানোর কাজটা এখন Order.stockDeductedAt-এ atomic
-- claim দিয়ে হয় (migration 20260806114730) — consumeCoupon /
-- redeemGiftCard-এর মতোই একই pattern।
DROP INDEX IF EXISTS "one_deduction_per_order";
DROP INDEX IF EXISTS "one_return_per_order";