import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, notFound } from '../lib/errors.js';
import { getSignedUrl } from '../lib/storage/gcs.js';
import { getPetSummaryByUserId } from '../lib/petImage.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

// GET /users/:id — profil public. Auth necesar (orice user logat il poate
// vedea), dar continutul nu depinde de cine intreaba.
usersRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) throw badRequest('missing_id', 'userId lipsa');

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        xp: true,
        level: true,
        createdAt: true,
        selectedBackgroundKey: true,
        avatar: { select: { svg: true, svgBlink: true } },
      },
    });
    if (!user) throw notFound('user_not_found', 'Utilizator inexistent');

    const pet = await getPetSummaryByUserId(user.id);

    // Fundalul de profil selectat (deblocat din story-adventure) — vizibil de
    // oricine intra pe profil. NULL daca nu si-a setat unul / nu mai e activ.
    const background = user.selectedBackgroundKey
      ? await prisma.profileBackground.findFirst({
          where: { key: user.selectedBackgroundKey, active: true },
          select: { key: true, name: true, imageUrl: true, videoUrl: true, tier: true },
        })
      : null;

    res.json({
      id: user.id,
      name: user.name,
      xp: user.xp,
      level: user.level,
      createdAt: user.createdAt,
      avatarSvg: user.avatar?.svg ?? null,
      avatarSvgBlink: user.avatar?.svgBlink ?? null,
      pet,
      background,
    });
  } catch (e) {
    next(e);
  }
});

// GET /users/:id/co-creations — co-creatiile COMPLETED ale user-ului grupate
// dupa celalalt participant (cate un "album" per pereche). Sortate dupa
// activitatea cea mai recenta (ultimul submit).
usersRouter.get('/:id/co-creations', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) throw badRequest('missing_id', 'userId lipsa');

    const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw notFound('user_not_found', 'Utilizator inexistent');

    const list = await prisma.coCreation.findMany({
      where: {
        status: 'COMPLETED',
        OR: [{ userAId: id }, { userBId: id }],
      },
      orderBy: { submittedAt: 'desc' },
      include: {
        story: { select: { id: true, title: true } },
        userA: { select: { id: true, name: true, avatar: { select: { svg: true } } } },
        userB: { select: { id: true, name: true, avatar: { select: { svg: true } } } },
      },
    });

    type Partner = { id: string; name: string; avatarSvg: string | null };
    type Item = {
      id: string;
      submittedAt: Date | null;
      story: { id: string; title: string };
      originalImageUrl: string | null;
      aiImageUrl: string | null;
      participants: { id: string; name: string }[];
    };

    const groups = new Map<string, { partner: Partner; items: Item[] }>();

    // Pre-resolve toate signed URLs in paralel; ordinea raspunsului matcheaza
    // ordinea sesiunilor → o singura traversare ne ajunge.
    const resolved = await Promise.all(
      list.map(async (c) => {
        const [originalImageUrl, aiImageUrl] = await Promise.all([
          c.originalImageKey ? getSignedUrl(c.originalImageKey).catch(() => null) : null,
          c.aiImageKey ? getSignedUrl(c.aiImageKey).catch(() => null) : null,
        ]);
        return { c, originalImageUrl, aiImageUrl };
      }),
    );

    for (const { c, originalImageUrl, aiImageUrl } of resolved) {
      const other = c.userAId === id ? c.userB : c.userA;
      const partner: Partner = {
        id: other.id,
        name: other.name,
        avatarSvg: other.avatar?.svg ?? null,
      };
      const item: Item = {
        id: c.id,
        submittedAt: c.submittedAt,
        story: c.story,
        originalImageUrl,
        aiImageUrl,
        participants: [
          { id: c.userA.id, name: c.userA.name },
          { id: c.userB.id, name: c.userB.name },
        ],
      };
      const g = groups.get(other.id);
      if (g) g.items.push(item);
      else groups.set(other.id, { partner, items: [item] });
    }

    const albums = Array.from(groups.values()).map((g) => ({
      partner: g.partner,
      count: g.items.length,
      coverImageUrl: g.items[0]?.aiImageUrl ?? g.items[0]?.originalImageUrl ?? null,
      items: g.items,
    }));

    res.json({ albums });
  } catch (e) {
    next(e);
  }
});
