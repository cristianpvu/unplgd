import { api } from './client';

export type ChestTier =
  | 'BRONZE'
  | 'SILVER'
  | 'GOLD'
  | 'PLATINUM'
  | 'DIAMOND'
  | 'CHAMPION';

export type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export type ChestLootItem = {
  itemId: string;
  slug: string;
  name: string;
  rarity: Rarity;
  // SVG + viewBox sunt enriched de backend la POST /open (vezi
  // backend/src/lib/phonedown/award.ts). Pot lipsi pentru itemele vechi
  // care nu au feature/attachmentPoint setate.
  svg?: string;
  viewBox?: string;
};

export type ChestLootDuplicate = {
  slug: string;
  name: string;
  rarity?: Rarity;
  shardsXp: number;
  svg?: string;
  viewBox?: string;
};

export type ChestLoot = {
  xp: number;
  items: ChestLootItem[];
  duplicates: ChestLootDuplicate[];
};

export type ChestDto = {
  id: string;
  tier: ChestTier;
  sourceType: string;
  openedAt: string | null;
  createdAt: string;
  loot: ChestLoot | null;
};

export function listChests() {
  return api<{ chests: ChestDto[] }>('/chests');
}

export function openChest(chestId: string) {
  return api<{ loot: ChestLoot }>(`/chests/${chestId}/open`, { method: 'POST' });
}

// Vizual config per tier — culorile + SVG-urile (mini/body/lid) sunt sursa de
// adevar in DB. Mobile fetch-uieste o data si cache-uieste lung; modificarea
// SVG-urilor in DB / fisierelor + re-seed → toti userii vad noile vizualuri
// fara redeploy mobile.
export type ChestTierVisual = {
  tier: ChestTier;
  label: string | null;
  sortOrder: number;
  bgColor: string | null;
  darkColor: string | null;
  fgColor: string | null;
  glowColor: string | null;
  miniSvg: string | null;
  bodySvg: string | null;
  lidSvg: string | null;
};

export function listChestTiers() {
  return api<{ tiers: ChestTierVisual[] }>('/chests/tiers');
}
