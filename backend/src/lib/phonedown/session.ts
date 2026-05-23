import { PhoneDownStatus, type Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { logger } from '../logger.js';
import { emitPhoneDownUpdate } from '../socket/phonedownEmit.js';
import { awardChestForParticipant } from './award.js';
import { awardSkillsForEvent, SKILL_REWARDS } from '../skills.js';

// Cap silentios la 4h. Peste atat sesiunea se inchide automat indiferent de
// participantii care n-au cedat. Anti "am uitat telefonul jos toata noaptea".
export const PHONE_DOWN_CAP_MS = 4 * 60 * 60 * 1000;

// Minimul absolut pentru a primi cufar (in ms). Sub 5 min nu se acorda nimic
// — anti-farm prin lobby-uri rapide.
export const PHONE_DOWN_MIN_DURATION_MS = 5 * 60 * 1000;

// Recalculeaza durata efectiva a unui participant (timp telefon-jos minus
// pauzele de apel). Daca participantul e inca activ, foloseste `now`.
// Daca e in pauza acum, scadem si fragmentul curent de pauza.
export function effectiveDurationMs(args: {
  phoneDownAt: Date | null;
  surrenderedAt: Date | null;
  pausedAt: Date | null;
  pausedAccumMs: number;
  capAt: Date | null;
  now: Date;
}): number {
  if (!args.phoneDownAt) return 0;
  const end =
    args.surrenderedAt ??
    (args.capAt && args.now > args.capAt ? args.capAt : args.now);
  const totalMs = end.getTime() - args.phoneDownAt.getTime();
  const currentPauseMs = args.pausedAt
    ? Math.max(0, end.getTime() - args.pausedAt.getTime())
    : 0;
  return Math.max(0, totalMs - args.pausedAccumMs - currentPauseMs);
}

// Atribuie rank-uri DESC dupa durationMs. Tie-uri primesc acelasi rank
// (dense ranking — daca 2 oameni au rezistat 30 min, ambii sunt #1, urmatorul
// e #2). Setam status WINNER pentru rank=1, SURRENDERED pentru restul.
export function assignRanks(
  durations: { participantId: string; durationMs: number }[],
): Map<string, { rank: number; isWinner: boolean }> {
  const sorted = [...durations].sort((a, b) => b.durationMs - a.durationMs);
  const result = new Map<string, { rank: number; isWinner: boolean }>();
  let currentRank = 0;
  let lastDuration = Number.POSITIVE_INFINITY;
  for (const row of sorted) {
    if (row.durationMs < lastDuration) {
      currentRank += 1;
      lastDuration = row.durationMs;
    }
    result.set(row.participantId, { rank: currentRank, isWinner: currentRank === 1 });
  }
  return result;
}

// Inchide sesiunea: finalize toti participantii, atribuie rank + cufar.
// Idempotent — daca e deja ENDED, returneaza fara modificari.
export async function endSession(sessionId: string): Promise<void> {
  const now = new Date();
  const session = await prisma.phoneDownSession.findUnique({
    where: { id: sessionId },
    include: { participants: true },
  });
  if (!session) return;
  if (session.status === PhoneDownStatus.ENDED || session.status === PhoneDownStatus.CANCELLED) {
    return;
  }

  // Calculam durata efectiva pentru fiecare participant. Cei inca activi la
  // momentul end primesc max (au "ramas pana la final" — pot fi multipli daca
  // sesiunea s-a inchis la cap-ul de 4h cu mai multi rezistand).
  const durations = session.participants
    .filter((p) => p.phoneDownAt !== null)
    .map((p) => ({
      participantId: p.id,
      durationMs: effectiveDurationMs({
        phoneDownAt: p.phoneDownAt,
        surrenderedAt: p.surrenderedAt,
        pausedAt: p.pausedAt,
        pausedAccumMs: p.pausedAccumMs,
        capAt: session.capAt,
        now,
      }),
    }));
  const ranks = assignRanks(durations);

  // Update toate intr-o tranzactie — final state. La final emitem un update
  // si lasam clientii sa fetch-uiasca rezultatele.
  await prisma.$transaction(async (tx) => {
    for (const p of session.participants) {
      const ranked = ranks.get(p.id);
      const duration = durations.find((d) => d.participantId === p.id)?.durationMs ?? 0;
      const data: Prisma.PhoneDownParticipantUpdateInput = {
        durationMs: duration,
        rank: ranked?.rank ?? null,
      };
      // Daca participantul a ramas activ pana la final (cap atins) → WINNER
      // sau SURRENDERED dupa rank. Daca era deja SURRENDERED, pastram statusul.
      if (p.status === 'ACTIVE' || p.status === 'PAUSED') {
        data.status = ranked?.isWinner ? 'WINNER' : 'SURRENDERED';
        if (!p.surrenderedAt) data.surrenderedAt = now;
      } else if (ranked?.isWinner) {
        // Cazul cand un singur participant a "abandonat" ultimul si tot e #1.
        data.status = 'WINNER';
      }
      await tx.phoneDownParticipant.update({ where: { id: p.id }, data });
    }
    await tx.phoneDownSession.update({
      where: { id: sessionId },
      data: { status: PhoneDownStatus.ENDED, endedAt: now },
    });
  });

  // Acordare cufere — separat de tranzactie pentru ca atinge XP + items pe
  // user-i diferiti (idempotent intern prin Chest unique create-once).
  for (const p of session.participants) {
    const ranked = ranks.get(p.id);
    const duration = durations.find((d) => d.participantId === p.id)?.durationMs ?? 0;
    if (duration < PHONE_DOWN_MIN_DURATION_MS) continue;
    try {
      await awardChestForParticipant({
        participantId: p.id,
        userId: p.userId,
        sessionId,
        durationMs: duration,
        isWinner: ranked?.isWinner ?? false,
      });
    } catch (err) {
      logger.error({ err, participantId: p.id }, 'phonedown chest award failed');
    }
    // Skills: WINNER primeste perseverenta mare; ceilalti primesc participation
    // (perseverenta mica + sociabilitate). Idempotent pe participantId.
    try {
      const rewards = ranked?.isWinner
        ? SKILL_REWARDS.PHONE_DOWN_WINNER
        : SKILL_REWARDS.PHONE_DOWN_PARTICIPATION;
      await awardSkillsForEvent(
        p.userId,
        'phone_down',
        p.id,
        rewards,
        ranked?.isWinner ? 'PhoneDown castigator' : 'PhoneDown participant',
      );
    } catch (err) {
      logger.error({ err, participantId: p.id }, 'phonedown skills award failed');
    }
  }

  emitPhoneDownUpdate(sessionId, 'ended');
}

// Finalize cap silentios. Apelat lazy de la routes inainte de orice
// actiune — daca capAt e in trecut si sesiunea inca PLAYING, o inchidem.
export async function finalizeIfExpired(sessionId: string): Promise<boolean> {
  const s = await prisma.phoneDownSession.findUnique({
    where: { id: sessionId },
    select: { status: true, capAt: true },
  });
  if (!s) return false;
  if (s.status !== PhoneDownStatus.PLAYING) return false;
  if (!s.capAt || s.capAt > new Date()) return false;
  await endSession(sessionId);
  return true;
}
