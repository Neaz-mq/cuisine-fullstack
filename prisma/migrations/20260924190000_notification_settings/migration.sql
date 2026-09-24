-- Settings → Notifications: stock-alert switches. Additive, both default on.
ALTER TABLE "RestaurantSettings"
  ADD COLUMN "lowStockAlerts" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "emergencyStockAlerts" BOOLEAN NOT NULL DEFAULT true;
