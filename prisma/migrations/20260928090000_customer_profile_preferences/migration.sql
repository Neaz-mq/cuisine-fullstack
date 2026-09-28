-- Customer panel: Profile Details (date of birth, gender) and the
-- notification switches (order updates, dish recommendations).
ALTER TABLE "User" ADD COLUMN "dateOfBirth" DATE,
ADD COLUMN "gender" TEXT,
ADD COLUMN "notifyOrderUpdates" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notifyRecommendations" BOOLEAN NOT NULL DEFAULT true;
