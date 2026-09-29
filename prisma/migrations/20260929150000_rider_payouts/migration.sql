-- Rider panel → Cash Out: payout requests and where to send them.
-- IF NOT EXISTS / duplicate_object guards so it is safe on a db push database.
DO $$ BEGIN
    CREATE TYPE "RiderPayoutStatus" AS ENUM ('PENDING', 'PAID', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RiderPayout" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL,
    "currency" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "payTo" TEXT,
    "status" "RiderPayoutStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processedById" TEXT,
    "note" TEXT,
    CONSTRAINT "RiderPayout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RiderPayout_riderId_requestedAt_idx" ON "RiderPayout"("riderId", "requestedAt");
CREATE INDEX IF NOT EXISTS "RiderPayout_status_requestedAt_idx" ON "RiderPayout"("status", "requestedAt");

DO $$ BEGIN
    ALTER TABLE "RiderPayout" ADD CONSTRAINT "RiderPayout_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "StaffProfile" ADD COLUMN IF NOT EXISTS "payoutMethod" TEXT,
ADD COLUMN IF NOT EXISTS "payoutBankName" TEXT,
ADD COLUMN IF NOT EXISTS "payoutBankAccountName" TEXT,
ADD COLUMN IF NOT EXISTS "payoutBankAccountNumber" TEXT,
ADD COLUMN IF NOT EXISTS "payoutWalletProvider" TEXT,
ADD COLUMN IF NOT EXISTS "payoutWalletNumber" TEXT;
