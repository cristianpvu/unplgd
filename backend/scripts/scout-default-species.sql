-- Adauga Scout ca STARTER gratuit (isDefault=true), auto-selectat la conturi noi.
-- Buddy (vechiul starter) ramane si el isDefault=true → ambele sunt disponibile
-- din start, fara card NFC. Care se auto-echipeaza la cont nou = constanta
-- AUTO_PET_SLUG='scout' din backend/src/lib/pet.ts (nu un flag in DB).
--
-- Scout copiaza setarile de voce de la Buddy ca audio-ul sa mearga identic
-- (le poti edita ulterior). NU are story de journey (nu inregistram nicio
-- poveste pe slug 'scout' in mobile), deci cardul de aventura nu apare.
--
-- Ruleaza pe prod:
--   docker compose -f docker-compose.prod.yml exec -T postgres \
--     psql -U unplgd -d unplgd -f - < scripts/scout-default-species.sql

BEGIN;

-- Creeaza Scout daca nu exista, copiind voiceId/systemHint/voce de la Buddy
-- (starterul existent). isDefault=true → starter. Re-run: nu duplicam.
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
  true,                        -- starter disponibil din start
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
ORDER BY (d.slug = 'buddy') DESC          -- prefera Buddy ca sursa daca exista
LIMIT 1
ON CONFLICT (slug) DO NOTHING;

-- Asiguram ca Scout e starter (idempotent daca rulezi din nou dupa editari).
UPDATE "PetSpecies" SET "isDefault" = true WHERE slug = 'scout';

COMMIT;

-- Verificare (ambele trebuie sa apara cu isDefault=true):
--   SELECT slug, name, "isDefault", "imagePath" FROM "PetSpecies"
--   WHERE "isDefault" = true ORDER BY slug;
