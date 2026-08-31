-- AlterTable
-- StaffProfile.address — Figma-র "Add New Staff" modal-এর "Permanent
-- Address" ঘর। Nullable, তাই বিদ্যমান row-গুলোর জন্য কোনো default বা
-- backfill লাগে না এবং table lock প্রায় তাৎক্ষণিক (Postgres-এ
-- default ছাড়া nullable column যোগ করা metadata-only operation)।
ALTER TABLE "StaffProfile" ADD COLUMN "address" TEXT;
