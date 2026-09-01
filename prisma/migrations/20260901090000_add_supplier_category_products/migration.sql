-- AlterTable
-- Supplier.category — Figma-র "Supply Category"। Nullable, তাই পুরনো
-- row-গুলোর জন্য কোনো backfill লাগে না।
ALTER TABLE "Supplier" ADD COLUMN "category" TEXT;

-- Supplier.products — Figma-র "Product Supplied" chips।
--
-- ⚠️ NOT NULL + খালি array default, nullable নয়। "কোনো পণ্য লেখা হয়নি"
-- আর "পণ্যের তালিকা অনুপস্থিত" — দুটোর তফাত এখানে অর্থহীন, আর array
-- হলে প্রতিটা পাঠের জায়গায় null-check করতে হতো। Postgres-এ default
-- সহ column যোগ করাও (PG 11+) metadata-only, তাই table rewrite নেই।
ALTER TABLE "Supplier" ADD COLUMN "products" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
