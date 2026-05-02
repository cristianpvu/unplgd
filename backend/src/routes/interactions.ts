import { Router } from 'express';
import { z } from 'zod';
import { FriendshipStatus, InteractionMethod } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { awardXp, XP_REWARDS } from '../lib/xp.js';
import { requireAuth } from '../middleware/auth.js';
import { checkinRateLimit } from '../middleware/rateLimit.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { resolveTokens, BLE_TOKEN_HEX_LEN } from '../lib/bleToken.js';

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

const scanSchema = z.object({
  uid: z.string().min(4).max(64).regex(/^[0-9a-fA-F:]+$/, 'UID hex invalid'),
});

// Flow unificat scan bratara: gaseste user-ul dupa UID, creeaza prietenia (auto
// ACCEPTED — tap-ul fizic = consimtamant) la prima intalnire si check-in zilnic
// dupa. Toate award-urile XP sunt idempotente (unique pe XpTransaction), deci
// re-run-uri sigure. Acelasi rate limit ca /checkin (anti-abuz XP).
interactionsRouter.post('/scan', checkinRateLimit, async (req, res, next) => {
  try {
    const me = req.userId!;
    const { uid } = scanSchema.parse(req.body);
    const normalizedUid = uid.toLowerCase().replace(/:/g, '');

    const bracelet = await prisma.nfcBracelet.findUnique({
      where: { uid: normalizedUid },
      include: { user: { select: { id: true, name: true, level: true, xp: true } } },
    });
    if (!bracelet) throw notFound('bracelet_not_found', 'Bratara nu este inregistrata');

    const friendUserId = bracelet.userId;
    if (friendUserId === me) throw badRequest('self_scan', 'Nu te poti scana pe tine');

    const today = startOfDayUTC();

    const result = await prisma.$transaction(async (tx) => {
      let friendship = await tx.friendship.findFirst({
        where: {
          OR: [
            { requesterId: me, receiverId: friendUserId },
            { requesterId: friendUserId, receiverId: me },
          ],
        },
      });

      let friendshipCreated = false;
      if (!friendship) {
        friendship = await tx.friendship.create({
          data: {
            requesterId: me,
            receiverId: friendUserId,
            status: FriendshipStatus.ACCEPTED,
            connectedVia: InteractionMethod.nfc,
            acceptedAt: new Date(),
          },
        });
        friendshipCreated = true;
        await Promise.all([
          awardXp(me, XP_REWARDS.FRIENDSHIP_NEW, 'friendship_new', friendship.id, 'Prieten nou', tx),
          awardXp(friendUserId, XP_REWARDS.FRIENDSHIP_NEW, 'friendship_new', friendship.id, 'Prieten nou', tx),
        ]);
      } else if (friendship.status !== FriendshipStatus.ACCEPTED) {
        // Pending sau respinsa anterior — scanul fizic o forteaza la ACCEPTED.
        friendship = await tx.friendship.update({
          where: { id: friendship.id },
          data: {
            status: FriendshipStatus.ACCEPTED,
            connectedVia: InteractionMethod.nfc,
            acceptedAt: new Date(),
          },
        });
      }

      const existing = await tx.dailyInteraction.findFirst({
        where: {
          date: today,
          OR: [
            { userId: me, friendId: friendUserId },
            { userId: friendUserId, friendId: me },
          ],
        },
      });

      let interactionCreated = false;
      if (!existing) {
        const [a, b] = await Promise.all([
          tx.dailyInteraction.create({
            data: { userId: me, friendId: friendUserId, date: today, method: InteractionMethod.nfc },
          }),
          tx.dailyInteraction.create({
            data: { userId: friendUserId, friendId: me, date: today, method: InteractionMethod.nfc },
          }),
        ]);
        await Promise.all([
          awardXp(me, XP_REWARDS.DAILY_INTERACTION, 'daily_interaction', a.id, 'Interactiune zilnica', tx),
          awardXp(friendUserId, XP_REWARDS.DAILY_INTERACTION, 'daily_interaction', b.id, 'Interactiune zilnica', tx),
        ]);
        interactionCreated = true;
      }

      return { friend: bracelet.user, friendshipCreated, interactionCreated };
    });

    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
});

const bleResolveSchema = z.object({
  tokens: z
    .array(z.string().length(BLE_TOKEN_HEX_LEN).regex(/^[0-9a-fA-F]+$/))
    .min(1)
    .max(50),
});

// Rezolva token-uri BLE vazute la userId-uri + flag isFriend (mobile foloseste
// flagul ca sa porneasca pair-detection-ul de co-walk doar pe prieteni
// acceptati, evitand POST-uri inutile catre /co-walk).
interactionsRouter.post('/ble-resolve', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { tokens } = bleResolveSchema.parse(req.body);
    const map = await resolveTokens(tokens);

    // Eliminam propriul userId din rezultate (auto-detectie nu conteaza).
    const otherUserIds = [...new Set([...map.values()].filter((id) => id !== me))];

    const [users, friendships] = otherUserIds.length
      ? await Promise.all([
          prisma.user.findMany({
            where: { id: { in: otherUserIds } },
            select: { id: true, name: true, level: true },
          }),
          prisma.friendship.findMany({
            where: {
              status: FriendshipStatus.ACCEPTED,
              OR: [
                { requesterId: me, receiverId: { in: otherUserIds } },
                { receiverId: me, requesterId: { in: otherUserIds } },
              ],
            },
            select: { requesterId: true, receiverId: true },
          }),
        ])
      : [[], []];
    const usersById = new Map(users.map((u) => [u.id, u]));
    const friendIds = new Set<string>();
    for (const f of friendships) {
      friendIds.add(f.requesterId === me ? f.receiverId : f.requesterId);
    }

    const resolved: Array<{
      token: string;
      userId: string;
      name: string;
      level: number;
      isFriend: boolean;
    }> = [];
    for (const [token, userId] of map.entries()) {
      if (userId === me) continue;
      const u = usersById.get(userId);
      if (u) {
        resolved.push({
          token,
          userId: u.id,
          name: u.name,
          level: u.level,
          isFriend: friendIds.has(u.id),
        });
      }
    }

    res.json({ resolved });
  } catch (e) {
    next(e);
  }
});
const COWALK_MIN_STEPS = 200;
const COWALK_MIN_RSSI_STDDEV = 1.5;

const coWalkSchema = z.object({
  friendUserId: z.string().cuid(),
  durationSec: z.number().int().min(600).max(86_400),
  startedAt: z.string().datetime(),
  stepsMe: z.number().int().min(COWALK_MIN_STEPS).max(100_000),
  rssiStdDev: z.number().min(COWALK_MIN_RSSI_STDDEV).max(40),
});

// Co-walk = 10+ min de prezenta sustinuta BLE intre 2 prieteni. Mobile detecteaza
// pe device si POST-eaza la finalul ferestrei. Idempotent prin XpTransaction
// unique (userId, "co_walk", "<dateUTC>_<sortedPair>") — max 1 award/zi/perechie
// indiferent de cate ori re-trimite mobilul.
interactionsRouter.post('/co-walk', checkinRateLimit, async (req, res, next) => {
  try {
    const me = req.userId!;
    const { friendUserId, durationSec, startedAt, stepsMe, rssiStdDev } = coWalkSchema.parse(
      req.body,
    );
    if (friendUserId === me) throw badRequest('self_cowalk', 'Nu te poti co-walka cu tine');

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
    const dateStr = today.toISOString().slice(0, 10);
    const sortedPair = [me, friendUserId].sort().join('_');
    const cowalkSourceId = `${dateStr}_${sortedPair}`;

    const result = await prisma.$transaction(async (tx) => {
      // DailyInteraction face dublu rol (stats zilnice + 20 XP DAILY_INTERACTION),
      // pe care il acordam si la co-walk daca nu a fost deja triggered de NFC azi.
      const existing = await tx.dailyInteraction.findFirst({
        where: {
          date: today,
          OR: [
            { userId: me, friendId: friendUserId },
            { userId: friendUserId, friendId: me },
          ],
        },
      });

      let dailyAwarded = false;
      if (!existing) {
        const [a, b] = await Promise.all([
          tx.dailyInteraction.create({
            data: { userId: me, friendId: friendUserId, date: today, method: InteractionMethod.ble },
          }),
          tx.dailyInteraction.create({
            data: { userId: friendUserId, friendId: me, date: today, method: InteractionMethod.ble },
          }),
        ]);
        await Promise.all([
          awardXp(me, XP_REWARDS.DAILY_INTERACTION, 'daily_interaction', a.id, 'Interactiune zilnica', tx),
          awardXp(friendUserId, XP_REWARDS.DAILY_INTERACTION, 'daily_interaction', b.id, 'Interactiune zilnica', tx),
        ]);
        dailyAwarded = true;
      }

      // Co-walk XP separat de daily interaction — recompensa pt 10 min impreuna,
      // valabila si daca au tap-uit deja bratara azi. Description-ul e folosit
      // ca audit trail pentru semnalele anti-cheat (pasi + rssi stddev).
      const audit = `Co-walk ${durationSec}s steps=${stepsMe} rssiStd=${rssiStdDev.toFixed(2)}`;
      const [meXp, friendXp] = await Promise.all([
        awardXp(me, XP_REWARDS.CO_WALK, 'co_walk', cowalkSourceId, audit, tx),
        awardXp(friendUserId, XP_REWARDS.CO_WALK, 'co_walk', cowalkSourceId, audit, tx),
      ]);

      return { dailyAwarded, me: meXp, friend: friendXp, durationSec, startedAt };
    });

    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
});
