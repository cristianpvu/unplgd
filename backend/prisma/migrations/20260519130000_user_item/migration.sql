-- Tabel UserItem: ownership persistat pe iteme.
CREATE TABLE "UserItem" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "itemId"     TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source"     TEXT NOT NULL,
    CONSTRAINT "UserItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserItem_userId_itemId_key" ON "UserItem"("userId", "itemId");
CREATE INDEX "UserItem_userId_idx" ON "UserItem"("userId");

ALTER TABLE "UserItem"
  ADD CONSTRAINT "UserItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserItem"
  ADD CONSTRAINT "UserItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill in TypeScript via seed.ts (vezi backfillUserItems()).
-- Migratia creeaza doar schema; seed-ul ruleaza idempotent la fiecare container
-- start si insera randuri pentru avataruri existente + cufere deschise.
