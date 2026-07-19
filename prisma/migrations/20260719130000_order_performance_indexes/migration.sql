-- Order table is the hottest table in the app: customer order history
-- (WHERE userId = ? ORDER BY createdAt DESC), the Kitchen board polling
-- every 15s (WHERE status IN (...)), and the admin Orders list (sorted by
-- createdAt, optionally filtered by status) all hit it directly. Only
-- tableId had an index before this migration -- everything else was a
-- full table scan.

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
