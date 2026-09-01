-- AlterTable
-- Figma-র Inventory পাতার জন্য চারটে নতুন ঘর + ডিফল্ট সরবরাহকারী।
--
-- ⚠️ সবগুলোই nullable বা default সহ, তাই পুরনো row-গুলোর কোনো backfill
-- লাগে না আর Postgres-এ (PG 11+) এগুলো metadata-only operation — কোনো
-- table rewrite নেই।
ALTER TABLE "InventoryItem" ADD COLUMN "category" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "maxCapacity" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "InventoryItem" ADD COLUMN "emergencyThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "InventoryItem" ADD COLUMN "image" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "supplierId" TEXT;

-- ⚠️ ON DELETE SET NULL — সরবরাহকারী মুছে ফেললে উপকরণটা থেকে যাবে,
-- শুধু "কার কাছ থেকে কিনি" তথ্যটা ফাঁকা হবে। CASCADE হলে একজন
-- সরবরাহকারী মুছলেই তাঁর সব উপকরণ উধাও হয়ে যেত।
ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Inventory পাতা শ্রেণি ধরে গুচ্ছ করে দেখায়, তাই ওই ছাঁকনিটার নিজের index।
CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category");
CREATE INDEX "InventoryItem_supplierId_idx" ON "InventoryItem"("supplierId");
