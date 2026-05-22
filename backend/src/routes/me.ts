import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { notFound } from '../lib/errors.js';
import { getOrCreateDailyToken } from '../lib/bleToken.js';
import { getUsageStats } from '../lib/ai/usage.js';
import { getPetSummaryByUserId, resolveBackgroundAssets } from '../lib/petImage.js';

export const meRouter = Router();

meRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) throw notFound('user_not_found', 'User not found');
    const pet = await getPetSummaryByUserId(user.id);

    // Fundalul de profil — folosit ca background fullscreen pe home + ca poster
    // pe profil. resolveBackgroundAssets semneaza URL-urile GCS daca e cazul.
    const bgRow = user.selectedBackgroundKey
      ? await prisma.profileBackground.findFirst({
          where: { key: user.selectedBackgroundKey, active: true },
          select: { key: true, name: true, imageUrl: true, videoUrl: true, tier: true },
        })
      : null;
    const background = bgRow
      ? { ...bgRow, ...(await resolveBackgroundAssets(bgRow)) }
      : null;

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      birthDate: user.birthDate,
      xp: user.xp,
      level: user.level,
      createdAt: user.createdAt,
      pet,
      background,
    });
  } catch (e) {
    next(e);
  }
});

meRouter.get('/ble-token', requireAuth, async (req, res, next) => {
  try {
    const token = await getOrCreateDailyToken(req.userId!);
    res.json({ token });
  } catch (e) {
    next(e);
  }
});

// GET /me/ai-usage — debug endpoint pentru a urmari consum Claude (tokens +
// cost USD). Auth-ed (orice user logat il poate citi — totalul e global pe
// toata aplicatia, nu per user; e ok pt licenta single-tenant). Daca e
// nevoie ulterior de izolare per user, schimbam in lib/ai/usage.ts cheia
// Redis sa includa userId.
meRouter.get('/ai-usage', requireAuth, async (_req, res, next) => {
  try {
    const stats = await getUsageStats(30);
    res.json(stats);
  } catch (e) {
    next(e);
  }
});
