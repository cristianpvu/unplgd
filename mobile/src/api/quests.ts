// Mini-taskuri zilnice — 3/zi, generate deterministic pe (user, data).
// Bonus chest la zi completa, tier scaleaza cu dificultate.

import { api } from './client';

export type QuestSlot = {
  slot: number;
  slug: string;
  kind: string;
  title: string;
  description: string;
  icon: string;
  difficulty: 'easy' | 'medium' | 'hard';
  requiredCount: number;
  xpReward: number;
  progress: number;
  completedAt: string | null;
};

export type DailyQuestsState = {
  questDate: string;
  quests: QuestSlot[];
  allComplete: boolean;
  chestTier: 'BRONZE' | 'SILVER' | 'GOLD' | null;
  chestId: string | null;
  chestOpenedAt: string | null;
};

export function getDailyQuests() {
  return api<DailyQuestsState>('/quests/today');
}

export type DailyChest = {
  chest: {
    id: string;
    tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'CHAMPION';
    lootJson: { xp: number; items: { itemId: string; slug: string; name: string; rarity: string }[]; duplicates: unknown[] };
    openedAt: string | null;
    createdAt: string;
  };
};

export function getDailyChest(date: string) {
  return api<DailyChest>(`/quests/chest/${date}`);
}
