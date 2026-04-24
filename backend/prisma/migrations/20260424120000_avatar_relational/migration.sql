-- Catalog avatar trecut din JSON in tabele relationale.
-- DEV ONLY: stergem avatarurile existente (FK-urile noi sunt NOT NULL si nu
-- avem date sa migram). Userii primesc avatar default la urmatorul GET.

DELETE FROM "Avatar";

-- DropColumn
ALTER TABLE "Avatar" DROP COLUMN "picks";
ALTER TABLE "Avatar" DROP COLUMN "catalogVersion";

-- CreateTable
CREATE TABLE "ItemType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ItemType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemType_slug_key" ON "ItemType"("slug");

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "feature" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Item_slug_key" ON "Item"("slug");
CREATE INDEX "Item_typeId_sortOrder_idx" ON "Item"("typeId", "sortOrder");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ItemType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddColumn (cele 14 FK-uri pe Avatar)
ALTER TABLE "Avatar" ADD COLUMN "skinItemId"      TEXT NOT NULL;
ALTER TABLE "Avatar" ADD COLUMN "hairColorItemId" TEXT NOT NULL;
ALTER TABLE "Avatar" ADD COLUMN "hairItemId"      TEXT NOT NULL;
ALTER TABLE "Avatar" ADD COLUMN "eyesItemId"      TEXT NOT NULL;
ALTER TABLE "Avatar" ADD COLUMN "mouthItemId"     TEXT NOT NULL;
ALTER TABLE "Avatar" ADD COLUMN "eyebrowsItemId"  TEXT NOT NULL;
ALTER TABLE "Avatar" ADD COLUMN "glassesItemId"   TEXT NOT NULL;
ALTER TABLE "Avatar" ADD COLUMN "earringsItemId"  TEXT NOT NULL;
ALTER TABLE "Avatar" ADD COLUMN "bodyShapeItemId" TEXT NOT NULL;
ALTER TABLE "Avatar" ADD COLUMN "topItemId"       TEXT NOT NULL;
ALTER TABLE "Avatar" ADD COLUMN "outerwearItemId" TEXT NOT NULL;
ALTER TABLE "Avatar" ADD COLUMN "bottomItemId"    TEXT NOT NULL;
ALTER TABLE "Avatar" ADD COLUMN "footwearItemId"  TEXT NOT NULL;
ALTER TABLE "Avatar" ADD COLUMN "holdingItemId"   TEXT NOT NULL;

-- AddForeignKey (cate o constrangere per slot, RESTRICT ca sa nu se stearga
-- accidental un Item folosit in catalog cat timp cineva il are echipat)
ALTER TABLE "Avatar" ADD CONSTRAINT "Avatar_skinItemId_fkey"      FOREIGN KEY ("skinItemId")      REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Avatar" ADD CONSTRAINT "Avatar_hairColorItemId_fkey" FOREIGN KEY ("hairColorItemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Avatar" ADD CONSTRAINT "Avatar_hairItemId_fkey"      FOREIGN KEY ("hairItemId")      REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Avatar" ADD CONSTRAINT "Avatar_eyesItemId_fkey"      FOREIGN KEY ("eyesItemId")      REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Avatar" ADD CONSTRAINT "Avatar_mouthItemId_fkey"     FOREIGN KEY ("mouthItemId")     REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Avatar" ADD CONSTRAINT "Avatar_eyebrowsItemId_fkey"  FOREIGN KEY ("eyebrowsItemId")  REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Avatar" ADD CONSTRAINT "Avatar_glassesItemId_fkey"   FOREIGN KEY ("glassesItemId")   REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Avatar" ADD CONSTRAINT "Avatar_earringsItemId_fkey"  FOREIGN KEY ("earringsItemId")  REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Avatar" ADD CONSTRAINT "Avatar_bodyShapeItemId_fkey" FOREIGN KEY ("bodyShapeItemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Avatar" ADD CONSTRAINT "Avatar_topItemId_fkey"       FOREIGN KEY ("topItemId")       REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Avatar" ADD CONSTRAINT "Avatar_outerwearItemId_fkey" FOREIGN KEY ("outerwearItemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Avatar" ADD CONSTRAINT "Avatar_bottomItemId_fkey"    FOREIGN KEY ("bottomItemId")    REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Avatar" ADD CONSTRAINT "Avatar_footwearItemId_fkey"  FOREIGN KEY ("footwearItemId")  REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Avatar" ADD CONSTRAINT "Avatar_holdingItemId_fkey"   FOREIGN KEY ("holdingItemId")   REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
