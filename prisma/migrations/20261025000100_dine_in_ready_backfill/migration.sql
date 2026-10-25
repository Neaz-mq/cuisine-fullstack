UPDATE "Order" SET "status" = 'READY'
WHERE "status" = 'OUT_FOR_DELIVERY' AND "orderType" = 'DINE_IN';
