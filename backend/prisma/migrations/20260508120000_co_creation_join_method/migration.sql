-- CreateEnum
CREATE TYPE "CoCreationJoinMethod" AS ENUM ('NFC_BAND', 'NFC_PHONE');

-- AlterTable
ALTER TABLE "CoCreation" ADD COLUMN "joinMethod" "CoCreationJoinMethod" NOT NULL DEFAULT 'NFC_BAND';
