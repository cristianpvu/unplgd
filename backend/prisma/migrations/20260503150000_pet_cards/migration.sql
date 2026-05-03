-- Pet ca AI buddy + vizual la picioarele avatarului. PetSpecies extins cu
-- imagine + atribute pt personalitate AI. NfcPetCard = colectia de carduri
-- fizice scanate de copil; un card scanat schimba Pet.speciesId la specia
-- cardului (1 buddy activ, multe carduri colectate).

-- AlterTable PetSpecies
ALTER TABLE "PetSpecies" ADD COLUMN "imagePath" TEXT;
ALTER TABLE "PetSpecies" ADD COLUMN "shortLore" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PetSpecies" ADD COLUMN "tone" TEXT NOT NULL DEFAULT 'prietenos';
ALTER TABLE "PetSpecies" ADD COLUMN "catchphrases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PetSpecies" ADD COLUMN "interests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PetSpecies" ADD COLUMN "minAge" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "PetSpecies" ADD COLUMN "unlockLevel" INTEGER NOT NULL DEFAULT 1;

-- AlterTable Pet
ALTER TABLE "Pet" ADD COLUMN "bondXp" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Pet" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable NfcPetCard
CREATE TABLE "NfcPetCard" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "ownerId" TEXT,
    "nickname" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NfcPetCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NfcPetCard_uid_key" ON "NfcPetCard"("uid");
CREATE INDEX "NfcPetCard_ownerId_idx" ON "NfcPetCard"("ownerId");

-- AddForeignKey
ALTER TABLE "NfcPetCard" ADD CONSTRAINT "NfcPetCard_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "PetSpecies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NfcPetCard" ADD CONSTRAINT "NfcPetCard_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
