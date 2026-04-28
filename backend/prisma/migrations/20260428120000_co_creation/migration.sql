-- CreateEnum
CREATE TYPE "CoCreationStatus" AS ENUM ('ACTIVE', 'PROCESSING', 'COMPLETED', 'REJECTED', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "CoCreation" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "originalImageKey" TEXT,
    "aiImageKey" TEXT,
    "aiValid" BOOLEAN,
    "aiFeedback" TEXT,
    "status" "CoCreationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoCreation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoCreation_userAId_status_idx" ON "CoCreation"("userAId", "status");

-- CreateIndex
CREATE INDEX "CoCreation_userBId_status_idx" ON "CoCreation"("userBId", "status");

-- CreateIndex
CREATE INDEX "CoCreation_storyId_idx" ON "CoCreation"("storyId");

-- AddForeignKey
ALTER TABLE "CoCreation" ADD CONSTRAINT "CoCreation_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CoCreation" ADD CONSTRAINT "CoCreation_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CoCreation" ADD CONSTRAINT "CoCreation_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
