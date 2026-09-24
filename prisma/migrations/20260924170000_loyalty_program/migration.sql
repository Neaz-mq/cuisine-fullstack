-- Loyalty program settings: earn rules ("Target Point") and tiers ("Customer Ranking").
-- Additive only. The rows are filled on first read by lib/loyalty-config.ts.
CREATE TABLE "LoyaltyEarnRule" (
    "id" TEXT NOT NULL,
    "spendAmount" DECIMAL(12,3) NOT NULL,
    "points" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoyaltyEarnRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LoyaltyEarnRule_isActive_idx" ON "LoyaltyEarnRule"("isActive");

CREATE TABLE "LoyaltyTier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minPoints" INTEGER NOT NULL,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "bonusPercent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoyaltyTier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LoyaltyTier_name_key" ON "LoyaltyTier"("name");
CREATE UNIQUE INDEX "LoyaltyTier_minPoints_key" ON "LoyaltyTier"("minPoints");
