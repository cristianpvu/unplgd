import { Router } from 'express';
import { z } from 'zod';
import type { Item } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, notFound } from '../lib/errors.js';
import {
  AVATAR_INCLUDE,
  DEFAULT_SLUGS,
  SLOTS,
  equippedBySlot,
  type AvatarWithItems,
  type Slot,
} from '../lib/avatar/catalog.js';
import { renderAvatarBlinkSvg, renderAvatarSvg } from '../lib/avatar/render.js';
import { renderAccessoryPreview } from '../lib/avatar/body.js';

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
  featuresItemId: string;
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
    featuresItemId: items.features.id,
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

// Serializeaza un Avatar cu relatii in payload-ul API: { picks: slug-uri, svg, svgBlink, level }
function serializeAvatar(avatar: AvatarWithItems, level: number) {
  const equipped = equippedBySlot(avatar);
  const picks: Record<Slot, string> = {} as Record<Slot, string>;
  for (const slot of SLOTS) picks[slot] = equipped[slot].slug;
  return {
    picks,
    svg: avatar.svg,
    svgBlink: avatar.svgBlink,
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

    // Avatarul se creeaza explicit prin PATCH la finalul flow-ului de onboarding,
    // nu lazy aici. Mobilul foloseste 404 ca semnal "porneste editorul de creare".
    let avatar = user.avatar;
    if (!avatar) throw notFound('avatar_not_found', 'Avatar not created yet');

    if (!avatar.svgBlink) {
      // Backfill lazy pentru avataruri create inainte de coloana svgBlink:
      // re-randam frame-ul de blink din item-urile echipate curent.
      const equipped = equippedBySlot(avatar);
      const svgBlink = renderAvatarBlinkSvg(equipped);
      avatar = await prisma.avatar.update({
        where: { userId: user.id },
        data: { svgBlink },
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

    // Ownership check: pentru accesorii (attachmentPoint != null) care NU sunt
    // default-ul slot-ului (ex. hd-00 "fara"), user-ul trebuie sa le detina via
    // UserItem. Default-urile + iteme face sunt mereu permise.
    const accessoriesToCheck = SLOTS.filter((s) => {
      const item = items[s];
      return item.attachmentPoint !== null && item.slug !== DEFAULT_SLUGS[s];
    }).map((s) => items[s].id);

    if (accessoriesToCheck.length > 0) {
      const owned = await prisma.userItem.findMany({
        where: { userId: user.id, itemId: { in: accessoriesToCheck } },
        select: { itemId: true },
      });
      const ownedSet = new Set(owned.map((o) => o.itemId));
      for (const slot of SLOTS) {
        const item = items[slot];
        if (item.attachmentPoint !== null && item.slug !== DEFAULT_SLUGS[slot] && !ownedSet.has(item.id)) {
          throw badRequest('not_owned', `${slot}:${item.slug}`);
        }
      }
    }

    const svg = renderAvatarSvg(items);
    const svgBlink = renderAvatarBlinkSvg(items);
    const fkData = itemsToFkData(items);

    const avatar = await prisma.avatar.upsert({
      where: { userId: user.id },
      create: { userId: user.id, svg, svgBlink, ...fkData },
      update: { svg, svgBlink, ...fkData },
      include: AVATAR_INCLUDE,
    });

    // Marcheaza ca detinute doar face items + default-uri (NU acordam ownership
    // pe accesorii la echipare — accesoriile vin EXCLUSIV din cufere). Asta
    // permite catalogului sa filtreze corect ce poate fi echipat.
    const grantedIds = SLOTS.filter((s) => {
      const item = items[s];
      return item.attachmentPoint === null || item.slug === DEFAULT_SLUGS[s];
    }).map((s) => items[s].id);
    if (grantedIds.length > 0) {
      await prisma.userItem.createMany({
        data: grantedIds.map((itemId) => ({
          userId: user.id,
          itemId,
          source: 'default_avatar',
        })),
        skipDuplicates: true,
      });
    }

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

// Catalog public cu locked/unlocked + owned. Mobile fetch-uieste o data la app
// start si cache-uieste local; sortarea respecta sortOrder din DB.
//
// `locked` = restrictie de nivel (item.level > user.level).
// `owned`  = user-ul a obtinut item-ul. True automat pentru:
//            - iteme "face" (attachmentPoint == null) — variante vizuale, nu loot
//            - default-uri per slot (DEFAULT_SLUGS, ex. hd-00 "fara holding")
//            False pentru accesorii pe care user-ul nu le-a primit din cufere.
// Mobile combina ambele: item.locked || !item.owned → nu poate fi echipat.
avatarRouter.get('/avatar/catalog', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { level: true } });
    if (!user) throw notFound('user_not_found', 'User not found');

    const types = await prisma.itemType.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    const ownedRows = await prisma.userItem.findMany({
      where: { userId: req.userId! },
      select: { itemId: true },
    });
    const ownedSet = new Set(ownedRows.map((o) => o.itemId));

    const responseTypes = types.map((type) => {
      const defaultSlug = DEFAULT_SLUGS[type.slug as Slot];
      return {
        slug: type.slug,
        name: type.name,
        group: type.group,
        items: type.items.map((item) => {
          const requiresOwnership =
            item.attachmentPoint !== null && item.slug !== defaultSlug;
          const owned = !requiresOwnership || ownedSet.has(item.id);
          // Preview SVG doar pentru accesorii (attachmentPoint != null). Iteme
          // face/body au deja swatch / thumbnail DiceBear in mobil; accesoriile
          // au nevoie de un SVG mic cu fragmentul propriu cropat.
          const previewSvg =
            item.attachmentPoint !== null ? renderAccessoryPreview(item.feature) : null;
          return {
            slug: item.slug,
            name: item.name,
            feature: item.feature,
            level: item.level,
            locked: item.level > user.level,
            owned,
            previewSvg,
          };
        }),
      };
    });

    // defaultPicks e starting state pt editorul de creare (cand user-ul inca
    // nu are avatar in DB) — mobile foloseste asta pe flow-ul de onboarding.
    res.json({ level: user.level, types: responseTypes, defaultPicks: DEFAULT_SLUGS });
  } catch (e) {
    next(e);
  }
});
