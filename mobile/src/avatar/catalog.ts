// Sloturi avatar + ordonare pentru UI. Datele propriu-zise (item-uri,
// nivele, deblocari) vin de pe backend prin GET /avatar/catalog. Tinem aici
// doar lista canonica de sloturi si labelurile pentru tabs.

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

export const SLOT_LABEL: Record<Slot, string> = {
  skin: 'Ten',
  hair: 'Coafura',
  hairColor: 'Culoare par',
  eyes: 'Ochi',
  mouth: 'Gura',
  eyebrows: 'Sprancene',
  glasses: 'Ochelari',
  earrings: 'Cercei',
  bodyShape: 'Corp',
  top: 'Tricou',
  outerwear: 'Jacheta',
  bottom: 'Pantaloni',
  footwear: 'Incaltaminte',
  holding: 'In mana',
};

// Sloturi de fata (folosesc thumbnails DiceBear) vs sloturi de corp (swatch
// colorat din feature). Editor-ul randeaza diferit fiecare grup.
export const FACE_SLOTS: Slot[] = ['skin', 'hair', 'hairColor', 'eyes', 'mouth', 'eyebrows', 'glasses', 'earrings'];
export const BODY_SLOTS: Slot[] = ['bodyShape', 'top', 'outerwear', 'bottom', 'footwear', 'holding'];
export const ALL_SLOTS_ORDERED: Slot[] = [...FACE_SLOTS, ...BODY_SLOTS];
