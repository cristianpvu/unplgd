-- Story.domainSlug: cache local al rezultatului classifier-ului. Populat la
-- prima verificare reusita, refolosit la EXPLICIT_LIKE pt a evita reclassify.
ALTER TABLE "Story" ADD COLUMN "domainSlug" TEXT;

-- StoryLike: explicit positive signal (heart). Unique pe (userId, storyId)
-- previne dublarea. Unlike-ul sterge randul; XP-ul ramane via idempotency pe
-- sourceId=storyId in DomainXpTransaction / SkillXpTransaction.
CREATE TABLE "StoryLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryLike_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoryLike_userId_storyId_key"
  ON "StoryLike"("userId", "storyId");

CREATE INDEX "StoryLike_storyId_idx"
  ON "StoryLike"("storyId");

CREATE INDEX "StoryLike_userId_createdAt_idx"
  ON "StoryLike"("userId", "createdAt");

ALTER TABLE "StoryLike"
  ADD CONSTRAINT "StoryLike_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoryLike"
  ADD CONSTRAINT "StoryLike_storyId_fkey"
  FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
