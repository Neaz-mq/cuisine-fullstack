-- AlterTable
-- Postgres assumes the existing (naive) timestamp values are in UTC when
-- casting to timestamptz, which matches what Prisma/`now()` was writing —
-- so no data actually changes, just how it's represented on the wire.
ALTER TABLE "ChatMessage"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3),
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
