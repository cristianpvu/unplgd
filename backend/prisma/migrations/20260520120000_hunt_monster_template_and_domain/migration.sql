-- DropForeignKey
ALTER TABLE "ParkContent" DROP CONSTRAINT "ParkContent_parkId_fkey";

-- AlterTable
ALTER TABLE "PetSpecies" ADD COLUMN     "expertiseDomains" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "HuntChallenge" ADD COLUMN     "domain" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "HuntChallengeRun" ADD COLUMN     "petHint" TEXT,
ADD COLUMN     "petHintPetId" TEXT;

-- DropTable
DROP TABLE "ParkContent";

-- CreateTable
CREATE TABLE "MonsterTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "tier" "MonsterType" NOT NULL,
    "loreShort" TEXT NOT NULL DEFAULT '',
    "imagePath" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonsterTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonsterTemplate_slug_key" ON "MonsterTemplate"("slug");

-- CreateIndex
CREATE INDEX "MonsterTemplate_active_tier_idx" ON "MonsterTemplate"("active", "tier");

-- CreateIndex
CREATE INDEX "MonsterTemplate_domain_idx" ON "MonsterTemplate"("domain");

-- CreateIndex
CREATE INDEX "HuntChallenge_domain_difficulty_active_idx" ON "HuntChallenge"("domain", "difficulty", "active");

-- AddForeignKey
ALTER TABLE "HuntChallengeRun" ADD CONSTRAINT "HuntChallengeRun_petHintPetId_fkey" FOREIGN KEY ("petHintPetId") REFERENCES "Pet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
