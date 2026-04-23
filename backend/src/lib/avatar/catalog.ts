// Avatar catalog. Face features (hair/eyes/mouth/etc.) reference DiceBear
// "Adventurer" by Lisa Wischofsky (CC BY 4.0). Body, clothing and the
// level-gated economy are original.
//
// IMPORTANT: keep this file in sync with mobile/src/avatar/catalog.ts.
// Both sides must agree on slot/item IDs and feature mappings. The mobile
// copy is used for picker UI; this server copy is used for SVG rendering
// (DiceBear lookup) and PATCH validation.

export type Slot =
  | 'skin'
  | 'hairColor'
  | 'hair'
  | 'eyes'
  | 'mouth'
  | 'eyebrows'
  | 'glasses'
  | 'earrings'
  | 'bodyShape'
  | 'top'
  | 'bottom'
  | 'outerwear'
  | 'footwear'
  | 'holding';

export type Item = {
  id: string;
  feature: string | null;
  name: string;
  level: number;
};

export type Catalog = Record<Slot, Item[]>;

export const CATALOG: Catalog = {
  skin: [
    { id: 'skin-01', feature: 'f2d3b1', name: 'Alabastru', level: 1 },
    { id: 'skin-02', feature: 'ecad80', name: 'Nisip', level: 1 },
    { id: 'skin-03', feature: 'c99c72', name: 'Miere', level: 1 },
    { id: 'skin-04', feature: '9e5622', name: 'Scortisoara', level: 1 },
    { id: 'skin-05', feature: '763900', name: 'Cacao', level: 1 },
    { id: 'skin-06', feature: '614335', name: 'Espresso', level: 1 },
  ],
  hairColor: [
    { id: 'hc-01', feature: '0e0e0e', name: 'Negru', level: 1 },
    { id: 'hc-02', feature: '6a4e35', name: 'Saten', level: 1 },
    { id: 'hc-03', feature: 'cb6820', name: 'Portocaliu', level: 1 },
    { id: 'hc-04', feature: 'a55728', name: 'Roscat', level: 1 },
    { id: 'hc-05', feature: 'e5d7a3', name: 'Blond', level: 1 },
    { id: 'hc-06', feature: 'ab2a18', name: 'Rosu aprins', level: 5 },
    { id: 'hc-07', feature: '85c2c6', name: 'Menta', level: 10 },
    { id: 'hc-08', feature: 'dba3be', name: 'Roz', level: 10 },
  ],
  hair: [
    { id: 'h-01', feature: 'short01', name: 'Tuns scurt', level: 1 },
    { id: 'h-02', feature: 'short02', name: 'Volum classic', level: 1 },
    { id: 'h-03', feature: 'short03', name: 'Mot frontal', level: 1 },
    { id: 'h-04', feature: 'short04', name: 'Suvita lejera', level: 1 },
    { id: 'h-05', feature: 'short05', name: 'Curly afro', level: 1 },
    { id: 'h-06', feature: 'short06', name: 'Bucle stranse', level: 5 },
    { id: 'h-07', feature: 'short07', name: 'Unda relaxata', level: 1 },
    { id: 'h-08', feature: 'short10', name: 'Spikey', level: 5 },
    { id: 'h-09', feature: 'short15', name: 'Perie sus', level: 10 },
    { id: 'h-10', feature: 'short18', name: 'Undercut', level: 10 },
    { id: 'h-11', feature: 'long01', name: 'Lung drept', level: 1 },
    { id: 'h-12', feature: 'long02', name: 'Lung cu breton', level: 1 },
    { id: 'h-13', feature: 'long03', name: 'Coada', level: 5 },
    { id: 'h-14', feature: 'long05', name: 'Codite', level: 5 },
    { id: 'h-15', feature: 'long09', name: 'Bob', level: 1 },
    { id: 'h-16', feature: 'long12', name: 'Coc', level: 10 },
    { id: 'h-17', feature: 'long16', name: 'Impletitura', level: 10 },
    { id: 'h-18', feature: 'long20', name: 'Val lung', level: 20 },
    { id: 'h-19', feature: 'long25', name: 'Ondulat', level: 20 },
  ],
  eyes: [
    { id: 'e-01', feature: 'variant01', name: 'Rotund', level: 1 },
    { id: 'e-02', feature: 'variant02', name: 'Bland', level: 1 },
    { id: 'e-03', feature: 'variant03', name: 'Veselie', level: 1 },
    { id: 'e-04', feature: 'variant07', name: 'Curios', level: 1 },
    { id: 'e-05', feature: 'variant12', name: 'Obosit', level: 5 },
    { id: 'e-06', feature: 'variant15', name: 'Sideways', level: 5 },
    { id: 'e-07', feature: 'variant19', name: 'Serios', level: 10 },
    { id: 'e-08', feature: 'variant22', name: 'Clipit', level: 10 },
    { id: 'e-09', feature: 'variant26', name: 'Scanteietor', level: 20 },
  ],
  mouth: [
    { id: 'm-01', feature: 'variant01', name: 'Zambet mic', level: 1 },
    { id: 'm-02', feature: 'variant05', name: 'Fericire', level: 1 },
    { id: 'm-03', feature: 'variant10', name: 'Serios', level: 1 },
    { id: 'm-04', feature: 'variant14', name: 'Surpriza', level: 5 },
    { id: 'm-05', feature: 'variant18', name: 'Limba', level: 5 },
    { id: 'm-06', feature: 'variant22', name: 'Dinti', level: 10 },
    { id: 'm-07', feature: 'variant26', name: 'Buze', level: 10 },
    { id: 'm-08', feature: 'variant30', name: 'Ras mare', level: 20 },
  ],
  eyebrows: [
    { id: 'b-01', feature: 'variant01', name: 'Naturale', level: 1 },
    { id: 'b-02', feature: 'variant05', name: 'Arcuite', level: 1 },
    { id: 'b-03', feature: 'variant08', name: 'Groase', level: 1 },
    { id: 'b-04', feature: 'variant12', name: 'Subtiri', level: 5 },
    { id: 'b-05', feature: 'variant15', name: 'Ridicate', level: 10 },
  ],
  glasses: [
    { id: 'g-00', feature: null, name: 'Fara', level: 1 },
    { id: 'g-01', feature: 'variant01', name: 'Rotunzi', level: 5 },
    { id: 'g-02', feature: 'variant03', name: 'Aviator', level: 10 },
    { id: 'g-03', feature: 'variant05', name: 'Smart', level: 20 },
  ],
  earrings: [
    { id: 'a-00', feature: null, name: 'Fara', level: 1 },
    { id: 'a-01', feature: 'variant01', name: 'Mic', level: 5 },
    { id: 'a-02', feature: 'variant03', name: 'Picatura', level: 10 },
    { id: 'a-03', feature: 'variant05', name: 'Statement', level: 30 },
  ],
  bodyShape: [
    { id: 'bs-slim', feature: 'slim', name: 'Zvelt', level: 1 },
    { id: 'bs-medium', feature: 'medium', name: 'Mediu', level: 1 },
    { id: 'bs-robust', feature: 'robust', name: 'Robust', level: 1 },
  ],
  top: [
    { id: 't-01', feature: 'tee:e8e3d5:d4ccb8:short', name: 'Tricou alb', level: 1 },
    { id: 't-02', feature: 'tee:3d6fa3:2a5283:short', name: 'Tricou albastru', level: 1 },
    { id: 't-03', feature: 'tee:c45a4a:8a3d34:short', name: 'Tricou rosu', level: 1 },
    { id: 't-04', feature: 'tee:5ea06a:3e7a4a:short', name: 'Tricou verde', level: 1 },
    { id: 't-05', feature: 'tee:f0c24a:c29832:long', name: 'Bluza galbena', level: 1 },
    { id: 't-06', feature: 'tee:e89bb5:c47894:3q', name: 'Bluza roz', level: 5 },
    { id: 't-07', feature: 'hoodie:6b8aa8:4f6b85', name: 'Hanorac albastru', level: 5 },
    { id: 't-08', feature: 'hoodie:4a4a4a:2e2e2e', name: 'Hanorac gri', level: 10 },
    { id: 't-09', feature: 'dress:e89bb5:c47894', name: 'Rochie roz', level: 10 },
    { id: 't-10', feature: 'dress:7a9fd8:5578b5', name: 'Rochie albastra', level: 20 },
  ],
  outerwear: [
    { id: 'ow-00', feature: null, name: 'Fara', level: 1 },
    { id: 'ow-01', feature: 'vest:4a4340:2d2826', name: 'Vesta inchisa', level: 5 },
    { id: 'ow-02', feature: 'vest:8a6a44:5d4528', name: 'Vesta maro', level: 10 },
    { id: 'ow-03', feature: 'vest:5a7a5a:3a5a3a', name: 'Vesta verde', level: 20 },
  ],
  bottom: [
    { id: 'b-01', feature: 'pants:3d6fa3:2a5283:long', name: 'Blugi', level: 1 },
    { id: 'b-02', feature: 'pants:4a4340:2d2826:long', name: 'Pantaloni negri', level: 1 },
    { id: 'b-03', feature: 'pants:8a6a44:5d4528:long', name: 'Pantaloni bej', level: 1 },
    { id: 'b-04', feature: 'pants:3d6fa3:2a5283:short', name: 'Pantaloni scurti', level: 5 },
    { id: 'b-05', feature: 'skirt:a85a7a:7a3e5a', name: 'Fusta roz', level: 5 },
    { id: 'b-06', feature: 'skirt:4a5a8a:2e3d6a', name: 'Fusta plisata', level: 10 },
    { id: 'b-07', feature: 'pants:c45a4a:8a3d34:long', name: 'Trening rosu', level: 10 },
  ],
  footwear: [
    { id: 'fw-01', feature: 'shoes:f5f2ea:cfc7b5', name: 'Sneakers albi', level: 1 },
    { id: 'fw-02', feature: 'shoes:4a4340:2d2826', name: 'Adidasi negri', level: 1 },
    { id: 'fw-03', feature: 'shoes:c45a4a:8a3d34', name: 'Pantofi rosii', level: 5 },
    { id: 'fw-04', feature: 'shoes:8a6a44:5d4528', name: 'Ghete', level: 10 },
    { id: 'fw-05', feature: 'shoes:5ea06a:3e7a4a', name: 'Adidasi verzi', level: 10 },
  ],
  holding: [
    { id: 'hd-00', feature: null, name: 'Mana libera', level: 1 },
    { id: 'hd-01', feature: 'hand::::book', name: 'Carte', level: 5 },
    { id: 'hd-02', feature: 'hand::::ball', name: 'Minge', level: 5 },
    { id: 'hd-03', feature: 'hand::::phone', name: 'Telefon', level: 10 },
    { id: 'hd-04', feature: 'hand::::plant', name: 'Planta', level: 20 },
    { id: 'hd-05', feature: 'hand::::skateboard', name: 'Skateboard', level: 30 },
  ],
};

export type AvatarPicks = {
  skin: string;
  hairColor: string;
  hair: string;
  eyes: string;
  mouth: string;
  eyebrows: string;
  glasses: string;
  earrings: string;
  bodyShape: string;
  top: string;
  outerwear: string;
  bottom: string;
  footwear: string;
  holding: string;
};

export const DEFAULT_PICKS: AvatarPicks = {
  skin: 'skin-02',
  hairColor: 'hc-02',
  hair: 'h-02',
  eyes: 'e-01',
  mouth: 'm-01',
  eyebrows: 'b-03',
  glasses: 'g-00',
  earrings: 'a-00',
  bodyShape: 'bs-medium',
  top: 't-01',
  outerwear: 'ow-00',
  bottom: 'b-01',
  footwear: 'fw-01',
  holding: 'hd-00',
};

// Bump when the rendered SVG output changes (new layers, geometry, etc.).
// Existing avatars are re-rendered on next read when their version is older.
export const CATALOG_VERSION = 2;

export const ALL_SLOTS: Slot[] = [
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
];

export function findItem(slot: Slot, id: string | null | undefined): Item | undefined {
  if (!id) return undefined;
  return CATALOG[slot].find((x) => x.id === id);
}

// Validate a picks object: all slots present, each id exists in catalog,
// nothing locked above the user's level.
export function validatePicks(
  picks: AvatarPicks,
  userLevel: number,
): { ok: true } | { ok: false; reason: string } {
  for (const slot of ALL_SLOTS) {
    const id = picks[slot];
    if (typeof id !== 'string' || !id) {
      return { ok: false, reason: `slot_missing:${slot}` };
    }
    const item = findItem(slot, id);
    if (!item) return { ok: false, reason: `unknown_item:${slot}:${id}` };
    if (item.level > userLevel) {
      return { ok: false, reason: `locked:${slot}:${id}:requires_lvl_${item.level}` };
    }
  }
  return { ok: true };
}
