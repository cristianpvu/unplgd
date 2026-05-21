-- AlterTable
ALTER TABLE "User" ADD COLUMN     "selectedBackgroundKey" TEXT;

-- CreateTable
CREATE TABLE "AdventureWorld" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "speciesSlug" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lore" TEXT NOT NULL DEFAULT '',
    "bossName" TEXT NOT NULL,
    "bossLore" TEXT NOT NULL DEFAULT '',
    "nodeCount" INTEGER NOT NULL DEFAULT 4,
    "accentColor" TEXT NOT NULL DEFAULT '#2ECC71',
    "bgColor" TEXT NOT NULL DEFAULT '#0E2A1A',
    "obstacleStyle" TEXT NOT NULL DEFAULT 'bridge',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AdventureWorld_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdventureRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "worldSlug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "contentJson" JSONB NOT NULL,
    "progressJson" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AdventureRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileBackground" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "worldSlug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "requiredCompletions" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProfileBackground_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBackground" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "backgroundKey" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBackground_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdventureWorld_slug_key" ON "AdventureWorld"("slug");

-- CreateIndex
CREATE INDEX "AdventureWorld_speciesSlug_active_idx" ON "AdventureWorld"("speciesSlug", "active");

-- CreateIndex
CREATE INDEX "AdventureRun_userId_status_idx" ON "AdventureRun"("userId", "status");

-- CreateIndex
CREATE INDEX "AdventureRun_userId_worldSlug_idx" ON "AdventureRun"("userId", "worldSlug");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileBackground_key_key" ON "ProfileBackground"("key");

-- CreateIndex
CREATE INDEX "ProfileBackground_worldSlug_active_idx" ON "ProfileBackground"("worldSlug", "active");

-- CreateIndex
CREATE INDEX "UserBackground_userId_idx" ON "UserBackground"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBackground_userId_backgroundKey_key" ON "UserBackground"("userId", "backgroundKey");

-- AddForeignKey
ALTER TABLE "AdventureRun" ADD CONSTRAINT "AdventureRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdventureRun" ADD CONSTRAINT "AdventureRun_worldSlug_fkey" FOREIGN KEY ("worldSlug") REFERENCES "AdventureWorld"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileBackground" ADD CONSTRAINT "ProfileBackground_worldSlug_fkey" FOREIGN KEY ("worldSlug") REFERENCES "AdventureWorld"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBackground" ADD CONSTRAINT "UserBackground_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBackground" ADD CONSTRAINT "UserBackground_backgroundKey_fkey" FOREIGN KEY ("backgroundKey") REFERENCES "ProfileBackground"("key") ON DELETE CASCADE ON UPDATE CASCADE;

