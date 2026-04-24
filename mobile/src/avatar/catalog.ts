// Singura informatie hardcodata local: lista de sloturi (pentru type-safety
// pe AvatarPicks). Toata metadata (label, grup, ordonare, item-uri, level)
// vine de pe backend prin GET /avatar/catalog.

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

export type AvatarPicks = Record<Slot, string>;
