-- Pipeline RVC voice conversion per specie. URL la .zip (pth+index) pe
-- HuggingFace / voice-models.com; pitch shift in semitones (negativ = mai grav).
ALTER TABLE "PetSpecies"
  ADD COLUMN "rvcModelUrl" TEXT,
  ADD COLUMN "rvcPitchShift" INTEGER NOT NULL DEFAULT 0;
