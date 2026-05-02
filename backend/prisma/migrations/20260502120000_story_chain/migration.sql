-- AlterTable: chain + audio fields on Story
ALTER TABLE "Story" ADD COLUMN "parentStoryId" TEXT;
ALTER TABLE "Story" ADD COLUMN "chainRootId" TEXT;
ALTER TABLE "Story" ADD COLUMN "audioUrl" TEXT;
ALTER TABLE "Story" ADD COLUMN "audioProvider" TEXT;

-- Backfill: orice poveste pre-existenta e propriul chain root.
UPDATE "Story" SET "chainRootId" = "id" WHERE "chainRootId" IS NULL;

-- CreateIndex
CREATE INDEX "Story_chainRootId_idx" ON "Story"("chainRootId");

-- CreateIndex
CREATE INDEX "Story_parentStoryId_idx" ON "Story"("parentStoryId");

-- AddForeignKey: self-referential, SET NULL pe delete ca sa nu cascadeze
-- intamplator stergerea unei extensii cand se sterge parintele.
ALTER TABLE "Story" ADD CONSTRAINT "Story_parentStoryId_fkey" FOREIGN KEY ("parentStoryId") REFERENCES "Story"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
