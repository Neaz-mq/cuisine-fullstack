-- Rider panel → Profile: driving licence number and uploaded documents.
-- IF NOT EXISTS / duplicate_object guards so it is safe on a db push database.
ALTER TABLE "StaffProfile" ADD COLUMN IF NOT EXISTS "drivingLicenseNumber" TEXT;

DO $$ BEGIN
    CREATE TYPE "RiderDocumentStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RiderDocument" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "expiresAt" DATE,
    "status" "RiderDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    CONSTRAINT "RiderDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RiderDocument_riderId_type_key" ON "RiderDocument"("riderId", "type");
CREATE INDEX IF NOT EXISTS "RiderDocument_status_uploadedAt_idx" ON "RiderDocument"("status", "uploadedAt");

DO $$ BEGIN
    ALTER TABLE "RiderDocument" ADD CONSTRAINT "RiderDocument_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
