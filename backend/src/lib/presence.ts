import { redis } from './redis.js';

// Mutual visibility check pentru anti-cheat co-walk: fiecare user trimite
// heartbeat la backend cu lista prietenilor pe care ii VEDE acum prin BLE.
// Stocam ca SET in Redis cu TTL 90s (mai mare ca interval-ul de heartbeat
// 20-30s, ca sa avem buffer in caz de pierdere de pachet).
//
// Cand A initiaza co-walk cu B, backend-ul verifica: "B a vazut pe A in
// ultimele 90s?". Daca nu → reject. Asa A nu poate primi XP fara sa-si
// fi expus prezenta lui (advertise BLE pornit, app-ul deschis).

const PRESENCE_TTL_SECONDS = 90;
const presenceKey = (userId: string) => `presence:seen:${userId}`;

// Suprascrie complet setul de prieteni vazuti pe acest user. Folosim DEL+SADD
// in pipeline ca sa fie atomic: nu vrem sa pastram peer-i vechi din heartbeat
// anterior daca user-ul deja nu-i mai vede.
export async function markSeen(userId: string, seenUserIds: string[]): Promise<void> {
  const key = presenceKey(userId);
  const pipeline = redis.pipeline();
  pipeline.del(key);
  if (seenUserIds.length > 0) {
    pipeline.sadd(key, seenUserIds);
    pipeline.expire(key, PRESENCE_TTL_SECONDS);
  }
  await pipeline.exec();
}

// Verifica daca viewerId a vazut targetId in ultimele 90s. Folosit la commit
// co-walk: cere ca celalalt user sa fi vazut explicit user-ul curent.
export async function hasSeen(viewerId: string, targetId: string): Promise<boolean> {
  const key = presenceKey(viewerId);
  const result = await redis.sismember(key, targetId);
  return result === 1;
}

// Returneaza setul de userId-uri pe care `userId` i-a vazut recent.
export async function getSeenSet(userId: string): Promise<Set<string>> {
  const key = presenceKey(userId);
  const arr = await redis.smembers(key);
  return new Set(arr);
}

// Batch: din lista de viewerIds, intoarce subsetul care l-au vazut pe targetId
// in ultimele 90s. Folosit la squad co-walk pentru a confirma mutual visibility
// pentru fiecare membru fara N round-trip-uri Redis.
export async function viewersWhoSaw(
  viewerIds: string[],
  targetId: string,
): Promise<Set<string>> {
  if (viewerIds.length === 0) return new Set();
  const pipeline = redis.pipeline();
  for (const v of viewerIds) {
    pipeline.sismember(presenceKey(v), targetId);
  }
  const results = (await pipeline.exec()) ?? [];
  const ok = new Set<string>();
  results.forEach(([_err, val], i) => {
    const id = viewerIds[i];
    if (id && val === 1) ok.add(id);
  });
  return ok;
}
