-- CreateEnum
CREATE TYPE "CashRemittanceStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CashRemittanceSource" AS ENUM ('RIDER', 'ADMIN');

-- CreateTable
CREATE TABLE "CashRemittance" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL,
    "currency" TEXT NOT NULL,
    "source" "CashRemittanceSource" NOT NULL,
    "status" "CashRemittanceStatus" NOT NULL DEFAULT 'PENDING',
    "riderNote" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,

    CONSTRAINT "CashRemittance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashRemittance_riderId_createdAt_idx" ON "CashRemittance"("riderId", "createdAt");

-- CreateIndex
CREATE INDEX "CashRemittance_status_createdAt_idx" ON "CashRemittance"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "CashRemittance" ADD CONSTRAINT "CashRemittance_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
