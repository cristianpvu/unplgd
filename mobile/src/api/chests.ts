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
};

export type ChestLootDuplicate = {
  slug: string;
  name: string;
  shardsXp: number;
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
