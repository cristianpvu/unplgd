import type { PrismaClient } from '@prisma/client';
import { prisma } from './prisma.js';
import { xpToLevel } from './level.js';

export const XP_REWARDS = {
  FRIENDSHIP_NEW: 100,
  DAILY_INTERACTION: 20,
  // Poveste — XP scaleaza cu scor (3..5). Sub 3 = nu primesc XP.
  // Author primeste mai mult ca a creat + povestit; listener mai putin.
  STORY_TOLD_BY_SCORE: { 3: 60, 4: 70, 5: 80 } as Record<number, number>,
  STORY_LISTENED_BY_SCORE: { 3: 20, 4: 25, 5: 30 } as Record<number, number>,
  // Co-creatie acceptata de AI — egal pt amandoi (act creativ comun, nu rol-uri
  // diferite ca la story). Se acorda DOAR la status=COMPLETED, niciodata
  // inainte de validare AI.
  CO_CREATION: 80,
  // Co-walk BLE — 10 min minim de prezenta sustinuta cu un prieten. Idempotent
  // pe (userId, "co_walk", "<dateUTC>_<sortedPair>") deci max 1 award/zi/perechie.
  CO_WALK: 50,
  // Hunt outdoor: rank 1/2/3 + participation pt ultimii. Idempotent pe
  // (userId, "hunt_rank", sessionId).
  HUNT_RANK_1: 100,
  HUNT_RANK_2: 60,
  HUNT_RANK_3: 30,
  HUNT_PARTICIPATION: 10,
  // Screen-time saptamanal: cine sta cel mai PUTIN pe telefon in cercul lui de
  // prieteni castiga mai mult. Acordat lazy la finalul saptamanii, idempotent
  // pe (userId, "screentime_week", weekKey). Participation pt cei sub podium
  // care totusi au raportat date (incurajam obiceiul, nu doar castigul).
  SCREENTIME_WEEK_RANK_1: 120,
  SCREENTIME_WEEK_RANK_2: 80,
  SCREENTIME_WEEK_RANK_3: 50,
  SCREENTIME_WEEK_PARTICIPATION: 20,
} as const;

type Tx = PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export type XpAwardResult = {
  alreadyAwarded: boolean;
  amount: number;
  newXp: number;
  newLevel: number;
  leveledUp: boolean;
};

/**
 * Idempotent XP grant. Relies on the unique constraint
 * (userId, sourceType, sourceId) on XpTransaction — re-runs return
 * `alreadyAwarded: true` without mutating state.
 */
export async function awardXp(
  userId: string,
  amount: number,
  sourceType: string,
  sourceId: string,
  description?: string,
  client: Tx = prisma,
): Promise<XpAwardResult> {
  const existing = await client.xpTransaction.findUnique({
    where: { userId_sourceType_sourceId: { userId, sourceType, sourceId } },
  });
  if (existing) {
    const user = await client.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      alreadyAwarded: true,
      amount: 0,
      newXp: user.xp,
      newLevel: user.level,
      leveledUp: false,
    };
  }

  await client.xpTransaction.create({
    data: { userId, amount, sourceType, sourceId, description },
  });

  const user = await client.user.findUniqueOrThrow({ where: { id: userId } });
  const newXp = user.xp + amount;
  const newLevel = xpToLevel(newXp);
  await client.user.update({
    where: { id: userId },
    data: { xp: newXp, level: newLevel },
  });

  return {
    alreadyAwarded: false,
    amount,
    newXp,
    newLevel,
    leveledUp: newLevel > user.level,
  };
}
