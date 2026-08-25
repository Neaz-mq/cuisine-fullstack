-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "currency" SET DEFAULT 'USD';

-- AlterTable
ALTER TABLE "RestaurantSettings" ALTER COLUMN "currency" SET DEFAULT 'USD';

-- Backfill: switch the running restaurant over to USD.
--
-- The two ALTERs above only change what a NEW row gets when nobody names a
-- currency. They do not touch a single existing row, so without the update
-- below the settings row keeps saying BDT and every screen keeps rendering
-- the taka sign.
--
-- Decimal places move together with the currency on purpose. Both are 2
-- here so nothing actually changes, but leaving the pair to drift is how
-- you end up charging 100x: Stripe wants minor units, and the multiplier
-- is 10^currencyMinorUnits.
UPDATE "RestaurantSettings"
SET "currency" = 'USD', "currencyMinorUnits" = 2
WHERE "currency" = 'BDT';

-- Existing orders are deliberately NOT touched here.
--
-- Each order snapshots the currency it was actually placed in, which is
-- what keeps an old invoice honest after the restaurant switches. Rewriting
-- those rows would relabel real money that changed hands — a BDT 500 order
-- would start claiming it was $500.
--
-- For a demo/portfolio database full of seeded orders that relabelling is
-- exactly what you want, and there is a script for it:
--
--     npx tsx scripts/relabel-order-currency.ts --from BDT --to USD --yes
--
-- It is kept out of this migration so that running the migration on a real
-- database can never silently rewrite payment history.
