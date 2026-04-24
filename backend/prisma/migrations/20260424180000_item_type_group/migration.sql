-- Adauga `group` pe ItemType pentru a separa tab-urile face vs body in editor.
-- Backfill: 'face' ca default temporar pentru randurile existente; seed-ul
-- ruleaza imediat dupa migrare si suprascrie cu valoarea corecta per tip.
ALTER TABLE "ItemType" ADD COLUMN "group" TEXT NOT NULL DEFAULT 'face';
ALTER TABLE "ItemType" ALTER COLUMN "group" DROP DEFAULT;
