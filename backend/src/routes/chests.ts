import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { notFound } from '../lib/errors.js';
import { enrichLootWithSvg, openChest, type ChestLoot } from '../lib/phonedown/award.js';

export const chestsRouter = Router();

async function serializeChest(chest: {
  id: string;
  tier: string;
  sourceType: string;
  openedAt: Date | null;
  createdAt: Date;
  lootJson: unknown;
}) {
  const raw = chest.lootJson as ChestLoot | null;
  // Cufere DESCHISE: expunem loot-ul (cu SVG-uri) pentru istoric. Cufere
  // NEDESCHISE: loot null (anti-spoiler) — se vede doar la deschidere.
  const loot = chest.openedAt && raw ? await enrichLootWithSvg(raw) : null;
  return {
    id: chest.id,
    tier: chest.tier,
    sourceType: chest.sourceType,
    openedAt: chest.openedAt,
    createdAt: chest.createdAt,
    loot,
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
    res.json({ chests: await Promise.all(chests.map((c) => serializeChest(c))) });
  } catch (e) {
    next(e);
  }
});

// GET /chests/:id/peek — DEBUG: arata loot raw (din DB) si reclassified
// (cum ar fi la deschidere). Util sa verificam ca duplicate detection
// functioneaza la deschidere fata de UserItem curent.
chestsRouter.get('/:id/peek', requireAuth, async (req, res, next) => {
  try {
    const id = req.params.id;
    if (typeof id !== 'string') throw notFound('chest_not_found', 'Chest not found');
    const chest = await prisma.chest.findFirst({
      where: { id, userId: req.userId! },
      select: { id: true, tier: true, openedAt: true, lootJson: true },
    });
    if (!chest) throw notFound('chest_not_found', 'Chest not found');

    const raw = chest.lootJson as ChestLoot | null;
    const owned = await prisma.userItem.findMany({
      where: { userId: req.userId! },
      select: { item: { select: { slug: true } } },
    });
    const ownedSlugs = owned.map((o) => o.item.slug);
    res.json({
      chestId: chest.id,
      tier: chest.tier,
      openedAt: chest.openedAt,
      raw,
      ownedSlugs,
      rawItemsThatAreOwned: raw?.items.filter((it) => ownedSlugs.includes(it.slug)) ?? [],
    });
  } catch (e) {
    next(e);
  }
});

// GET /chests/tiers — config vizual pentru toate tier-urile. Mobile fetch-uieste
// o data la app start (cache 1h via TanStack Query) si randeaza chesturile cu
// SVG-uri citite din DB. Adaugare tier nou = INSERT in ChestTierConfig +
// 3 fisiere SVG noi in assets/chests/ + re-seed → zero modificari de cod mobil.
chestsRouter.get('/tiers', requireAuth, async (_req, res, next) => {
  try {
    const tiers = await prisma.chestTierConfig.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        tier: true,
        label: true,
        sortOrder: true,
        bgColor: true,
        darkColor: true,
        fgColor: true,
        glowColor: true,
        miniSvg: true,
        bodySvg: true,
        lidSvg: true,
      },
    });
    res.json({ tiers });
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
