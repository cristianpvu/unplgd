import { FriendshipStatus, InteractionMethod } from '@prisma/client';
import { prisma } from '../prisma.js';
import { awardXp, XP_REWARDS } from '../xp.js';

// Squad multiplier — identic cu cel din vechiul /co-walk endpoint.
// 2 = pair (1x), 3 = "Patrula" (1.5x), 4+ = "Trupa" (2x).
function squadMultiplier(squadSize: number): number {
  if (squadSize >= 4) return 2.0;
  if (squadSize === 3) return 1.5;
  return 1.0;
}

function startOfDayUTC(at: Date = new Date()): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
}

export type CoWalkAwardResult = {
  alreadyAwarded: boolean;
  xpAmount: number;
  newXp: number;
  newLevel: number;
  leveledUp: boolean;
  dailyAwarded: boolean;
  squadSize: number;
  squadMultiplier: number;
};

// Acorda XP pentru un participant la sfarsitul ferestrei lui de 10min.
// peerIds = ceilalti membri activi ai sesiunii la momentul award-ului
// (folositi pt squad multiplier). Filtreaza la prieteni ACCEPTED — id-urile
// stale nu omoara award-ul, doar nu se conteaza in multiplier.
//
// Idempotent prin XpTransaction unique pe (userId, "co_walk", sourceId)
// unde sourceId = `<dateUTC>_<sessionId>` — un singur award per user per
// sesiune indiferent de cate tick-uri il triggereaza.
export async function awardCowalkParticipant(args: {
  userId: string;
  peerIds: string[];
  sessionId: string;
  durationSec: number;
  steps: number;
  rssiStdDev: number;
}): Promise<CoWalkAwardResult> {
  const { userId, peerIds, sessionId, durationSec, steps, rssiStdDev } = args;

  // Validam prietenii cu ACCEPTED inainte sa-i contam in squad.
  const validPeers = peerIds.length
    ? await prisma.friendship.findMany({
        where: {
          status: FriendshipStatus.ACCEPTED,
          OR: [
            { requesterId: userId, receiverId: { in: peerIds } },
            { receiverId: userId, requesterId: { in: peerIds } },
          ],
        },
        select: { requesterId: true, receiverId: true },
      })
    : [];
  const peerSet = new Set(
    validPeers.map((f) => (f.requesterId === userId ? f.receiverId : f.requesterId)),
  );
  const validPeerIds = peerIds.filter((id) => peerSet.has(id));

  const squadSize = 1 + validPeerIds.length;
  const multiplier = squadMultiplier(squadSize);
  const coWalkXp = Math.floor(XP_REWARDS.CO_WALK * multiplier);

  const today = startOfDayUTC();
  const dateStr = today.toISOString().slice(0, 10);
  const sourceId = `${dateStr}_${sessionId}`;

  return prisma.$transaction(async (tx) => {
    // DailyInteraction la cel mai apropiat partener (pt audit "ai mers cu X
    // azi"). Pe pair pur, e singurul; pe cluster luam primul valid peer.
    let dailyAwarded = false;
    const partnerId = validPeerIds[0];
    if (partnerId) {
      const existing = await tx.dailyInteraction.findFirst({
        where: {
          date: today,
          OR: [
            { userId, friendId: partnerId },
            { userId: partnerId, friendId: userId },
          ],
        },
      });
      if (!existing) {
        const [a, b] = await Promise.all([
          tx.dailyInteraction.create({
            data: {
              userId,
              friendId: partnerId,
              date: today,
              method: InteractionMethod.ble,
            },
          }),
          tx.dailyInteraction.create({
            data: {
              userId: partnerId,
              friendId: userId,
              date: today,
              method: InteractionMethod.ble,
            },
          }),
        ]);
        await Promise.all([
          awardXp(
            userId,
            XP_REWARDS.DAILY_INTERACTION,
            'daily_interaction',
            a.id,
            'Interactiune zilnica',
            tx,
          ),
          awardXp(
            partnerId,
            XP_REWARDS.DAILY_INTERACTION,
            'daily_interaction',
            b.id,
            'Interactiune zilnica',
            tx,
          ),
        ]);
        dailyAwarded = true;
      }
    }

    const audit = `Co-walk ${durationSec}s steps=${steps} rssiStd=${rssiStdDev.toFixed(2)} squad=${squadSize}x${multiplier}`;
    const r = await awardXp(userId, coWalkXp, 'co_walk', sourceId, audit, tx);

    return {
      alreadyAwarded: r.alreadyAwarded,
      xpAmount: r.amount,
      newXp: r.newXp,
      newLevel: r.newLevel,
      leveledUp: r.leveledUp,
      dailyAwarded,
      squadSize,
      squadMultiplier: multiplier,
    };
  });
}

// XP-tick pentru un minut peste baseline (10 min). Idempotent prin
// (userId, "co_walk_tick", `<sessionId>_m<minute>`). amount-ul vine din palier
// (5/10/15) — multiplicarea squadului NU se aplica aici, e doar bonus de
// durata pentru efortul individual.
export async function awardCowalkTick(args: {
  userId: string;
  sessionId: string;
  minute: number;
  amount: number;
}): Promise<void> {
  const { userId, sessionId, minute, amount } = args;
  if (amount <= 0) return;
  const sourceId = `${sessionId}_m${minute}`;
  await awardXp(userId, amount, 'co_walk_tick', sourceId, `Co-walk minut ${minute}`);
}
