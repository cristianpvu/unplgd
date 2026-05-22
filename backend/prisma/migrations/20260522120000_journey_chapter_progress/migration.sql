-- Progresul capitolelor Journey per user. Idempotent prin unique (userId, chapterId).

CREATE TABLE "JourneyChapterProgress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "chapterId" TEXT NOT NULL,
  "petSlug" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JourneyChapterProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JourneyChapterProgress_userId_chapterId_key"
  ON "JourneyChapterProgress"("userId", "chapterId");

CREATE INDEX "JourneyChapterProgress_userId_petSlug_idx"
  ON "JourneyChapterProgress"("userId", "petSlug");

ALTER TABLE "JourneyChapterProgress"
  ADD CONSTRAINT "JourneyChapterProgress_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
