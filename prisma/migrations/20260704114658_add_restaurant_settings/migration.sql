-- CreateTable
CREATE TABLE "RestaurantSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Dhaka',
    "kitchenOpenHour" INTEGER NOT NULL DEFAULT 10,
    "kitchenCloseHour" INTEGER NOT NULL DEFAULT 22,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantSettings_pkey" PRIMARY KEY ("id")
);
