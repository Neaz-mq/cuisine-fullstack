-- Delivery destination can now be unknown: a rider can be assigned even
-- when the address could not be placed on the map.
ALTER TABLE "DeliveryTracking" ALTER COLUMN "destLat" DROP NOT NULL;
ALTER TABLE "DeliveryTracking" ALTER COLUMN "destLng" DROP NOT NULL;
