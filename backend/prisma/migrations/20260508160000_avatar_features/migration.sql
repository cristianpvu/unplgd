-- Slot nou "features" — DiceBear Adventurer expune mustache/blush/birthmark/freckles
-- ca optional layer (featuresProbability + features array). Adaugam FK NOT NULL
-- pe Avatar.featuresItemId; ca sa avem unde sa pointam pe avatarurile existente,
-- inseram ItemType-ul si item-ul "Fara" aici INAINTE sa devina coloana NOT NULL.
-- Seed-ul ulterior face upsert by slug si pastreaza id-urile inserate aici.

INSERT INTO "ItemType" (id, slug, name, "group", "sortOrder")
VALUES ('itype_features_v1', 'features', 'Detalii fata', 'face', 100)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Item" (id, slug, name, feature, level, "sortOrder", "typeId")
VALUES (
  'item_features_fara_v1',
  'f-00',
  'Fara',
  NULL,
  1,
  0,
  (SELECT id FROM "ItemType" WHERE slug = 'features')
)
ON CONFLICT ("slug") DO NOTHING;

ALTER TABLE "Avatar" ADD COLUMN "featuresItemId" TEXT;
UPDATE "Avatar" SET "featuresItemId" = (SELECT id FROM "Item" WHERE slug = 'f-00');
ALTER TABLE "Avatar" ALTER COLUMN "featuresItemId" SET NOT NULL;
ALTER TABLE "Avatar" ADD CONSTRAINT "Avatar_featuresItemId_fkey"
  FOREIGN KEY ("featuresItemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
