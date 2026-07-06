-- Hunt: intrare in lobby doar cu bratara NFC (copil fara telefon).
-- viaBracelet marcheaza membrii care nu pot fi alesi lideri de echipa.
ALTER TABLE "HuntLobbyMember" ADD COLUMN "viaBracelet" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HuntTeamMember" ADD COLUMN "viaBracelet" BOOLEAN NOT NULL DEFAULT false;
