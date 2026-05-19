#!/usr/bin/env bash
# Acorda chesturi de test unui user. Ruleaza direct pe server fara rebuild:
#   bash scripts/grant-test-chests.sh office@dinedroid.com
#
# Logica: pentru fiecare tier, insereaza 2 chesturi cu loot brut (xpBase + 0
# pana la itemCount iteme random din pool, dependent de itemDropChance).
# `reclassifyLoot()` din openChest se ocupa de duplicate la deschidere.
set -euo pipefail

EMAIL="${1:-office@dinedroid.com}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DB_USER="${DB_USER:-unplgd}"
DB_NAME="${DB_NAME:-unplgd}"

PSQL=(docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -t -A)

USER_ID="$("${PSQL[@]}" -c "SELECT id FROM \"User\" WHERE email = '$EMAIL' LIMIT 1;")"
USER_ID="${USER_ID//[$'\t\r\n ']}"
if [[ -z "$USER_ID" ]]; then
  echo "User cu email '$EMAIL' nu exista"
  exit 1
fi
echo "Target user: $EMAIL ($USER_ID)"

# Acorda 2 chesturi per tier (12 total). Pentru fiecare:
# - Citeste config-ul din DB
# - Selecteaza random `itemCount` iteme din pool care trec dice roll pe
#   `itemDropChance`
# - Construieste lootJson cu xpBase + iteme alese
# - Insereaza Chest cu sourceType='qa_test'
"${PSQL[@]}" <<SQL
DO \$\$
DECLARE
  t          TEXT;
  tiers      TEXT[] := ARRAY['BRONZE','SILVER','GOLD','PLATINUM','DIAMOND','CHAMPION'];
  cfg        RECORD;
  i          INT;
  slot       INT;
  rolled     JSONB;
  rolled_items JSONB := '[]'::jsonb;
  pool       JSONB;
  pick       JSONB;
  guaranteed_total INT;
  loot       JSONB;
BEGIN
  FOREACH t IN ARRAY tiers LOOP
    SELECT * INTO cfg FROM "ChestTierConfig" WHERE tier = t::"ChestTier";
    IF cfg IS NULL THEN
      RAISE NOTICE 'skip %, config lipseste', t;
      CONTINUE;
    END IF;

    -- 2 chesturi per tier
    FOR i IN 1..2 LOOP
      rolled_items := '[]'::jsonb;
      guaranteed_total := cfg."guaranteedEpic" + cfg."guaranteedLegendary";

      -- Loot garantat: legendary
      FOR slot IN 1..cfg."guaranteedLegendary" LOOP
        SELECT jsonb_build_object('itemId', id, 'slug', slug, 'name', name, 'rarity', rarity)
          INTO pick
          FROM "Item"
         WHERE "attachmentPoint" IS NOT NULL
           AND feature IS NOT NULL
           AND rarity = 'LEGENDARY'
           AND NOT exclusive
         ORDER BY random()
         LIMIT 1;
        IF pick IS NOT NULL THEN rolled_items := rolled_items || pick; END IF;
      END LOOP;

      -- Loot garantat: epic
      FOR slot IN 1..cfg."guaranteedEpic" LOOP
        SELECT jsonb_build_object('itemId', id, 'slug', slug, 'name', name, 'rarity', rarity)
          INTO pick
          FROM "Item"
         WHERE "attachmentPoint" IS NOT NULL
           AND feature IS NOT NULL
           AND rarity = 'EPIC'
         ORDER BY random()
         LIMIT 1;
        IF pick IS NOT NULL THEN rolled_items := rolled_items || pick; END IF;
      END LOOP;

      -- Slot-uri rolled cu drop chance + weighted rarity
      FOR slot IN 1..(cfg."itemCount" - guaranteed_total) LOOP
        -- Dice roll pe drop chance
        IF random() * 100 >= cfg."itemDropChance" THEN
          CONTINUE;
        END IF;
        -- Pick rarity weighted (simplificat: alegem rarity pe sansa cumulativa)
        DECLARE
          r REAL := random() * (cfg."weightCommon" + cfg."weightRare" + cfg."weightEpic" + cfg."weightLegendary");
          target_rarity TEXT;
        BEGIN
          IF r < cfg."weightCommon" THEN target_rarity := 'COMMON';
          ELSIF r < cfg."weightCommon" + cfg."weightRare" THEN target_rarity := 'RARE';
          ELSIF r < cfg."weightCommon" + cfg."weightRare" + cfg."weightEpic" THEN target_rarity := 'EPIC';
          ELSE target_rarity := 'LEGENDARY';
          END IF;

          SELECT jsonb_build_object('itemId', id, 'slug', slug, 'name', name, 'rarity', rarity)
            INTO pick
            FROM "Item"
           WHERE "attachmentPoint" IS NOT NULL
             AND feature IS NOT NULL
             AND rarity = target_rarity::"Rarity"
             AND (rarity != 'LEGENDARY' OR NOT exclusive)
           ORDER BY random()
           LIMIT 1;
          IF pick IS NOT NULL THEN rolled_items := rolled_items || pick; END IF;
        END;
      END LOOP;

      loot := jsonb_build_object(
        'xp', cfg."xpBase",
        'items', rolled_items,
        'duplicates', '[]'::jsonb
      );

      INSERT INTO "Chest" (id, "userId", tier, "sourceType", "lootJson", "createdAt")
      VALUES (gen_random_uuid()::text, '$USER_ID', t::"ChestTier", 'qa_test', loot, NOW());

      RAISE NOTICE 'granted % %: xp=%, items=%', t, i, cfg."xpBase", jsonb_array_length(rolled_items);
    END LOOP;
  END LOOP;
END;
\$\$;
SQL

echo ""
echo "Done. Chesturi acordate pe $EMAIL. Verifica:"
echo "  ${PSQL[*]} -c \"SELECT tier, COUNT(*) FROM \\\"Chest\\\" WHERE \\\"userId\\\" = '$USER_ID' AND \\\"openedAt\\\" IS NULL GROUP BY tier ORDER BY tier;\""
