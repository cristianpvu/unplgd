import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, notFound } from '../lib/errors.js';
import {
  ALL_SLOTS,
  CATALOG,
  CATALOG_VERSION,
  DEFAULT_PICKS,
  validatePicks,
  type AvatarPicks,
} from '../lib/avatar/catalog.js';
import { renderAvatarSvg } from '../lib/avatar/render.js';

export const avatarRouter = Router();

avatarRouter.get('/me/avatar', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: { avatar: true },
    });
    if (!user) throw notFound('user_not_found', 'User not found');

    let avatar = user.avatar;
    if (!avatar) {
      const svg = renderAvatarSvg(DEFAULT_PICKS);
      avatar = await prisma.avatar.create({
        data: {
          userId: user.id,
          picks: DEFAULT_PICKS,
          svg,
          catalogVersion: CATALOG_VERSION,
        },
      });
    }

    res.json({
      picks: avatar.picks,
      svg: avatar.svg,
      catalogVersion: avatar.catalogVersion,
      level: user.level,
      updatedAt: avatar.updatedAt,
    });
  } catch (e) {
    next(e);
  }
});

const picksSchema = z
  .object(Object.fromEntries(ALL_SLOTS.map((s) => [s, z.string().min(1).max(40)])) as Record<
    string,
    z.ZodString
  >)
  .strict();

avatarRouter.patch('/me/avatar', requireAuth, async (req, res, next) => {
  try {
    const picks = picksSchema.parse(req.body) as unknown as AvatarPicks;
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) throw notFound('user_not_found', 'User not found');

    const check = validatePicks(picks, user.level);
    if (!check.ok) throw badRequest('invalid_picks', check.reason);

    const svg = renderAvatarSvg(picks);

    const avatar = await prisma.avatar.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        picks,
        svg,
        catalogVersion: CATALOG_VERSION,
      },
      update: {
        picks,
        svg,
        catalogVersion: CATALOG_VERSION,
      },
    });

    res.json({
      picks: avatar.picks,
      svg: avatar.svg,
      catalogVersion: avatar.catalogVersion,
      level: user.level,
      updatedAt: avatar.updatedAt,
    });
  } catch (e) {
    next(e);
  }
});

// Public catalog with locked/unlocked status so the mobile picker can render
// without hardcoding the catalog twice (still mirrored for offline preview but
// the level gates come from the server).
avatarRouter.get('/avatar/catalog', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { level: true },
    });
    if (!user) throw notFound('user_not_found', 'User not found');

    const out: Record<string, Array<{ id: string; name: string; feature: string | null; level: number; locked: boolean }>> = {};
    for (const slot of ALL_SLOTS) {
      out[slot] = CATALOG[slot].map((item) => ({
        id: item.id,
        name: item.name,
        feature: item.feature,
        level: item.level,
        locked: item.level > user.level,
      }));
    }

    res.json({ catalogVersion: CATALOG_VERSION, level: user.level, slots: out });
  } catch (e) {
    next(e);
  }
});
