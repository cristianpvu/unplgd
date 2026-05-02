-- CreateEnum
CREATE TYPE "ChallengeType" AS ENUM ('riddle', 'photo', 'counting');
CREATE TYPE "HuntStatus" AS ENUM ('LOBBY', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "MonsterType" AS ENUM ('green', 'yellow', 'red', 'gold');
CREATE TYPE "MonsterStatus" AS ENUM ('HIDDEN', 'ENGAGED', 'DEFEATED', 'ESCAPED');
CREATE TYPE "ChallengeOutcome" AS ENUM ('PENDING', 'CORRECT', 'WRONG', 'SKIPPED');

-- CreateTable Park
CREATE TABLE "Park" (
    "id" TEXT NOT NULL,
    "osmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "polygon" TEXT NOT NULL,
    "bboxMinLat" DOUBLE PRECISION NOT NULL,
    "bboxMaxLat" DOUBLE PRECISION NOT NULL,
    "bboxMinLng" DOUBLE PRECISION NOT NULL,
    "bboxMaxLng" DOUBLE PRECISION NOT NULL,
    "areaSqm" DOUBLE PRECISION NOT NULL,
    "city" TEXT,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Park_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Park_osmId_key" ON "Park"("osmId");
CREATE INDEX "Park_bboxMinLat_bboxMaxLat_idx" ON "Park"("bboxMinLat", "bboxMaxLat");
CREATE INDEX "Park_bboxMinLng_bboxMaxLng_idx" ON "Park"("bboxMinLng", "bboxMaxLng");

-- CreateTable ParkContent
CREATE TABLE "ParkContent" (
    "id" TEXT NOT NULL,
    "parkId" TEXT NOT NULL,
    "monsters" JSONB NOT NULL,
    "themeSummary" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ParkContent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ParkContent_parkId_key" ON "ParkContent"("parkId");
ALTER TABLE "ParkContent" ADD CONSTRAINT "ParkContent_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- CreateTable HuntChallenge
CREATE TABLE "HuntChallenge" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "ChallengeType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "expected" TEXT NOT NULL,
    "ageMin" INTEGER NOT NULL,
    "ageMax" INTEGER NOT NULL,
    "themeTags" TEXT NOT NULL DEFAULT '',
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HuntChallenge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HuntChallenge_slug_key" ON "HuntChallenge"("slug");
CREATE INDEX "HuntChallenge_type_ageMin_ageMax_active_idx" ON "HuntChallenge"("type", "ageMin", "ageMax", "active");

-- CreateTable HuntSession
CREATE TABLE "HuntSession" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "parkId" TEXT NOT NULL,
    "status" "HuntStatus" NOT NULL DEFAULT 'LOBBY',
    "durationSec" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "monsterCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HuntSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HuntSession_hostId_status_idx" ON "HuntSession"("hostId", "status");
CREATE INDEX "HuntSession_status_endsAt_idx" ON "HuntSession"("status", "endsAt");
ALTER TABLE "HuntSession" ADD CONSTRAINT "HuntSession_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "HuntSession" ADD CONSTRAINT "HuntSession_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "Park"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- CreateTable HuntTeam
CREATE TABLE "HuntTeam" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "zoneArea" DOUBLE PRECISION NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "monstersDefeated" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HuntTeam_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HuntTeam_sessionId_idx" ON "HuntTeam"("sessionId");
ALTER TABLE "HuntTeam" ADD CONSTRAINT "HuntTeam_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "HuntSession"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- CreateTable HuntTeamMember
CREATE TABLE "HuntTeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HuntTeamMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HuntTeamMember_teamId_userId_key" ON "HuntTeamMember"("teamId", "userId");
CREATE INDEX "HuntTeamMember_userId_idx" ON "HuntTeamMember"("userId");
ALTER TABLE "HuntTeamMember" ADD CONSTRAINT "HuntTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "HuntTeam"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "HuntTeamMember" ADD CONSTRAINT "HuntTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- CreateTable HuntMonster
CREATE TABLE "HuntMonster" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "teamId" TEXT,
    "type" "MonsterType" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "loreShort" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "status" "MonsterStatus" NOT NULL DEFAULT 'HIDDEN',
    "engagedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HuntMonster_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HuntMonster_sessionId_teamId_status_idx" ON "HuntMonster"("sessionId", "teamId", "status");
ALTER TABLE "HuntMonster" ADD CONSTRAINT "HuntMonster_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "HuntSession"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "HuntMonster" ADD CONSTRAINT "HuntMonster_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "HuntTeam"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- CreateTable HuntChallengeRun
CREATE TABLE "HuntChallengeRun" (
    "id" TEXT NOT NULL,
    "monsterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "outcome" "ChallengeOutcome" NOT NULL DEFAULT 'PENDING',
    "answer" TEXT,
    "feedback" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "HuntChallengeRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HuntChallengeRun_monsterId_userId_challengeId_key" ON "HuntChallengeRun"("monsterId", "userId", "challengeId");
CREATE INDEX "HuntChallengeRun_monsterId_outcome_idx" ON "HuntChallengeRun"("monsterId", "outcome");
ALTER TABLE "HuntChallengeRun" ADD CONSTRAINT "HuntChallengeRun_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "HuntMonster"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "HuntChallengeRun" ADD CONSTRAINT "HuntChallengeRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "HuntChallengeRun" ADD CONSTRAINT "HuntChallengeRun_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "HuntChallenge"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- CreateTable HuntLobbyMember
CREATE TABLE "HuntLobbyMember" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HuntLobbyMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HuntLobbyMember_sessionId_userId_key" ON "HuntLobbyMember"("sessionId", "userId");
CREATE INDEX "HuntLobbyMember_userId_idx" ON "HuntLobbyMember"("userId");
ALTER TABLE "HuntLobbyMember" ADD CONSTRAINT "HuntLobbyMember_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "HuntSession"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "HuntLobbyMember" ADD CONSTRAINT "HuntLobbyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- CreateTable HuntMonsterDefeat
CREATE TABLE "HuntMonsterDefeat" (
    "id" TEXT NOT NULL,
    "monsterId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "pointsAwarded" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "defeatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HuntMonsterDefeat_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HuntMonsterDefeat_monsterId_key" ON "HuntMonsterDefeat"("monsterId");
ALTER TABLE "HuntMonsterDefeat" ADD CONSTRAINT "HuntMonsterDefeat_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "HuntMonster"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "HuntMonsterDefeat" ADD CONSTRAINT "HuntMonsterDefeat_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "HuntTeam"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
