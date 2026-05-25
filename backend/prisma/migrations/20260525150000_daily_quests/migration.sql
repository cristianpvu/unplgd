-- QuestTemplate: pool de quests din care daily seed selecteaza per (user, zi)
CREATE TABLE "QuestTemplate" (
    "slug" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "requiredCount" INTEGER NOT NULL DEFAULT 1,
    "baseXp" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "weight" INTEGER NOT NULL DEFAULT 10,
    "weekdayBoost" JSONB NOT NULL DEFAULT '{}',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '✨',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "QuestTemplate_pkey" PRIMARY KEY ("slug")
);

-- DailyQuest: 3 sloturi/zi/user, populate lazy la primul GET.
CREATE TABLE "DailyQuest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questDate" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "requiredCount" INTEGER NOT NULL,
    "xpReward" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyQuest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyQuest_userId_questDate_slot_key"
  ON "DailyQuest"("userId", "questDate", "slot");

CREATE INDEX "DailyQuest_userId_questDate_idx"
  ON "DailyQuest"("userId", "questDate");

CREATE INDEX "DailyQuest_userId_completedAt_idx"
  ON "DailyQuest"("userId", "completedAt");

ALTER TABLE "DailyQuest"
  ADD CONSTRAINT "DailyQuest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyQuest"
  ADD CONSTRAINT "DailyQuest_slug_fkey"
  FOREIGN KEY ("slug") REFERENCES "QuestTemplate"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
