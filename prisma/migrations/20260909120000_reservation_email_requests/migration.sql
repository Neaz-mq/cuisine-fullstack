-- Reservation-এ email আর special requests।
--
-- দুটোই nullable, তাই বিদ্যমান row-গুলোর জন্য backfill লাগে না আর
-- lock কার্যত তাৎক্ষণিক।
--
-- ⚠️ `email`-এ কোনো index নেই, ইচ্ছাকৃতভাবে। এটা দিয়ে কখনো খোঁজা হয়
-- না — /admin/reservations টেবিল বা তারিখ ধরে ছাঁকে, email ধরে নয়।
-- "ভবিষ্যতে লাগতে পারে" বলে index বসানো মানে প্রতিটা booking INSERT-এ
-- বিনা কারণে খরচ।
ALTER TABLE "Reservation"
  ADD COLUMN "email"           TEXT,
  ADD COLUMN "specialRequests" TEXT;
