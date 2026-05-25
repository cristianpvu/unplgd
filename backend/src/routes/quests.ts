// /quests — daily quest state + chest claim.

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getOrCreateDailyQuests } from '../lib/quests/daily.js';
import { prisma } from '../lib/prisma.js';

export const questsRouter = Router();
questsRouter.use(requireAuth);

// GET /quests/today — returneaza 3 quests + progress + chest status.
questsRouter.get('/today', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const state = await getOrCreateDailyQuests(userId);
    res.json(state);
  } catch (e) {
    next(e);
  }
});

// GET /quests/chest/:date — returneaza chest-ul daily pt o anumita zi
// (YYYY-MM-DD) daca exista. Folosit de mobile dupa ce a vazut allComplete
// pe /today si vrea sa-l deschida.
questsRouter.get('/chest/:date', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const date = String(req.params.date ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'invalid_date' });
      return;
    }
    const chest = await prisma.chest.findFirst({
      where: { userId, sourceType: 'daily_quest', sourceId: date },
      select: { id: true, tier: true, lootJson: true, openedAt: true, createdAt: true },
    });
    if (!chest) {
      res.status(404).json({ error: 'chest_not_found' });
      return;
    }
    res.json({ chest });
  } catch (e) {
    next(e);
  }
});
