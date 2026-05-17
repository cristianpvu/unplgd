import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { notFound } from '../lib/errors.js';
import { openChest, type ChestLoot } from '../lib/phonedown/award.js';

export const chestsRouter = Router();

function serializeChest(chest: {
  id: string;
  tier: string;
  sourceType: string;
  openedAt: Date | null;
  createdAt: Date;
  lootJson: unknown;
}, includeLoot = false) {
  const loot = chest.lootJson as ChestLoot | null;
  return {
    id: chest.id,
    tier: chest.tier,
    sourceType: chest.sourceType,
    openedAt: chest.openedAt,
    createdAt: chest.createdAt,
    // Loot-ul nu se expune in lista — doar la deschidere (anti-spoiler).
    // La deschidere returnam totul: xp, items, duplicates.
    loot: includeLoot ? loot : null,
  };
}

// GET /chests — lista cufere ale user-ului, neopenate primele.
chestsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const chests = await prisma.chest.findMany({
      where: { userId: req.userId! },
      orderBy: [{ openedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }],
      select: {
        id: true,
        tier: true,
        sourceType: true,
        openedAt: true,
        createdAt: true,
        lootJson: true,
      },
    });
    res.json({ chests: chests.map((c) => serializeChest(c, false)) });
  } catch (e) {
    next(e);
  }
});

// POST /chests/:id/open — deschide cufar (idempotent — re-apel returneaza
// acelasi loot fara dublare XP, deoarece openedAt e setat la primul open
// si awardXp e idempotent prin source (chest_open, chestId)).
chestsRouter.post('/:id/open', requireAuth, async (req, res, next) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') throw notFound('chest_not_found', 'Chest not found');
    const loot = await openChest(id, req.userId!);
    if (!loot) throw notFound('chest_not_found', 'Chest not found');
    res.json({ loot });
  } catch (e) {
    next(e);
  }
});
