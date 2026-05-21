-- ProfileBackground: decuplare de AdventureWorld pentru fundalurile journey.
-- worldSlug devine optional (NULL pt journey), adaugam petSlug pt grupare.

ALTER TABLE "ProfileBackground" ALTER COLUMN "worldSlug" DROP NOT NULL;
ALTER TABLE "ProfileBackground" ADD COLUMN "petSlug" TEXT;

CREATE INDEX "ProfileBackground_petSlug_active_idx" ON "ProfileBackground"("petSlug", "active");
