import { createHmac } from 'node:crypto';
import { env } from '../env.js';
import { redis } from './redis.js';

// Token de 8 bytes (16 hex chars) — payload-ul BLE manufacturer data are loc
// limitat (max ~24 bytes utili pe Android), iar 64 bits da coliziune neglijabila
// pentru un grup de cateva mii de useri/zi.
const TOKEN_BYTES = 8;
const TOKEN_HEX_LEN = TOKEN_BYTES * 2;
// 26h ca sa avem o suprapunere mica intre zile (un copil aflat la scoala la 23:55
// nu pierde detectia cand se schimba ziua UTC).
const TOKEN_TTL_SECONDS = 26 * 3600;

function dayKeyUTC(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

function computeToken(userId: string, day: string): string {
  return createHmac('sha256', env.BLE_SECRET)
    .update(`${userId}|${day}`)
    .digest('hex')
    .slice(0, TOKEN_HEX_LEN);
}

const redisKey = (token: string) => `ble:token:${token.toLowerCase()}`;

// Returneaza token-ul de azi pt user, asigurandu-se ca exista in Redis cu TTL.
// Idempotent: re-apelarea in aceeasi zi returneaza acelasi token.
export async function getOrCreateDailyToken(userId: string): Promise<string> {
  const day = dayKeyUTC();
  const token = computeToken(userId, day);
  await redis.set(redisKey(token), userId, 'EX', TOKEN_TTL_SECONDS);
  return token;
}

// Rezolva o lista de token-uri vazute la userId-uri. Token-uri necunoscute
// (expirate sau de la useri non-Unplgd cu acelasi service UUID) sunt omise.
export async function resolveTokens(tokens: string[]): Promise<Map<string, string>> {
  const cleaned = tokens
    .map((t) => t.toLowerCase())
    .filter((t) => /^[0-9a-f]+$/.test(t) && t.length === TOKEN_HEX_LEN);
  if (cleaned.length === 0) return new Map();
  const values = await redis.mget(cleaned.map(redisKey));
  const out = new Map<string, string>();
  for (let i = 0; i < cleaned.length; i++) {
    const userId = values[i];
    const token = cleaned[i];
    if (userId && token) out.set(token, userId);
  }
  return out;
}

export const BLE_TOKEN_HEX_LEN = TOKEN_HEX_LEN;
