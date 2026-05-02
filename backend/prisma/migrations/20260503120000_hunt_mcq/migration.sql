-- Adauga tipul de challenge mcq + coloana options pentru variante.
ALTER TYPE "ChallengeType" ADD VALUE 'mcq';

ALTER TABLE "HuntChallenge" ADD COLUMN "options" TEXT;
