import { redis } from '../redis.js';
import { randomUUID } from 'node:crypto';

// Cluster session = grup de 2+ prieteni mutual vizibili prin BLE care merg
// impreuna. Fiecare membru are propriul `joinedAt` (cand a fost atras in
// sesiune) si propriul timer de 10min. Sursa de adevar = backend; mobile-ul
// doar afiseaza ce primeste prin socket.
//
// Persistenta: Redis. O sesiune e un JSON blob cu key `cowalk:s:<id>`,
// indexata invers cu key per-user `cowalk:u:<userId>` → sessionId. TTL hard
// 4h (cap absolut, oricat de mult ar merge utilizatorii). Drop fin per
// participant la GRACE_MS de la ultimul confirm.

const SESSION_TTL_SECONDS = 4 * 60 * 60;

export const PARTICIPANT_GRACE_MS = 90_000;
export const COWALK_MIN_DURATION_MS = 10 * 60 * 1000;
export const COWALK_MIN_STEPS = 200;
export const COWALK_MIN_RSSI_STDDEV_DBM = 1.5;
export const COWALK_MIN_RSSI_SAMPLES = 30;
export const RSSI_SAMPLES_CAP = 1200;

export type Participant = {
  userId: string;
  joinedAt: number;
  lastConfirmedAt: number;
  steps: number;
  rssiSamples: number[];
  awarded: boolean;
};

export type Session = {
  id: string;
  startedAt: number;
  participants: Record<string, Participant>;
};

const sKey = (id: string) => `cowalk:s:${id}`;
const uKey = (userId: string) => `cowalk:u:${userId}`;

export async function getSessionForUser(userId: string): Promise<Session | null> {
  const sid = await redis.get(uKey(userId));
  if (!sid) return null;
  return getSession(sid);
}

export async function getSession(id: string): Promise<Session | null> {
  const json = await redis.get(sKey(id));
  if (!json) return null;
  try {
    return JSON.parse(json) as Session;
  } catch {
    return null;
  }
}

async function persist(s: Session): Promise<void> {
  await redis.set(sKey(s.id), JSON.stringify(s), 'EX', SESSION_TTL_SECONDS);
}

async function destroy(sessionId: string, participantIds: string[]): Promise<void> {
  const p = redis.pipeline();
  p.del(sKey(sessionId));
  for (const uid of participantIds) p.del(uKey(uid));
  await p.exec();
}

function newParticipant(userId: string, now: number): Participant {
  return {
    userId,
    joinedAt: now,
    lastConfirmedAt: now,
    steps: 0,
    rssiSamples: [],
    awarded: false,
  };
}

// Toate evenimentele isi cara propriul `recipients` (lista de userId-uri
// catre care socket-ul livreaza event-ul). Logica de audience traieste
// langa state machine — caller-ul (route handler) doar pasa la emit.
export type SyncEvent = { recipients: string[] } & (
  | {
      type: 'started';
      sessionId: string;
      startedAt: number;
      participants: Participant[];
    }
  | { type: 'joined'; sessionId: string; participant: Participant; participants: Participant[] }
  | {
      type: 'left';
      sessionId: string;
      userId: string;
      remaining: Participant[];
    }
  | { type: 'ended'; sessionId: string }
  | {
      type: 'completed';
      sessionId: string;
      userId: string;
      durationSec: number;
      squadSize: number;
    }
);

export type AwardFn = (args: {
  sessionId: string;
  userId: string;
  peerIds: string[];
  durationSec: number;
  steps: number;
  rssiStdDev: number;
  squadSize: number;
  startedAt: number;
}) => Promise<void>;

// Sync session state pentru `userId` dupa un heartbeat.
// `mutualPeerIds` = prietenii pe care `userId` ii vede SI care il vad pe el.
// Toate evenimentele rezultate trebuie emise prin socket de catre caller.
export async function tickHeartbeat(
  userId: string,
  mutualPeerIds: string[],
  now: number,
  award: AwardFn,
): Promise<{ events: SyncEvent[]; session: Session | null }> {
  const events: SyncEvent[] = [];
  let session = await getSessionForUser(userId);

  // Step 1: pair-up cu fiecare peer mutual.
  for (const peerId of mutualPeerIds) {
    const peerSessionId = await redis.get(uKey(peerId));

    if (!session && !peerSessionId) {
      // Niciunul nu are sesiune → cream una noua cu ambii.
      const fresh: Session = {
        id: randomUUID(),
        startedAt: now,
        participants: {
          [userId]: newParticipant(userId, now),
          [peerId]: newParticipant(peerId, now),
        },
      };
      session = fresh;
      await Promise.all([
        redis.set(uKey(userId), fresh.id, 'EX', SESSION_TTL_SECONDS),
        redis.set(uKey(peerId), fresh.id, 'EX', SESSION_TTL_SECONDS),
        persist(fresh),
      ]);
      events.push({
        type: 'started',
        sessionId: fresh.id,
        startedAt: fresh.startedAt,
        participants: Object.values(fresh.participants),
        recipients: [userId, peerId],
      });
    } else if (session && !peerSessionId) {
      // Peer-ul intra in sesiunea mea cu joinedAt = now.
      if (!session.participants[peerId]) {
        const p = newParticipant(peerId, now);
        session.participants[peerId] = p;
        await Promise.all([
          redis.set(uKey(peerId), session.id, 'EX', SESSION_TTL_SECONDS),
          persist(session),
        ]);
        events.push({
          type: 'joined',
          sessionId: session.id,
          participant: p,
          participants: Object.values(session.participants),
          recipients: Object.keys(session.participants),
        });
      }
    } else if (!session && peerSessionId) {
      // Eu intru in sesiunea peer-ului.
      const peerSession = await getSession(peerSessionId);
      if (peerSession) {
        if (!peerSession.participants[userId]) {
          const p = newParticipant(userId, now);
          peerSession.participants[userId] = p;
          events.push({
            type: 'joined',
            sessionId: peerSession.id,
            participant: p,
            participants: Object.values(peerSession.participants),
            recipients: Object.keys(peerSession.participants),
          });
        }
        session = peerSession;
        await Promise.all([
          redis.set(uKey(userId), session.id, 'EX', SESSION_TTL_SECONDS),
          persist(session),
        ]);
      }
    } else if (session && peerSessionId === session.id) {
      // Aceeasi sesiune → bump confirms pe ambii.
      if (session.participants[userId]) session.participants[userId].lastConfirmedAt = now;
      if (session.participants[peerId]) session.participants[peerId].lastConfirmedAt = now;
    }
    // Sesiuni diferite → nu facem merge (complexitate de evitat in MVP). Cea
    // care se termina prima elibereaza userul, apoi pe heartbeat-ul urmator
    // se alipeste celeilalte.
  }

  if (!session) return { events, session: null };

  // Step 2: confirm self chiar daca acest tick n-a adus pair-uri noi.
  if (session.participants[userId]) {
    session.participants[userId].lastConfirmedAt = now;
  }

  // Step 3: drop stale participants (nu mai au mutual visibility cu nimeni).
  // Snapshot recipients ÎNAINTE de drop ca event-ul `left` sa ajunga si la
  // cel care iese (asa stie sa-si curete UI-ul) si la cei care raman.
  const beforeDropIds = Object.keys(session.participants);
  const droppedIds: string[] = [];
  for (const [pid, p] of Object.entries(session.participants)) {
    if (now - p.lastConfirmedAt > PARTICIPANT_GRACE_MS) droppedIds.push(pid);
  }
  if (droppedIds.length > 0) {
    const pipeline = redis.pipeline();
    for (const pid of droppedIds) {
      delete session.participants[pid];
      pipeline.del(uKey(pid));
      events.push({
        type: 'left',
        sessionId: session.id,
        userId: pid,
        remaining: Object.values(session.participants),
        recipients: beforeDropIds,
      });
    }
    await pipeline.exec();
  }

  // Step 4: daca ramane sub 2, sesiunea se incheie (un singur user nu mai e
  // co-walk). Trimitem `ended` la toti cei care erau in sesiune inainte de
  // destroy ca sa-si curete UI-ul.
  if (Object.keys(session.participants).length < 2) {
    const finalIds = Object.keys(session.participants);
    await destroy(session.id, finalIds);
    events.push({
      type: 'ended',
      sessionId: session.id,
      recipients: [...new Set([...beforeDropIds, ...finalIds])],
    });
    return { events, session: null };
  }

  // Step 5: cine a strans 10min + indeplineste anti-cheat → award.
  const activeIds = Object.keys(session.participants);
  for (const p of Object.values(session.participants)) {
    if (p.awarded) continue;
    if (now - p.joinedAt < COWALK_MIN_DURATION_MS) continue;
    if (p.steps < COWALK_MIN_STEPS) continue;
    if (p.rssiSamples.length < COWALK_MIN_RSSI_SAMPLES) continue;
    const std = stdDev(p.rssiSamples);
    if (std < COWALK_MIN_RSSI_STDDEV_DBM) continue;

    const peerIds = activeIds.filter((id) => id !== p.userId);
    const durationSec = Math.floor((now - p.joinedAt) / 1000);
    const squadSize = activeIds.length;
    try {
      await award({
        sessionId: session.id,
        userId: p.userId,
        peerIds,
        durationSec,
        steps: p.steps,
        rssiStdDev: std,
        squadSize,
        startedAt: p.joinedAt,
      });
      p.awarded = true;
      events.push({
        type: 'completed',
        sessionId: session.id,
        userId: p.userId,
        durationSec,
        squadSize,
        // Anuntam toti membrii activi: cel care a luat XP afla pt confeti,
        // ceilalti vad pe progress card un mesaj "X a primit XP".
        recipients: activeIds,
      });
    } catch {
      // best-effort: la urmatorul tick reincercam.
    }
  }

  await persist(session);
  return { events, session };
}

// Acumuleaza pasi + RSSI samples pentru un user din sesiunea curenta. Mobile-ul
// trimite incremental prin socket.io `cowalk:report`.
export async function recordReport(
  userId: string,
  stepsTotal: number,
  rssiSamples: number[],
): Promise<Session | null> {
  const session = await getSessionForUser(userId);
  if (!session) return null;
  const p = session.participants[userId];
  if (!p) return null;
  // Steps total e cumulativ de la session start (mobile tracker → joinedAt
  // delta). Luam max ca sa fie idempotent la retry-uri / reconnect-uri.
  p.steps = Math.max(p.steps, stepsTotal);
  for (const s of rssiSamples) p.rssiSamples.push(s);
  if (p.rssiSamples.length > RSSI_SAMPLES_CAP) {
    p.rssiSamples = p.rssiSamples.slice(-RSSI_SAMPLES_CAP);
  }
  await persist(session);
  return session;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
