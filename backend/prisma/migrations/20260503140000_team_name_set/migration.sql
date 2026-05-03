-- Liderul echipei seteaza/confirma numele dupa Start. Pana atunci, membrii
-- vad "asteptam pe lider sa numeasca echipa".
ALTER TABLE "HuntTeam" ADD COLUMN "nameSet" BOOLEAN NOT NULL DEFAULT false;
