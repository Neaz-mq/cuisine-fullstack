-- Rename ADMIN -> OWNER, and add the new staff-only roles.
--
-- NOTE: On Postgres < 12, ALTER TYPE ... ADD VALUE can't be used inside the
-- same transaction as a statement that references the new value. Supabase
-- runs Postgres 14+, where this works fine within one transaction as long
-- as the new value isn't *used* until after it commits (which is the case
-- here — nothing below references OWNER/MANAGER/etc. until later
-- statements, after the ADD VALUE calls above them have already run).
ALTER TYPE "Role" RENAME VALUE 'ADMIN' TO 'OWNER';
ALTER TYPE "Role" ADD VALUE 'MANAGER';
ALTER TYPE "Role" ADD VALUE 'WAITER';
ALTER TYPE "Role" ADD VALUE 'CASHIER';
ALTER TYPE "Role" ADD VALUE 'DELIVERY';
ALTER TYPE "Role" ADD VALUE 'KITCHEN';

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT');

-- CreateTable
CREATE TABLE "StaffProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "department" TEXT,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "phone" TEXT,
    "hireDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "nid" TEXT,
    "salary" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_employeeId_key" ON "StaffProfile"("employeeId");

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every pre-existing OWNER (formerly ADMIN) user gets a minimal
-- StaffProfile row, since the app now assumes any staff-role user has one.
-- employeeId is generated as EMP-0001, EMP-0002, ... in row-number order
-- (createdAt) so existing owners get low, stable-looking numbers.
INSERT INTO "StaffProfile" ("id", "userId", "employeeId", "employmentType", "isActive", "hireDate", "createdAt", "updatedAt")
SELECT
  'staff_' || substr(md5(random()::text || u.id), 1, 20),
  u.id,
  'EMP-' || lpad(row_number() OVER (ORDER BY u."createdAt")::text, 4, '0'),
  'FULL_TIME',
  true,
  u."createdAt",
  now(),
  now()
FROM "User" u
WHERE u.role = 'OWNER';
