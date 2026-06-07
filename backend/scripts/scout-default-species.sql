-- Adauga Scout ca specie de pet DEFAULT (auto-selectata la userii noi).
-- Buddy (vechiul default) ramane ca specie, doar pierde flagul isDefault.
-- Scout copiaza setarile de voce de la vechiul default ca audio-ul sa mearga
-- identic (le poti edita ulterior). NU are story de journey (nu inregistram
-- nicio poveste pe slug-ul 'scout' in mobile), deci cardul de aventura nu apare.
--
-- Ruleaza pe prod:
--   docker compose -f docker-compose.prod.yml exec -T postgres \
--     psql -U unplgd -d unplgd -f - < scripts/scout-default-species.sql

BEGIN;

-- 1) Creeaza Scout daca nu exista, copiind voiceId/systemHint/voce de la
--    vechiul default. Daca exista deja (re-run), nu duplicam.
INSERT INTO "PetSpecies" (
  id, slug, name, "voiceId", "systemHint", "isDefault", "imagePath",
  "soundPath", "shortLore", tone, catchphrases, interests,
  "expertiseDomains", "minAge", "unlockLevel",
  "rvcModelUrl", "rvcPitchShift", "elevenVoiceId"
)
SELECT
  'scout-default-species',
  'scout',
  'Scout',
  d."voiceId",
  d."systemHint",
  false,                       -- setam isDefault dupa, ca sa fie unic
  '/pets/scout.png',
  d."soundPath",
  'Companion cu antene-senzor care simte prietenii din apropiere.',
  'prietenos',
  ARRAY['Hai afara!','Simt un prieten pe-aproape!','Impreuna crestem!']::text[],
  ARRAY[]::text[],
  d."expertiseDomains",
  6,
  1,
  d."rvcModelUrl",
  d."rvcPitchShift",
  d."elevenVoiceId"
FROM "PetSpecies" d
WHERE d."isDefault" = true
ON CONFLICT (slug) DO NOTHING;

-- 2) Scoate flagul de pe toate speciile.
UPDATE "PetSpecies" SET "isDefault" = false WHERE "isDefault" = true;

-- 3) Scout devine singurul default.
UPDATE "PetSpecies" SET "isDefault" = true WHERE slug = 'scout';

COMMIT;

-- Verificare:
--   SELECT slug, name, "isDefault", "imagePath" FROM "PetSpecies" ORDER BY "isDefault" DESC;
