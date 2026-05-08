// Helper-uri statice pentru catalogul de avatare. Datele propriu-zise traiesc
// in DB (vezi prisma/seed.ts). Aici stau doar:
// - lista canonica de sloturi (Slot)
// - slug-urile default pentru avatarul initial
// - mapping slot -> coloana FK pe Avatar (folosit la update dinamic)
// - tipuri Prisma pentru Avatar cu toate relatiile incluse

import type { Prisma } from '@prisma/client';

export const SLOTS = [
  'skin',
  'hairColor',
  'hair',
  'eyes',
  'mouth',
  'eyebrows',
  'glasses',
  'earrings',
  'bodyShape',
  'top',
  'outerwear',
  'bottom',
  'footwear',
  'holding',
] as const;

export type Slot = (typeof SLOTS)[number];

// Slug-urile pentru avatarul default creat la primul GET. Lookup-ul la cuid-ul
// real se face in route. Daca un slug dispare din seed, default-ul cade pe
// fallback (vezi resolveDefault in routes/avatar.ts).
export const DEFAULT_SLUGS: Record<Slot, string> = {
  skin: 'skin-02',
  hairColor: 'hc-02',
  hair: 'h-02',
  eyes: 'e-01',
  mouth: 'm-01',
  eyebrows: 'eb-03',
  glasses: 'g-00',
  earrings: 'a-00',
  bodyShape: 'bs-medium',
  top: 't-01',
  outerwear: 'ow-00',
  bottom: 'b-01',
  footwear: 'fw-01',
  holding: 'hd-00',
};

// Include shape pentru orice query de Avatar care vrea toate item-urile
// echipate intr-un singur round-trip.
export const AVATAR_INCLUDE = {
  skinItem: true,
  hairColorItem: true,
  hairItem: true,
  eyesItem: true,
  mouthItem: true,
  eyebrowsItem: true,
  glassesItem: true,
  earringsItem: true,
  bodyShapeItem: true,
  topItem: true,
  outerwearItem: true,
  bottomItem: true,
  footwearItem: true,
  holdingItem: true,
} as const satisfies Prisma.AvatarInclude;

export type AvatarWithItems = Prisma.AvatarGetPayload<{ include: typeof AVATAR_INCLUDE }>;

// Extrage o vizualizare slot -> Item dintr-un Avatar cu relatiile incluse.
export function equippedBySlot(avatar: AvatarWithItems): Record<Slot, AvatarWithItems['skinItem']> {
  return {
    skin: avatar.skinItem,
    hairColor: avatar.hairColorItem,
    hair: avatar.hairItem,
    eyes: avatar.eyesItem,
    mouth: avatar.mouthItem,
    eyebrows: avatar.eyebrowsItem,
    glasses: avatar.glassesItem,
    earrings: avatar.earringsItem,
    bodyShape: avatar.bodyShapeItem,
    top: avatar.topItem,
    outerwear: avatar.outerwearItem,
    bottom: avatar.bottomItem,
    footwear: avatar.footwearItem,
    holding: avatar.holdingItem,
  };
}
