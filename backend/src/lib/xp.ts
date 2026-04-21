import type { PrismaClient } from '@prisma/client';
import { prisma } from './prisma.js';
import { xpToLevel } from './level.js';

export const XP_REWARDS = {
  FRIENDSHIP_NEW: 100,
  DAILY_INTERACTION: 20,
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
