-- Order-এর প্রতিটা ধাপে পৌঁছনোর সময় — tracking পাতার timeline-এ
-- "Preparing · 11:40" জাতীয় লেখার জন্য।
--
-- ⚠️ `updatedAt` দিয়ে চলত না: ওটা প্রতিটা লেখায় বদলায় (rider assign,
-- refund, chat)। "কখন ওই ধাপে পৌঁছেছিল" প্রশ্নের উত্তর আলাদা কলাম
-- ছাড়া উদ্ধার করা যায় না।
--
-- তিনটেই nullable, তাই backfill লাগে না। পুরোনো অর্ডারে null থাকবে,
-- আর tracking পাতা তখন সময় ছাড়াই শুধু ধাপের নাম দেখাবে।
ALTER TABLE "Order"
  ADD COLUMN "preparingAt"  TIMESTAMP(3),
  ADD COLUMN "dispatchedAt" TIMESTAMP(3),
  ADD COLUMN "deliveredAt"  TIMESTAMP(3);

-- ⚠️ কোনো index নেই, ইচ্ছাকৃতভাবে। এই কলামগুলোতে কখনো WHERE বা
-- ORDER BY হয় না — একটা নির্দিষ্ট order পড়ার সময় সাথেই আসে।
