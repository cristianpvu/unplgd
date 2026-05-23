import { Router } from 'express';
import { z } from 'zod';
import { FriendshipStatus, InteractionMethod } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { awardXp, XP_REWARDS } from '../lib/xp.js';
import { awardSkillsForEvent, SKILL_REWARDS } from '../lib/skills.js';
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
        awardSkillsForEvent(
          me,
          'daily_interaction',
          a.id,
          SKILL_REWARDS.DAILY_INTERACTION,
          'Interactiune zilnica',
          tx,
        ),
        awardSkillsForEvent(
          friendUserId,
          'daily_interaction',
          b.id,
          SKILL_REWARDS.DAILY_INTERACTION,
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
          awardSkillsForEvent(me, 'friendship_new', friendship.id, SKILL_REWARDS.FRIENDSHIP_NEW, 'Prieten nou', tx),
          awardSkillsForEvent(friendUserId, 'friendship_new', friendship.id, SKILL_REWARDS.FRIENDSHIP_NEW, 'Prieten nou', tx),
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
          awardSkillsForEvent(me, 'daily_interaction', a.id, SKILL_REWARDS.DAILY_INTERACTION, 'Interactiune zilnica', tx),
          awardSkillsForEvent(friendUserId, 'daily_interaction', b.id, SKILL_REWARDS.DAILY_INTERACTION, 'Interactiune zilnica', tx),
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
// Co-walk live: backend driveuieste sesiunile (creare, join, expire, award XP)
// din heartbeat-urile de presenta + report-urile prin socket. Vezi
// `routes/presence.ts` + `lib/cowalk/session.ts`. Endpoint-ul vechi POST
// /interactions/co-walk a fost eliminat — mobile-ul nu mai face commit local.
