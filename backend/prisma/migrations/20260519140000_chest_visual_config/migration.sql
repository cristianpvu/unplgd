-- Vizual config pe ChestTierConfig: culori, paths catre SVG-uri, cache SVG inline.
ALTER TABLE "ChestTierConfig"
  ADD COLUMN "label"       TEXT,
  ADD COLUMN "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bgColor"     TEXT,
  ADD COLUMN "darkColor"   TEXT,
  ADD COLUMN "fgColor"     TEXT,
  ADD COLUMN "glowColor"   TEXT,
  ADD COLUMN "miniSvgPath" TEXT,
  ADD COLUMN "bodySvgPath" TEXT,
  ADD COLUMN "lidSvgPath"  TEXT,
  ADD COLUMN "miniSvg"     TEXT,
  ADD COLUMN "bodySvg"     TEXT,
  ADD COLUMN "lidSvg"      TEXT;
