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
const LEFT_GUARD_TTL_SECONDS = 120;
const leftGuardKey = (userId: string) => `cowalk:left:${userId}`;

export async function isLeftRecently(userId: string): Promise<boolean> {
  return (await redis.exists(leftGuardKey(userId))) === 1;
}

export async function filterRecentlyLeft(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const pipeline = redis.pipeline();
  for (const id of userIds) pipeline.exists(leftGuardKey(id));
  const results = (await pipeline.exec()) ?? [];
  const guarded = new Set<string>();
  results.forEach(([_err, val], i) => {
    const id = userIds[i];
    if (id && val === 1) guarded.add(id);
  });
  return guarded;
}

export const PARTICIPANT_GRACE_MS = 90_000;
export const COWALK_MIN_DURATION_MS = 10 * 60 * 1000;
export const COWALK_MIN_STEPS = 100;
export const COWALK_MIN_RSSI_STDDEV_DBM = 1.5;
export const COWALK_MIN_RSSI_SAMPLES = 30;
export const RSSI_SAMPLES_CAP = 1200;
export const COWALK_FAIL_GRACE_MS = 60_000;


export const COWALK_EARLY_CHECK_MS = 5 * 60 * 1000;
export const COWALK_EARLY_MIN_STEPS = 25;

// XP escaladator dupa primul award (la 10 min). User-ul primeste XP/minut
// pe paliere. Cap la palierul 4 (15 XP/min) — peste 30 min sesiunile sunt
// gratificate la rata maxima dar fara inflatie suplimentara.
export const COWALK_XP_TICK_INTERVAL_MS = 60 * 1000;
export const COWALK_XP_TIERS = [
  { rate: 0 }, //  0-10 min: baseline award la 10 min via XP_REWARDS.CO_WALK
  { rate: 5 }, // 10-20 min: +5 XP/min
  { rate: 10 }, // 20-30 min: +10 XP/min
  { rate: 15 }, // 30+ min: +15 XP/min (cap)
] as const;

export function xpTierForElapsed(effectiveElapsed: number): { rate: number; tier: number } {
  const minutes = Math.floor(effectiveElapsed / 60_000);
  const tierIdx = Math.min(Math.floor(minutes / 10), COWALK_XP_TIERS.length - 1);
  return { rate: COWALK_XP_TIERS[tierIdx]!.rate, tier: tierIdx };
}

export type CowalkFailReason = 'steps' | 'rssi_static' | 'rssi_samples';

// Smart resume: cat poate sa fie absent un participant intr-o singura pauza
// (apel, mesaj scurt, ecran intrat in background) inainte ca sesiunea sa fie
// pierduta definitiv. Si cat poate cumula pe toata sesiunea — apele multiple
// permise dar nu spalt nelimitat.
export const ABSENT_MAX_SINGLE_MS = 3 * 60 * 1000;
export const ABSENT_MAX_TOTAL_MS = 5 * 60 * 1000;

export type Participant = {
  userId: string;
  joinedAt: number;
  lastConfirmedAt: number;
  steps: number;
  rssiSamples: number[];
  awarded: boolean;
  // Suma timpilor petrecuti "paused" (BLE invisible / app in background).
  // Scade din durata efectiva la award (anti-cheat: nu poti pacali pragul de
  // 10 min stand departe).
  totalPausedMs: number;
  // Ultimul minut absolut (1-indexed, dupa effectiveJoinedAt) pentru care am
  // acordat XP-tick. 0 = inca nu am intrat in faza de tick (sub 10 min sau
  // baseline necastigat). 10 = baseline acordat, nu inca tick-uri. >10 =
  // tick-uri acumulate.
  lastTickXpMinute: number;
  // Suma XP acordat in tick-uri (exclude baseline). Folosit de UI sa afiseze
  // un contor "XP din co-walk: 42" langa avatar.
  totalTickXp: number;
};

// Un participant pausat pastreaza tot state-ul Participant (joinedAt, steps,
// rssiSamples) + momentul cand a inceput pauza curenta. La resume revine in
// `participants` cu totalPausedMs actualizat.
export type PausedParticipant = Participant & {
  pausedAt: number;
};

export type Session = {
  id: string;
  startedAt: number;
  participants: Record<string, Participant>;
  // Membri care temporar nu sunt mutual vizibili. Pe heartbeat-ul urmator in
  // care reapar (in fereastra de absenta admisibila), ii reluam in participants.
  pausedParticipants?: Record<string, PausedParticipant>;
};

// Duraate efectiva acumulata in sesiune (exclude paused gaps). Folosita pentru
// progresul afisat la client si pentru pragul anti-cheat.
export function effectiveJoinedAt(p: Participant): number {
  return p.joinedAt + (p.totalPausedMs ?? 0);
}

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
    totalPausedMs: 0,
    lastTickXpMinute: 0,
    totalTickXp: 0,
  };
}

// Muta un participant activ in pausedParticipants. Folosit la:
//  - leaveSession (pausable=true): user-ul a apasat "Pauza" sau focus mode a
//    detectat background.
//  - drop stale in tick: nu mai vedem mutual visibility (BLE off, telefon in
//    buzunar pierde scan).
function pauseParticipant(session: Session, userId: string, now: number): void {
  const p = session.participants[userId];
  if (!p) return;
  delete session.participants[userId];
  if (!session.pausedParticipants) session.pausedParticipants = {};
  session.pausedParticipants[userId] = { ...p, pausedAt: now };
}

// Incearca sa readuca user-ul din pausedParticipants in participants.
// Returneaza true daca reusit (resume valid), false daca pauza a depasit
// ABSENT_MAX_SINGLE_MS sau ABSENT_MAX_TOTAL_MS — in acel caz ghost-ul e
// curatat si caller-ul trebuie sa creeze participant nou de la zero.
function tryResumeParticipant(session: Session, userId: string, now: number): boolean {
  const ghost = session.pausedParticipants?.[userId];
  if (!ghost) return false;
  const sincePause = now - ghost.pausedAt;
  const newTotalPaused = ghost.totalPausedMs + sincePause;
  if (sincePause > ABSENT_MAX_SINGLE_MS || newTotalPaused > ABSENT_MAX_TOTAL_MS) {
    delete session.pausedParticipants![userId];
    return false;
  }
  const { pausedAt: _pausedAt, ...rest } = ghost;
  session.participants[userId] = {
    ...rest,
    lastConfirmedAt: now,
    totalPausedMs: newTotalPaused,
  };
  delete session.pausedParticipants![userId];
  return true;
}

// Curata ghost-urile expirate (pauza singulara > 3min) la inceputul fiecarui
// tick. Asa nu raman fantome in sesiune dupa ce userii au plecat efectiv.
function expirePausedParticipants(session: Session, now: number): string[] {
  const expired: string[] = [];
  if (!session.pausedParticipants) return expired;
  for (const [uid, g] of Object.entries(session.pausedParticipants)) {
    if (now - g.pausedAt > ABSENT_MAX_SINGLE_MS) expired.push(uid);
  }
  for (const uid of expired) delete session.pausedParticipants![uid];
  return expired;
}

function totalSessionPopulation(session: Session): number {
  return (
    Object.keys(session.participants).length +
    Object.keys(session.pausedParticipants ?? {}).length
  );
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
  | {
      type: 'failed';
      sessionId: string;
      userId: string;
      reason: CowalkFailReason;
      steps: number;
      stepsRequired: number;
      rssiSamples: number;
      rssiStdDev: number;
    }
  | {
      type: 'tick';
      sessionId: string;
      userId: string;
      // Minutul absolut acoperit de event (15 = minutul 15 din sesiune).
      minute: number;
      // XP acordat pentru minutul asta (rata palierului curent).
      deltaXp: number;
      // Suma XP tick acumulata de la inceputul sesiunii (exclude baseline).
      totalTickXp: number;
      // Index palier 0..N (UI il foloseste sa schimbe culoarea/animatia).
      tier: number;
      // Rata curenta (XP/min) — UI o afiseaza ca etichetă.
      rate: number;
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

// XP-tick award: idempotent prin (userId, "co_walk_tick", "<sessionId>_m<minute>").
// Acordat pe palier dupa baseline (la fiecare minut peste 10).
export type AwardTickFn = (args: {
  sessionId: string;
  userId: string;
  minute: number;
  amount: number;
}) => Promise<void>;

// Sync session state pentru `userId` dupa un heartbeat.
// `mutualPeerIds` = prietenii pe care `userId` ii vede SI care il vad pe el.
// Toate evenimentele rezultate trebuie emise prin socket de catre caller.
export async function tickHeartbeat(
  userId: string,
  mutualPeerIds: string[],
  now: number,
  award: AwardFn,
  awardTick: AwardTickFn,
): Promise<{ events: SyncEvent[]; session: Session | null }> {
  const events: SyncEvent[] = [];
  let session = await getSessionForUser(userId);

  // Step 0: cleanup ghost-uri expirate + resume self daca eram in pauza.
  // Self-resume e prima ocazie sa ne reintegram in sesiune dupa drop stale —
  // urmatorul pas (pair-up) trebuie sa ne gaseasca deja in participants ca
  // peer-ul sa nu mai fie tratat ca "ne intalnim prima oara".
  if (session) {
    const expired = expirePausedParticipants(session, now);
    for (const uid of expired) {
      // Pauza singulara depasita — ghostul devine plecare definitiva. uKey-ul
      // ramane si va fi sters mai jos in step 4 daca sesiunea moare.
      events.push({
        type: 'left',
        sessionId: session.id,
        userId: uid,
        remaining: Object.values(session.participants),
        recipients: [
          ...new Set([
            ...Object.keys(session.participants),
            ...Object.keys(session.pausedParticipants ?? {}),
            uid,
          ]),
        ],
      });
    }
    if (session.pausedParticipants?.[userId]) {
      const resumed = tryResumeParticipant(session, userId, now);
      if (resumed) {
        const p = session.participants[userId]!;
        events.push({
          type: 'joined',
          sessionId: session.id,
          participant: p,
          participants: Object.values(session.participants),
          recipients: Object.keys(session.participants),
        });
      }
    }
  }

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
      // Peer-ul intra in sesiunea mea — fie resume daca era paused aici,
      // fie ca participant nou.
      if (!session.participants[peerId]) {
        const resumed = tryResumeParticipant(session, peerId, now);
        const p = resumed
          ? session.participants[peerId]!
          : (session.participants[peerId] = newParticipant(peerId, now));
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
      // Eu intru in sesiunea peer-ului — fie resume daca eram paused acolo,
      // fie ca participant nou.
      const peerSession = await getSession(peerSessionId);
      if (peerSession) {
        if (!peerSession.participants[userId]) {
          const resumed = tryResumeParticipant(peerSession, userId, now);
          const p = resumed
            ? peerSession.participants[userId]!
            : (peerSession.participants[userId] = newParticipant(userId, now));
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

  // Step 3: drop stale participants → muta in pausedParticipants (smart resume).
  // Snapshot recipients ÎNAINTE de drop ca event-ul `left` sa ajunga si la
  // cel care iese (asa stie sa-si curete UI-ul) si la cei care raman.
  const beforeDropIds = Object.keys(session.participants);
  const droppedIds: string[] = [];
  for (const [pid, p] of Object.entries(session.participants)) {
    if (now - p.lastConfirmedAt > PARTICIPANT_GRACE_MS) droppedIds.push(pid);
  }
  for (const pid of droppedIds) {
    pauseParticipant(session, pid, now);
    events.push({
      type: 'left',
      sessionId: session.id,
      userId: pid,
      remaining: Object.values(session.participants),
      recipients: beforeDropIds,
    });
  }

  // Step 4: daca populatia totala (active + paused) ramane sub 2, sesiunea se
  // incheie definitiv. Asa permitem cazul "ambii in pauza simultan" sa
  // supravietuiasca, dar nu si "ramane unul singur".
  if (totalSessionPopulation(session) < 2) {
    const finalIds = [
      ...Object.keys(session.participants),
      ...Object.keys(session.pausedParticipants ?? {}),
    ];
    await destroy(session.id, finalIds);
    events.push({
      type: 'ended',
      sessionId: session.id,
      recipients: [...new Set([...beforeDropIds, ...finalIds])],
    });
    return { events, session: null };
  }

  // Step 4.5: early-fail. Daca dupa 5 min ai sub 25 pasi, clar n-ai mers —
  // fail-uim acum, fara sa astepti pana la 10:60. Bun pentru cazul "telefonul
  // pe masa" — user-ul vede mesaj rapid.
  {
    const earlyFails: { userId: string; steps: number; rssiSamples: number; rssiStdDev: number }[] = [];
    const beforeEarlyIds = Object.keys(session.participants);
    for (const p of Object.values(session.participants)) {
      if (p.awarded) continue;
      const eff = now - effectiveJoinedAt(p);
      if (eff < COWALK_EARLY_CHECK_MS) continue;
      if (eff >= COWALK_MIN_DURATION_MS) continue; // step 6 va prinde
      if (p.steps >= COWALK_EARLY_MIN_STEPS) continue;
      earlyFails.push({
        userId: p.userId,
        steps: p.steps,
        rssiSamples: p.rssiSamples.length,
        rssiStdDev: stdDev(p.rssiSamples),
      });
    }
    if (earlyFails.length > 0) {
      const pipeline = redis.pipeline();
      for (const f of earlyFails) {
        delete session.participants[f.userId];
        pipeline.del(uKey(f.userId));
      }
      await pipeline.exec();
      const remainingNow = Object.values(session.participants);
      for (const f of earlyFails) {
        events.push({
          type: 'failed',
          sessionId: session.id,
          userId: f.userId,
          reason: 'steps',
          steps: f.steps,
          stepsRequired: COWALK_MIN_STEPS,
          rssiSamples: f.rssiSamples,
          rssiStdDev: f.rssiStdDev,
          recipients: [f.userId],
        });
        events.push({
          type: 'left',
          sessionId: session.id,
          userId: f.userId,
          remaining: remainingNow,
          recipients: beforeEarlyIds,
        });
      }
      if (totalSessionPopulation(session) < 2) {
        const finalIds = [
          ...Object.keys(session.participants),
          ...Object.keys(session.pausedParticipants ?? {}),
        ];
        await destroy(session.id, finalIds);
        events.push({
          type: 'ended',
          sessionId: session.id,
          recipients: [...new Set([...beforeEarlyIds, ...finalIds])],
        });
        return { events, session: null };
      }
    }
  }

  // Step 5: cine a strans 10min EFECTIVI (excluzand paused) + indeplineste
  // anti-cheat → award.
  const activeIds = Object.keys(session.participants);
  for (const p of Object.values(session.participants)) {
    if (p.awarded) continue;
    const effectiveElapsed = now - effectiveJoinedAt(p);
    if (effectiveElapsed < COWALK_MIN_DURATION_MS) continue;
    if (p.steps < COWALK_MIN_STEPS) continue;
    if (p.rssiSamples.length < COWALK_MIN_RSSI_SAMPLES) continue;
    const std = stdDev(p.rssiSamples);
    if (std < COWALK_MIN_RSSI_STDDEV_DBM) continue;

    const peerIds = activeIds.filter((id) => id !== p.userId);
    const durationSec = Math.floor(effectiveElapsed / 1000);
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
      p.lastTickXpMinute = 10;
      events.push({
        type: 'completed',
        sessionId: session.id,
        userId: p.userId,
        durationSec,
        squadSize,
        recipients: activeIds,
      });
    } catch {
      // skip pe urmatorul tick
    }
  }

  // Step 5b: XP escaladator per minut. Pentru fiecare participant cu baseline
  // acordat, acordam XP-ul minutelor scurse de la lastTickXpMinute incoace.
  // Idempotent prin sourceId co_walk_tick `<sessionId>_m<minute>`. Acoperim
  // gap-uri din heartbeat ratate iterand minute cu minute.
  for (const p of Object.values(session.participants)) {
    if (!p.awarded) continue;
    const eff = now - effectiveJoinedAt(p);
    const currentMinute = Math.floor(eff / 60_000);
    if (currentMinute <= p.lastTickXpMinute) continue;
    for (let m = p.lastTickXpMinute + 1; m <= currentMinute; m++) {
      const { rate, tier } = xpTierForElapsed((m - 1) * 60_000);
      if (rate === 0) continue;
      try {
        await awardTick({
          sessionId: session.id,
          userId: p.userId,
          minute: m,
          amount: rate,
        });
        p.lastTickXpMinute = m;
        p.totalTickXp += rate;
        events.push({
          type: 'tick',
          sessionId: session.id,
          userId: p.userId,
          minute: m,
          deltaXp: rate,
          totalTickXp: p.totalTickXp,
          tier,
          rate,
          recipients: [p.userId],
        });
      } catch {
        // best-effort — urmatorul heartbeat reincearca minutele lipsa.
        break;
      }
    }
  }

  // Step 6: fail detection. Daca dupa 10min + grace 60s un participant NU a
  // primit award (anti-cheat n-a trecut), scoatem din sesiune cu motivul.
  // Anti-cheat-ul nu mai poate fi reparat in practica dupa atatea minute fara
  // pasi/miscare — mai bine alerta clara decat timer infinit.
  type FailInfo = {
    userId: string;
    reason: CowalkFailReason;
    steps: number;
    rssiSamples: number;
    rssiStdDev: number;
  };
  const fails: FailInfo[] = [];
  const beforeFailIds = Object.keys(session.participants);
  for (const p of Object.values(session.participants)) {
    if (p.awarded) continue;
    const effectiveElapsed = now - effectiveJoinedAt(p);
    if (effectiveElapsed < COWALK_MIN_DURATION_MS + COWALK_FAIL_GRACE_MS) continue;
    const reason = diagnoseFail(p);
    if (!reason) continue;
    fails.push({
      userId: p.userId,
      reason,
      steps: p.steps,
      rssiSamples: p.rssiSamples.length,
      rssiStdDev: stdDev(p.rssiSamples),
    });
  }
  if (fails.length > 0) {
    const pipeline = redis.pipeline();
    for (const f of fails) {
      delete session.participants[f.userId];
      pipeline.del(uKey(f.userId));
    }
    await pipeline.exec();
    const remainingNow = Object.values(session.participants);
    for (const f of fails) {
      events.push({
        type: 'failed',
        sessionId: session.id,
        userId: f.userId,
        reason: f.reason,
        steps: f.steps,
        stepsRequired: COWALK_MIN_STEPS,
        rssiSamples: f.rssiSamples,
        rssiStdDev: f.rssiStdDev,
        // Alerta ajunge doar la cel care a esuat. Ceilalti primesc `left`
        // separat — nu vrem sa-i facem sa-l "judece" pe colegul lor public.
        recipients: [f.userId],
      });
      events.push({
        type: 'left',
        sessionId: session.id,
        userId: f.userId,
        remaining: remainingNow,
        recipients: beforeFailIds,
      });
    }
    if (totalSessionPopulation(session) < 2) {
      const finalIds = [
        ...Object.keys(session.participants),
        ...Object.keys(session.pausedParticipants ?? {}),
      ];
      await destroy(session.id, finalIds);
      events.push({
        type: 'ended',
        sessionId: session.id,
        recipients: [...new Set([...beforeFailIds, ...finalIds])],
      });
      return { events, session: null };
    }
  }

  await persist(session);
  return { events, session };
}

// Returneaza motivul concret pentru care un participant NU a primit award la
// pragul de durata. Verifica in ordine de severitate: pasi (cel mai usor de
// observat pentru user), apoi samples, apoi stddev. Returneaza null daca toate
// validarile trec (in care caz fail-ul nu se aplica — award va veni la tick-ul
// urmator dupa retry).
function diagnoseFail(p: Participant): CowalkFailReason | null {
  if (p.steps < COWALK_MIN_STEPS) return 'steps';
  if (p.rssiSamples.length < COWALK_MIN_RSSI_SAMPLES) return 'rssi_samples';
  if (stdDev(p.rssiSamples) < COWALK_MIN_RSSI_STDDEV_DBM) return 'rssi_static';
  return null;
}

// Scoate explicit `userId` din sesiunea curenta (daca exista). Folosit in
// doua contexte:
//   pausable=false (default) — toggle off cowalk in UI. Hard leave: ghost
//     sters, leftGuard activ 120s sa nu intram inapoi din heartbeat-uri in zbor.
//   pausable=true — buton "Pauza" sau focus mode background. Muta user-ul in
//     pausedParticipants si NU seteaza leftGuard, ca resume sa fie posibil
//     pana la ABSENT_MAX_SINGLE_MS.
export async function leaveSession(
  userId: string,
  opts: { pausable?: boolean } = {},
): Promise<SyncEvent[]> {
  const pausable = !!opts.pausable;
  const events: SyncEvent[] = [];
  const session = await getSessionForUser(userId);
  if (!session) return events;

  const beforeIds = [
    ...Object.keys(session.participants),
    ...Object.keys(session.pausedParticipants ?? {}),
  ];
  if (!session.participants[userId]) {
    // User-ul nu e activ in sesiune. Daca era in pausedParticipants si caller-ul
    // a vrut hard-leave, il scoatem definitiv. Altfel doar curatam orphan.
    if (!pausable && session.pausedParticipants?.[userId]) {
      delete session.pausedParticipants[userId];
      await persist(session);
    }
    await redis.del(uKey(userId));
    return events;
  }

  if (pausable) {
    pauseParticipant(session, userId, Date.now());
    // NU sterg uKey si NU setez leftGuard — vrem ca user-ul sa fie regasit
    // de heartbeat-ul propriu la resume.
  } else {
    delete session.participants[userId];
    delete session.pausedParticipants?.[userId];
    await Promise.all([
      redis.del(uKey(userId)),
      // Guard impotriva re-crearii sesiunii: heartbeat-urile in zbor (proprii
      // sau ale peer-ilor care inca vad BLE-ul user-ului) nu trebuie sa-l
      // prinda din nou intr-o sesiune noua imediat.
      redis.set(leftGuardKey(userId), '1', 'EX', LEFT_GUARD_TTL_SECONDS),
    ]);
  }

  events.push({
    type: 'left',
    sessionId: session.id,
    userId,
    remaining: Object.values(session.participants),
    recipients: beforeIds,
  });

  if (totalSessionPopulation(session) < 2) {
    const finalIds = [
      ...Object.keys(session.participants),
      ...Object.keys(session.pausedParticipants ?? {}),
    ];
    await destroy(session.id, finalIds);
    events.push({
      type: 'ended',
      sessionId: session.id,
      recipients: [...new Set([...beforeIds, ...finalIds])],
    });
  } else {
    await persist(session);
  }

  return events;
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
