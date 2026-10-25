-- CreateTable
CREATE TABLE "PrepTask" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" "InventoryUnit" NOT NULL DEFAULT 'KILOGRAM',
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrepTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrepTask_createdAt_idx" ON "PrepTask"("createdAt");
