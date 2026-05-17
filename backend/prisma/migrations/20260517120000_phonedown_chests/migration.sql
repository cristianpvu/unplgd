-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "AttachmentPoint" AS ENUM ('HAND', 'NECK', 'FEET', 'BACK', 'HEAD');

-- CreateEnum
CREATE TYPE "PhoneDownStatus" AS ENUM ('WAITING', 'PLAYING', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PhoneDownParticipantStatus" AS ENUM ('ACTIVE', 'PAUSED', 'SURRENDERED', 'WINNER');

-- CreateEnum
CREATE TYPE "ChestTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'CHAMPION');

-- AlterTable
ALTER TABLE "Item"
  ADD COLUMN "rarity" "Rarity" NOT NULL DEFAULT 'COMMON',
  ADD COLUMN "exclusive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "attachmentPoint" "AttachmentPoint";

-- CreateTable
CREATE TABLE "PhoneDownSession" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "status" "PhoneDownStatus" NOT NULL DEFAULT 'WAITING',
    "startedAt" TIMESTAMP(3),
    "capAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneDownSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneDownParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PhoneDownParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phoneDownAt" TIMESTAMP(3),
    "surrenderedAt" TIMESTAMP(3),
    "pausedAccumMs" INTEGER NOT NULL DEFAULT 0,
    "pausedAt" TIMESTAMP(3),
    "rank" INTEGER,
    "durationMs" INTEGER,
    "chestId" TEXT,

    CONSTRAINT "PhoneDownParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "ChestTier" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "lootJson" JSONB NOT NULL,
    "openedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhoneDownSession_hostId_status_idx" ON "PhoneDownSession"("hostId", "status");

-- CreateIndex
CREATE INDEX "PhoneDownSession_status_capAt_idx" ON "PhoneDownSession"("status", "capAt");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneDownParticipant_chestId_key" ON "PhoneDownParticipant"("chestId");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneDownParticipant_sessionId_userId_key" ON "PhoneDownParticipant"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "PhoneDownParticipant_userId_status_idx" ON "PhoneDownParticipant"("userId", "status");

-- CreateIndex
CREATE INDEX "PhoneDownParticipant_sessionId_status_idx" ON "PhoneDownParticipant"("sessionId", "status");

-- CreateIndex
CREATE INDEX "Chest_userId_openedAt_idx" ON "Chest"("userId", "openedAt");

-- AddForeignKey
ALTER TABLE "PhoneDownSession" ADD CONSTRAINT "PhoneDownSession_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneDownParticipant" ADD CONSTRAINT "PhoneDownParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PhoneDownSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneDownParticipant" ADD CONSTRAINT "PhoneDownParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneDownParticipant" ADD CONSTRAINT "PhoneDownParticipant_chestId_fkey" FOREIGN KEY ("chestId") REFERENCES "Chest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chest" ADD CONSTRAINT "Chest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
