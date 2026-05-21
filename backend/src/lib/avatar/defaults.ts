import type { Item } from '@prisma/client';
import { prisma } from '../prisma.js';
import { renderAvatarBlinkSvg, renderAvatarSvg } from './render.js';
import { AVATAR_INCLUDE, DEFAULT_SLUGS, SLOTS, type Slot } from './catalog.js';

// Garanteaza ca user-ul are un Avatar default in DB. Idempotent — daca exista
// deja, nu face nimic. Folosit pentru demo users in dev mode + ar putea fi
// adoptat la onboarding ca sa nu mai depindem de PATCH explicit.
//
// Construim picks din DEFAULT_SLUGS (cate o optiune per slot, "fara" pentru
// accesorii), randam SVG-urile si persistam un Avatar cu cele 14 FK-uri.
export async function ensureDefaultAvatar(userId: string): Promise<void> {
  const existing = await prisma.avatar.findUnique({ where: { userId } });
  if (existing) return;

  const slugs = SLOTS.map((s) => DEFAULT_SLUGS[s]);
  const items = await prisma.item.findMany({
    where: { slug: { in: slugs } },
    include: { type: true },
  });
  const bySlug = new Map(items.map((i) => [i.slug, i]));

  const equipped = {} as Record<Slot, Item>;
  for (const slot of SLOTS) {
    const slug = DEFAULT_SLUGS[slot];
    const item = bySlug.get(slug);
    if (!item) {
      // Catalogul nu e seed-uit complet — abort silent, nu blocam flow-ul
      // caller-ului (e.g. dev session create).
      return;
    }
    equipped[slot] = item;
  }

  const svg = renderAvatarSvg(equipped);
  const svgBlink = renderAvatarBlinkSvg(equipped);

  await prisma.avatar.create({
    data: {
      userId,
      svg,
      svgBlink,
      skinItemId: equipped.skin.id,
      hairColorItemId: equipped.hairColor.id,
      hairItemId: equipped.hair.id,
      eyesItemId: equipped.eyes.id,
      mouthItemId: equipped.mouth.id,
      eyebrowsItemId: equipped.eyebrows.id,
      glassesItemId: equipped.glasses.id,
      earringsItemId: equipped.earrings.id,
      featuresItemId: equipped.features.id,
      bodyShapeItemId: equipped.bodyShape.id,
      topItemId: equipped.top.id,
      outerwearItemId: equipped.outerwear.id,
      bottomItemId: equipped.bottom.id,
      footwearItemId: equipped.footwear.id,
      holdingItemId: equipped.holding.id,
    },
    include: AVATAR_INCLUDE,
  });
}
