-- Rider panel: vehicle details, self-accepted deliveries and the customer's
-- rating of the delivery. IF NOT EXISTS so it is safe on a db push database.
ALTER TABLE "StaffProfile" ADD COLUMN IF NOT EXISTS "vehicleType" TEXT,
ADD COLUMN IF NOT EXISTS "vehicleModel" TEXT,
ADD COLUMN IF NOT EXISTS "vehiclePlate" TEXT;

ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "selfAssigned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "riderRating" INTEGER,
ADD COLUMN IF NOT EXISTS "riderRatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "DeliveryTracking_riderId_deliveredAt_idx" ON "DeliveryTracking"("riderId", "deliveredAt");
