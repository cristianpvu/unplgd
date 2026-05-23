import { Router } from 'express';
import { z } from 'zod';
import { FriendshipStatus, InteractionMethod } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { awardXp, XP_REWARDS } from '../lib/xp.js';
import { awardSkillsForEvent, SKILL_REWARDS } from '../lib/skills.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, notFound } from '../lib/errors.js';
import { getPetSummariesByUserIds } from '../lib/petImage.js';

export const friendsRouter = Router();
friendsRouter.use(requireAuth);

const addSchema = z.object({
  friendUserId: z.string().cuid(),
  method: z.nativeEnum(InteractionMethod).default(InteractionMethod.nfc),
});

friendsRouter.post('/', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { friendUserId, method } = addSchema.parse(req.body);

    if (friendUserId === me) throw badRequest('self_friend', 'Nu te poti adauga pe tine');

    const friend = await prisma.user.findUnique({ where: { id: friendUserId } });
    if (!friend) throw notFound('user_not_found', 'Utilizator inexistent');

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: me, receiverId: friendUserId },
          { requesterId: friendUserId, receiverId: me },
        ],
      },
    });

    if (existing) {
      res.json({ friendship: existing, created: false });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const friendship = await tx.friendship.create({
        data: {
          requesterId: me,
          receiverId: friendUserId,
          status: FriendshipStatus.ACCEPTED,
          connectedVia: method,
          acceptedAt: new Date(),
        },
      });

      const [meResult, friendResult] = await Promise.all([
        awardXp(me, XP_REWARDS.FRIENDSHIP_NEW, 'friendship_new', friendship.id, 'Prieten nou', tx),
        awardXp(
          friendUserId,
          XP_REWARDS.FRIENDSHIP_NEW,
          'friendship_new',
          friendship.id,
          'Prieten nou',
          tx,
        ),
        // Skills: sociabilitate pt amandoi. Idempotent pe friendshipId — un
        // singur grant per relatie.
        awardSkillsForEvent(
          me,
          'friendship_new',
          friendship.id,
          SKILL_REWARDS.FRIENDSHIP_NEW,
          'Prieten nou',
          tx,
        ),
        awardSkillsForEvent(
          friendUserId,
          'friendship_new',
          friendship.id,
          SKILL_REWARDS.FRIENDSHIP_NEW,
          'Prieten nou',
          tx,
        ),
      ]);

      return { friendship, me: meResult, friend: friendResult };
    });

    res.status(201).json({ ...result, created: true });
  } catch (e) {
    next(e);
  }
});

friendsRouter.get('/', async (req, res, next) => {
  try {
    const me = req.userId!;
    const friendships = await prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ requesterId: me }, { receiverId: me }],
      },
      include: {
        requester: { select: publicFields },
        receiver: { select: publicFields },
      },
      orderBy: { acceptedAt: 'desc' },
    });

    // Fetch petsSummary in batch — un singur query Prisma + N rezolvari URL
    // paralele in loc de N round-trips secventiale.
    const otherIds = friendships.map((f) =>
      f.requesterId === me ? f.receiverId : f.requesterId,
    );
    const pets = await getPetSummariesByUserIds(otherIds);

    const friends = friendships.map((f) => {
      const u = f.requesterId === me ? f.receiver : f.requester;
      return {
        friendshipId: f.id,
        since: f.acceptedAt,
        method: f.connectedVia,
        user: {
          id: u.id,
          name: u.name,
          xp: u.xp,
          level: u.level,
          // Doar SVG-ul cu ochii deschisi — frame-ul de blink ar dubla payload-ul
          // degeaba pentru thumbnail-uri mici in lista.
          avatarSvg: u.avatar?.svg ?? null,
          pet: pets.get(u.id) ?? null,
        },
      };
    });

    res.json({ friends });
  } catch (e) {
    next(e);
  }
});

friendsRouter.delete('/:friendshipId', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { friendshipId } = req.params;
    const fs = await prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!fs || (fs.requesterId !== me && fs.receiverId !== me)) {
      throw notFound('friendship_not_found', 'Prietenie inexistenta');
    }
    await prisma.friendship.delete({ where: { id: friendshipId } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

const publicFields = {
  id: true,
  name: true,
  xp: true,
  level: true,
  avatar: { select: { svg: true } },
} as const;
