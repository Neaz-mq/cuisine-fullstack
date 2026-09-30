-- Rider panel → Settings: delivery preferences and notification toggles.
ALTER TABLE "StaffProfile" ADD COLUMN IF NOT EXISTS "riderMaxRadiusKm" INTEGER,
ADD COLUMN IF NOT EXISTS "riderAcceptsCash" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "riderNewOrderAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "riderEarningsSummary" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "riderSummarySentOn" DATE;
