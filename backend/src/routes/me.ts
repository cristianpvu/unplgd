import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { notFound } from '../lib/errors.js';
import { getOrCreateDailyToken } from '../lib/bleToken.js';
import { getUsageStats } from '../lib/ai/usage.js';
import { getPetSummaryByUserId, resolveBackgroundAssets } from '../lib/petImage.js';
import { getAllSkillScores } from '../lib/skills.js';
import { getAllDomainScores, getTopRootDomains } from '../lib/domains.js';
import { getOrGenerateInsight } from '../lib/pet/mentor.js';

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

// Profilul de skill-uri al copilului — 6 dimensiuni cu scor + level RPG.
// Decay 60 zile (half-life). Calculat la query, fara cache (acceptabil pt MVP).
meRouter.get('/skills', requireAuth, async (req, res, next) => {
  try {
    const skills = await getAllSkillScores(req.userId!);
    res.json({ skills });
  } catch (e) {
    next(e);
  }
});

// Toata harta de domenii (radacini + subdomenii). Folosit la ecranul detaliat.
meRouter.get('/domains', requireAuth, async (req, res, next) => {
  try {
    const all = await getAllDomainScores(req.userId!);
    res.json({ domains: all });
  } catch (e) {
    next(e);
  }
});

// Top N domenii radacina cu scor > 0 — pentru "constelatia" de pe profil
// (top 10 default). Query param ?limit=N pentru ajustari.
meRouter.get('/domains/top', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(20, parseInt(String(req.query.limit ?? '10'), 10) || 10));
    const top = await getTopRootDomains(req.userId!, limit);
    res.json({ domains: top });
  } catch (e) {
    next(e);
  }
});

// Reflectia saptamanii — pet-ul citeste skills + domains + activitati din
// ultimele 7 zile si scrie 1 mesaj scurt (~60 cuvinte). Cache 1 mesaj/saptamana
// (ISO week), regenerat luni dimineata automat. ?fresh=1 ignora cache (debug).
meRouter.get('/insight', requireAuth, async (req, res, next) => {
  try {
    const forceFresh = req.query.fresh === '1';
    const insight = await getOrGenerateInsight(req.userId!, { forceFresh });
    res.json(insight);
  } catch (e) {
    next(e);
  }
});

// Notificari in-app — lista descendent cronologic. Pe MVP, fara paginare:
// notificarile sunt rare (max 2-3/saptamana per user). `unreadOnly=1` pt UI
// indicator badge.
meRouter.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const unreadOnly = req.query.unreadOnly === '1';
    const items = await prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const unreadCount = await prisma.notification.count({
      where: { userId, readAt: null },
    });
    res.json({ items, unreadCount });
  } catch (e) {
    next(e);
  }
});

// Mark read — un singur ID. Idempotent.
meRouter.post('/notifications/:id/read', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const id = String(req.params.id ?? '');
    if (!id) return res.status(400).json({ error: 'missing_id' });
    const n = await prisma.notification.findUnique({ where: { id } });
    if (!n || n.userId !== userId) {
      return res.status(404).json({ error: 'not_found' });
    }
    if (n.readAt) {
      return res.json({ ok: true, alreadyRead: true });
    }
    await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    res.json({ ok: true, alreadyRead: false });
  } catch (e) {
    next(e);
  }
});

// Mark ALL read — buton "marcheaza toate ca citite".
meRouter.post('/notifications/read-all', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const result = await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ ok: true, updated: result.count });
  } catch (e) {
    next(e);
  }
});
