#!/usr/bin/env bash
# Smoke test end-to-end pt feature-ul de co-creatii.
# Ruleaza pe VPS-ul prod (sau orice masina cu acces la docker postgres + curl).
#
# Pasii:
#  1. Inregistreaza 2 useri test (A, B) cu email-uri unice
#  2. A trimite friend request catre B (auto-accept, vezi friends.ts)
#  3. Creeaza o poveste pt A direct in DB (bypass chat conversational)
#  4. A porneste sesiune co-creatie cu B + povestea
#  5. A trimite poza (path la fisier, primit ca prim argument)
#  6. Polling pe status pana la COMPLETED / REJECTED / FAILED
#
# Usage:
#   ./cocreation-smoke.sh /cale/spre/desen.jpg
#
# Env vars:
#   API           - default https://api-unplgd.dinedroid.com
#   PG_CONTAINER  - default unplgd_postgres_prod
#   POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB - din .env-ul de prod

set -euo pipefail

API="${API:-https://api-unplgd.dinedroid.com}"
PG_CONTAINER="${PG_CONTAINER:-unplgd_postgres_prod}"
IMAGE_PATH="${1:-}"

if [[ -z "$IMAGE_PATH" ]]; then
  echo "ERROR: lipseste path-ul catre o imagine de test." >&2
  echo "  usage: $0 /cale/spre/desen.jpg" >&2
  exit 1
fi
if [[ ! -f "$IMAGE_PATH" ]]; then
  echo "ERROR: nu gasesc fisierul: $IMAGE_PATH" >&2
  exit 1
fi

# Detect mime type din extensie (file --mime-type ar fi mai robust dar nu-i mereu instalat)
case "${IMAGE_PATH,,}" in
  *.jpg|*.jpeg) MIME="image/jpeg" ;;
  *.png)        MIME="image/png" ;;
  *.webp)       MIME="image/webp" ;;
  *) echo "ERROR: extensie nesuportata. Folosesc .jpg/.png/.webp" >&2; exit 1 ;;
esac

# Carca .env din directorul curent daca exista (POSTGRES_*)
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${POSTGRES_USER:?POSTGRES_USER not set (source .env intai)}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD not set}"
: "${POSTGRES_DB:?POSTGRES_DB not set}"

command -v jq >/dev/null || { echo "ERROR: jq nu e instalat. apt install jq" >&2; exit 1; }
command -v curl >/dev/null || { echo "ERROR: curl nu e instalat" >&2; exit 1; }
command -v base64 >/dev/null || { echo "ERROR: base64 nu e instalat" >&2; exit 1; }

# Helper API call cu eroare colorata
api() {
  local out
  out=$(curl -sS "$@")
  echo "$out"
}

step() { echo -e "\n\033[1;34m== $* ==\033[0m"; }
ok()   { echo -e "\033[1;32mOK\033[0m $*"; }
fail() { echo -e "\033[1;31mFAIL\033[0m $*" >&2; exit 1; }

TS=$(date +%s)
EMAIL_A="cocreate-a-${TS}@smoke.local"
EMAIL_B="cocreate-b-${TS}@smoke.local"
PASSWORD="smoke12345"

step "1. Inregistrez user A: $EMAIL_A"
REG_A=$(api -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL_A\",\"password\":\"$PASSWORD\",\"name\":\"Smoke A\",\"birthDate\":\"2015-01-01\"}")
TOKEN_A=$(echo "$REG_A" | jq -r '.token // empty')
USER_A=$(echo "$REG_A" | jq -r '.user.id // empty')
[[ -n "$TOKEN_A" && -n "$USER_A" ]] || fail "Register A: $REG_A"
ok "USER_A=$USER_A"

step "2. Inregistrez user B: $EMAIL_B"
REG_B=$(api -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL_B\",\"password\":\"$PASSWORD\",\"name\":\"Smoke B\",\"birthDate\":\"2015-01-01\"}")
TOKEN_B=$(echo "$REG_B" | jq -r '.token // empty')
USER_B=$(echo "$REG_B" | jq -r '.user.id // empty')
[[ -n "$TOKEN_B" && -n "$USER_B" ]] || fail "Register B: $REG_B"
ok "USER_B=$USER_B"

step "3. A adauga prieten B (auto-accept)"
FR=$(api -X POST "$API/friends" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d "{\"friendUserId\":\"$USER_B\",\"method\":\"manual\"}")
FR_ID=$(echo "$FR" | jq -r '.friendship.id // empty')
[[ -n "$FR_ID" ]] || fail "Friendship: $FR"
ok "FRIENDSHIP=$FR_ID"

step "4. Creez poveste pt A direct in DB"
STORY_TITLE="Dragonul albastru smoke"
STORY_BODY="A fost odata un dragon albastru pe nume Aldo, care traia intr-o pestera de gheata. Avea aripi argintii si lasa urme stralucitoare cand zbura. Intr-o zi a intalnit un copil curajos si au devenit prieteni."
STORY_ID=$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$PG_CONTAINER" \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "
    INSERT INTO \"Story\" (id, \"authorId\", title, body, \"keyFacts\")
    VALUES (
      gen_random_uuid()::text,
      '$USER_A',
      '$STORY_TITLE',
      '$STORY_BODY',
      '[]'::jsonb
    )
    RETURNING id;
  ")
[[ -n "$STORY_ID" ]] || fail "Insert story esuat"
ok "STORY=$STORY_ID"

step "5. A porneste sesiune co-creatie"
COC=$(api -X POST "$API/co-creations/start" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d "{\"friendId\":\"$USER_B\",\"storyId\":\"$STORY_ID\"}")
COC_ID=$(echo "$COC" | jq -r '.id // empty')
[[ -n "$COC_ID" ]] || fail "Start: $COC"
ok "COCREATION=$COC_ID"

step "6. Encode + upload poza ($IMAGE_PATH, $MIME)"
B64=$(base64 -w0 < "$IMAGE_PATH")
SUBMIT_BODY=$(jq -n --arg img "$B64" --arg mime "$MIME" '{image: $img, mimeType: $mime}')
SUBMIT=$(api -X POST "$API/co-creations/$COC_ID/submit" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d "$SUBMIT_BODY")
SUBMIT_STATUS=$(echo "$SUBMIT" | jq -r '.status // empty')
[[ "$SUBMIT_STATUS" == "PROCESSING" ]] || fail "Submit nu a returnat PROCESSING: $SUBMIT"
ok "Submit OK, pipeline async pornit"

step "7. Polling status (max 2 min)"
for i in $(seq 1 60); do
  STATE=$(api -H "Authorization: Bearer $TOKEN_A" "$API/co-creations/$COC_ID")
  STATUS=$(echo "$STATE" | jq -r '.status // empty')
  printf '\r[%2d/60] %s    ' "$i" "$STATUS"
  case "$STATUS" in
    COMPLETED|REJECTED|FAILED)
      echo
      echo "$STATE" | jq .
      if [[ "$STATUS" == "COMPLETED" ]]; then
        ok "Pipeline complet! Vezi originalImageUrl + aiImageUrl in JSON-ul de mai sus."
      else
        fail "Status final: $STATUS — vezi aiFeedback pt motiv."
      fi
      exit 0
      ;;
  esac
  sleep 2
done

echo
fail "TIMEOUT dupa 2 min — verifica logurile cu: docker logs unplgd_backend --tail 100"
