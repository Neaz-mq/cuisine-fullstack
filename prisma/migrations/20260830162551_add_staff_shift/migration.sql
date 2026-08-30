-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'NIGHT');

-- AlterTable
ALTER TABLE "StaffProfile" ADD COLUMN     "shift" "Shift";
