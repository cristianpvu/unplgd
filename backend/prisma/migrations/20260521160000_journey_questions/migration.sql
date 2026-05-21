-- Pool global de intrebari journey pe domeniu + varsta.

CREATE TABLE "JourneyQuestion" (
  "id" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "minAge" INTEGER NOT NULL DEFAULT 6,
  "maxAge" INTEGER NOT NULL DEFAULT 14,
  "prompt" TEXT NOT NULL,
  "options" TEXT[],
  "correctIndex" INTEGER NOT NULL,
  "successLine" TEXT NOT NULL DEFAULT 'Asa este!',
  "failLine" TEXT NOT NULL DEFAULT 'Nu chiar, dar e bine ca incercam.',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JourneyQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JourneyQuestion_domain_active_idx" ON "JourneyQuestion"("domain", "active");
