import { prisma } from '../prisma.js';
import { logger } from '../logger.js';

// Bond level pe Pet — analog cu user level, dar curba mai aplatizata ca sa fie
// reachable in luni de joaca (pet-ul "creste" mai incet decat user-ul).
// L1: 0, L2: 50, L3: 200, L4: 450, L5: 800, L10: 4050
//
// Folosita la:
//  - Display pe profilul pet-ului (bara de progres)
//  - Scaling precision-ul hint-ului (vezi huntHint.ts)
//  - Cap soft la BOND_LEVEL_MAX = 10 (peste, hint-urile nu mai devin mai
//    precise, doar acumulezi xp ca trofeu).

export const BOND_LEVEL_MAX = 10;

export function bondXpToLevel(xp: number): number {
  if (xp < 0) return 1;
  return 1 + Math.floor(Math.sqrt(xp / 50));
}

export function bondXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.pow(level - 1, 2) * 50;
}

export function bondProgress(xp: number) {
  const level = bondXpToLevel(xp);
  const currentLevelXp = bondXpForLevel(level);
  const nextLevelXp = bondXpForLevel(level + 1);
  return {
    level,
    xp,
    xpIntoLevel: xp - currentLevelXp,
    xpForNextLevel: nextLevelXp - currentLevelXp,
  };
}

// Reward-uri canonice pentru actiuni care dau bond xp. Le tinem pe un singur
// loc ca sa fie usor de ajustat la balansare gameplay.
export const BOND_REWARDS = {
  // Hint revelat + raspuns corect (set in hunt /answer cand usedHint=true).
  HUNT_HINT_USED_CORRECT: 12,
  // Completare aventura story (boss invins). Idempotent pe runId.
  ADVENTURE_COMPLETE: 40,
  // Daily login (planificat — vezi suggestions).
  DAILY_LOGIN: 5,
} as const;

// Acordare bond xp idempotenta — clona awardXp dar pe BondXpTransaction.
// Unicitate pe (petId, sourceType, sourceId) → re-apel cu acelasi tuple
// e no-op silent.
//
// Returneaza dacă a fost o tranzactie noua (true) sau duplicat skippat (false).
export async function awardBondXp(
  petId: string,
  amount: number,
  sourceType: string,
  sourceId: string | null,
  description?: string,
): Promise<boolean> {
  if (amount <= 0) return false;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.bondXpTransaction.create({
        data: { petId, amount, sourceType, sourceId, description },
      });
      await tx.pet.update({
        where: { id: petId },
        data: { bondXp: { increment: amount } },
      });
    });
    return true;
  } catch (err: any) {
    // Prisma P2002 = unique constraint hit → tranzactie deja inregistrata.
    if (err?.code === 'P2002') return false;
    logger.error({ err, petId, sourceType, sourceId }, 'awardBondXp failed');
    throw err;
  }
}
