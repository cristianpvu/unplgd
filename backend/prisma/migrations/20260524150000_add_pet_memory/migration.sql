-- PetMemory: memorie persistenta per (user, pet species). Permite pet-urilor
-- diferite ale aceluiasi user sa aiba istorii independente.

CREATE TABLE "PetMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "speciesSlug" TEXT NOT NULL,
    "fact" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PetMemory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PetMemory_userId_speciesSlug_archived_createdAt_idx"
  ON "PetMemory"("userId", "speciesSlug", "archived", "createdAt");

ALTER TABLE "PetMemory"
  ADD CONSTRAINT "PetMemory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
