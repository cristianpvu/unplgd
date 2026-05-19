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
