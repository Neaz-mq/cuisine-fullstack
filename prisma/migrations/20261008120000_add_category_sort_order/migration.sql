-- মেনুতে category-র ক্রম।
ALTER TABLE "Category" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 999;

-- বর্তমান category গুলোর ক্রম: Pizza এখন Chicken-এর পরে, Coffee-র আগে।
-- যে নাম database-এ নেই (নতুন install) সেগুলো এখানে ছোঁয়া হয় না।
UPDATE "Category" SET "sortOrder" = CASE "name"
  WHEN 'Appetizer' THEN 1
  WHEN 'Burgers'   THEN 2
  WHEN 'Chicken'   THEN 3
  WHEN 'Pizza'     THEN 4
  WHEN 'Coffee'    THEN 5
  WHEN 'Drinks'    THEN 6
  ELSE "sortOrder"
END;