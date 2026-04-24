import { Router } from 'express';
import { z } from 'zod';
import type { Item } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, notFound, serverError } from '../lib/errors.js';
import {
  AVATAR_INCLUDE,
  DEFAULT_SLUGS,
  SLOTS,
  equippedBySlot,
  type AvatarWithItems,
  type Slot,
} from '../lib/avatar/catalog.js';
import { renderAvatarSvg } from '../lib/avatar/render.js';

export const avatarRouter = Router();

// Schema PATCH/preview: 14 chei (cate una per slot), fiecare un slug string.
const picksSchema = z
  .object(Object.fromEntries(SLOTS.map((s) => [s, z.string().min(1).max(40)])) as Record<Slot, z.ZodString>)
  .strict();

type PicksInput = Record<Slot, string>;

// Cauta toate item-urile dintr-un set de slug-uri si le indexeaza pe slug
// pentru lookup O(1). Arunca daca lipseste vreun slug — folosit la creare
// avatar default (panic) si la PATCH (returnam 400 explicit).
async function fetchItemsBySlug(slugs: string[]): Promise<Map<string, Item>> {
  const items = await prisma.item.findMany({
    where: { slug: { in: slugs } },
    include: { type: true },
  });
  return new Map(items.map((i) => [i.slug, i]));
}

type AvatarFkData = {
  skinItemId: string;
  hairColorItemId: string;
  hairItemId: string;
  eyesItemId: string;
  mouthItemId: string;
  eyebrowsItemId: string;
  glassesItemId: string;
  earringsItemId: string;
  bodyShapeItemId: string;
  topItemId: string;
  outerwearItemId: string;
  bottomItemId: string;
  footwearItemId: string;
  holdingItemId: string;
};

function itemsToFkData(items: Record<Slot, Item>): AvatarFkData {
  return {
    skinItemId: items.skin.id,
    hairColorItemId: items.hairColor.id,
    hairItemId: items.hair.id,
    eyesItemId: items.eyes.id,
    mouthItemId: items.mouth.id,
    eyebrowsItemId: items.eyebrows.id,
    glassesItemId: items.glasses.id,
    earringsItemId: items.earrings.id,
    bodyShapeItemId: items.bodyShape.id,
    topItemId: items.top.id,
    outerwearItemId: items.outerwear.id,
    bottomItemId: items.bottom.id,
    footwearItemId: items.footwear.id,
    holdingItemId: items.holding.id,
  };
}

// Construieste payload-ul de echipare per slot pentru a-l randa + persista.
function resolveSlots(
  picks: PicksInput,
  bySlug: Map<string, Item>,
): { items: Record<Slot, Item>; missing: string[] } {
  const items = {} as Record<Slot, Item>;
  const missing: string[] = [];
  for (const slot of SLOTS) {
    const slug = picks[slot];
    const item = bySlug.get(slug);
    if (!item) {
      missing.push(`${slot}:${slug}`);
      continue;
    }
    items[slot] = item;
  }
  return { items, missing };
}

function validateLevels(items: Record<Slot, Item>, userLevel: number): string | null {
  for (const slot of SLOTS) {
    const item = items[slot];
    if (item.level > userLevel) return `locked:${slot}:${item.slug}:requires_lvl_${item.level}`;
  }
  return null;
}

// Serializeaza un Avatar cu relatii in payload-ul API: { picks: slug-uri, svg, level }
function serializeAvatar(avatar: AvatarWithItems, level: number) {
  const equipped = equippedBySlot(avatar);
  const picks: Record<Slot, string> = {} as Record<Slot, string>;
  for (const slot of SLOTS) picks[slot] = equipped[slot].slug;
  return {
    picks,
    svg: avatar.svg,
    level,
    updatedAt: avatar.updatedAt,
  };
}

avatarRouter.get('/me/avatar', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: { avatar: { include: AVATAR_INCLUDE } },
    });
    if (!user) throw notFound('user_not_found', 'User not found');

    let avatar = user.avatar;
    if (!avatar) {
      // Bootstrap avatar default. Necesita ca seed-ul sa fi rulat — daca un
      // slug default lipseste, e bug de configurare (500), nu user error.
      const bySlug = await fetchItemsBySlug(Object.values(DEFAULT_SLUGS));
      const { items, missing } = resolveSlots(DEFAULT_SLUGS, bySlug);
      if (missing.length) throw serverError('seed_incomplete', `Missing default items: ${missing.join(', ')}`);

      const svg = renderAvatarSvg(items);
      avatar = await prisma.avatar.create({
        data: { userId: user.id, svg, ...itemsToFkData(items) },
        include: AVATAR_INCLUDE,
      });
    }

    res.json(serializeAvatar(avatar, user.level));
  } catch (e) {
    next(e);
  }
});

avatarRouter.patch('/me/avatar', requireAuth, async (req, res, next) => {
  try {
    const picks = picksSchema.parse(req.body) as PicksInput;
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { id: true, level: true } });
    if (!user) throw notFound('user_not_found', 'User not found');

    const bySlug = await fetchItemsBySlug(Object.values(picks));
    const { items, missing } = resolveSlots(picks, bySlug);
    if (missing.length) throw badRequest('unknown_item', missing.join(','));

    const lockedReason = validateLevels(items, user.level);
    if (lockedReason) throw badRequest('locked', lockedReason);

    const svg = renderAvatarSvg(items);
    const fkData = itemsToFkData(items);

    const avatar = await prisma.avatar.upsert({
      where: { userId: user.id },
      create: { userId: user.id, svg, ...fkData },
      update: { svg, ...fkData },
      include: AVATAR_INCLUDE,
    });

    res.json(serializeAvatar(avatar, user.level));
  } catch (e) {
    next(e);
  }
});

// Render-only endpoint pentru preview live in editor. Valideaza (deci item-uri
// blocate nu pot fi nici previzualizate) dar nu persista nimic.
avatarRouter.post('/avatar/preview', requireAuth, async (req, res, next) => {
  try {
    const picks = picksSchema.parse(req.body) as PicksInput;
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { level: true } });
    if (!user) throw notFound('user_not_found', 'User not found');

    const bySlug = await fetchItemsBySlug(Object.values(picks));
    const { items, missing } = resolveSlots(picks, bySlug);
    if (missing.length) throw badRequest('unknown_item', missing.join(','));

    const lockedReason = validateLevels(items, user.level);
    if (lockedReason) throw badRequest('locked', lockedReason);

    res.json({ svg: renderAvatarSvg(items) });
  } catch (e) {
    next(e);
  }
});

// Catalog public cu locked/unlocked. Mobile fetch-uieste o data la app start
// si cache-uieste local; sortarea respecta sortOrder din DB.
avatarRouter.get('/avatar/catalog', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { level: true } });
    if (!user) throw notFound('user_not_found', 'User not found');

    const types = await prisma.itemType.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    const slots: Record<string, Array<{ id: string; slug: string; name: string; feature: string | null; level: number; locked: boolean }>> = {};
    for (const type of types) {
      slots[type.slug] = type.items.map((item) => ({
        id: item.slug, // mobile se identifica dupa slug; cuid e detaliu intern DB
        slug: item.slug,
        name: item.name,
        feature: item.feature,
        level: item.level,
        locked: item.level > user.level,
      }));
    }

    res.json({ level: user.level, slots });
  } catch (e) {
    next(e);
  }
});
