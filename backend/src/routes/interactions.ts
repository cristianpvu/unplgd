import { Router } from 'express';
import { z } from 'zod';
import { FriendshipStatus, InteractionMethod } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { awardXp, XP_REWARDS } from '../lib/xp.js';
import { requireAuth } from '../middleware/auth.js';
import { checkinRateLimit } from '../middleware/rateLimit.js';
import { badRequest, forbidden } from '../lib/errors.js';

export const interactionsRouter = Router();
interactionsRouter.use(requireAuth);

const checkinSchema = z.object({
  friendUserId: z.string().cuid(),
  method: z.nativeEnum(InteractionMethod).default(InteractionMethod.nfc),
});

// Rate limit: 10 req/min per user (cerinta coordonator).
interactionsRouter.post('/checkin', checkinRateLimit, async (req, res, next) => {
  try {
    const me = req.userId!;
    const { friendUserId, method } = checkinSchema.parse(req.body);
    if (friendUserId === me) throw badRequest('self_checkin', 'Nu te poti intalni cu tine');

    const friendship = await prisma.friendship.findFirst({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [
          { requesterId: me, receiverId: friendUserId },
          { requesterId: friendUserId, receiverId: me },
        ],
      },
    });
    if (!friendship) throw forbidden('not_friends', 'Nu sunteti prieteni');

    const today = startOfDayUTC();
    const existing = await prisma.dailyInteraction.findFirst({
      where: {
        date: today,
        OR: [
          { userId: me, friendId: friendUserId },
          { userId: friendUserId, friendId: me },
        ],
      },
    });

    if (existing) {
      res.json({ alreadyCheckedIn: true });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const [a, b] = await Promise.all([
        tx.dailyInteraction.create({
          data: { userId: me, friendId: friendUserId, date: today, method },
        }),
        tx.dailyInteraction.create({
          data: { userId: friendUserId, friendId: me, date: today, method },
        }),
      ]);

      const [meXp, friendXp] = await Promise.all([
        awardXp(
          me,
          XP_REWARDS.DAILY_INTERACTION,
          'daily_interaction',
          a.id,
          'Interactiune zilnica',
          tx,
        ),
        awardXp(
          friendUserId,
          XP_REWARDS.DAILY_INTERACTION,
          'daily_interaction',
          b.id,
          'Interactiune zilnica',
          tx,
        ),
      ]);

      return { interactionId: a.id, me: meXp, friend: friendXp };
    });

    res.status(201).json({ alreadyCheckedIn: false, ...result });
  } catch (e) {
    next(e);
  }
});

function startOfDayUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
