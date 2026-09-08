-- টেবিলের ঐচ্ছিক ডাকনাম আর ছবি।
--
-- দুটোই nullable, তাই বিদ্যমান row-গুলোর জন্য backfill লাগে না আর
-- lock কার্যত তাৎক্ষণিক।
--
-- ⚠️ `name`-এ কোনো UNIQUE নেই, ইচ্ছাকৃতভাবে। শনাক্তকারী হলো `label`
-- (T-1), যা আগে থেকেই unique — QR কোড আর রান্নাঘরের টিকিট ওটাই ধরে।
-- দুটো টেবিলের ডাকনাম "Window Table" হওয়া স্বাভাবিক।
ALTER TABLE "RestaurantTable"
  ADD COLUMN "name"     TEXT,
  ADD COLUMN "imageUrl" TEXT;
