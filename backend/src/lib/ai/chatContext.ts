import { redis } from '../redis.js';

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

const TTL_SECONDS = 60 * 60; // 1h — chat-ul de poveste nu trebuie sa traiasca mult
const MAX_TURNS = 30;        // protectie context window — la 30 ture e mult prea lung oricum

/**
 * Stocheaza istoricul unui chat (creare poveste sau verify) in Redis ca lista
 * de turn-uri. Cheia identifica scope-ul (story:create:{userId} sau
 * story:verify:{claimId}) — owner-ship verificat in handler, redis stocheaza
 * doar continutul.
 */
export async function loadChatHistory(key: string): Promise<ChatTurn[]> {
  const raw = await redis.lrange(key, 0, -1);
  return raw.map((s) => JSON.parse(s) as ChatTurn);
}

export async function appendChatTurn(key: string, turn: ChatTurn) {
  await redis.rpush(key, JSON.stringify(turn));
  await redis.ltrim(key, -MAX_TURNS, -1);
  await redis.expire(key, TTL_SECONDS);
}

export async function clearChatHistory(key: string) {
  await redis.del(key);
}
