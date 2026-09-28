-- Saved addresses: optional contact phone per address (Figma "Saved Addresses").
ALTER TABLE "CustomerAddress" ADD COLUMN IF NOT EXISTS "phone" TEXT;
