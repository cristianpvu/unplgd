// Quest progress — apelat din locurile unde se intampla evenimente. Bump-uieste
// progres pe quest-urile zilei curente care match-uiesc `kind`. Cand progresul
// atinge `requiredCount`, marcheaza `completedAt = now()` si acorda XP user.
//
// La a 3-a quest completa pe ziua respectiva, acorda automat chest-ul daily.
// Idempotent prin Chest.findFirst pe (userId, 'daily_quest', questDate).
//
// Fire-and-forget din call-sites — daca pica, nu strica event-ul principal.

import { ChestTier, Rarity } from '@prisma/client';
import { prisma } from '../prisma.js';
import { logger } from '../logger.js';
import { awardXp } from '../xp.js';
import { questDateForNow } from './daily.js';
import { loadDroppableItems, loadTierConfigs, rollItemsForTier, type ChestLoot } from '../phonedown/award.js';

// Kinds canonice mapate la quest templates. Match cu QuestTemplate.kind.
export type QuestKind =
  | 'nfc_meet'
  | 'story_verify'
  | 'story_author'
  | 'hunt_win'
  | 'hunt_monster'
  | 'adventure_node'
  | 'cocreation'
  | 'phonedown_winner'
  | 'phonedown_participate'
  | 'journey_chapter'
  | 'explicit_like';

const TIER_BY_TOTAL: Record<'BRONZE' | 'SILVER' | 'GOLD', ChestTier> = {
  BRONZE: ChestTier.BRONZE,
  SILVER: ChestTier.SILVER,
  GOLD: ChestTier.GOLD,
};

/**
 * Bump-uieste +increment pe TOATE quest-urile active de tipul `kind` pe ziua
 * curenta. Idempotency-ul nu e pe sursa (un singur eveniment poate bumpa mai
 * multe quests cu requiredCount diferite — ex. nfc_meet_1 + nfc_meet_2 ar fi
 * picked impreuna; in seed-ul nostru kinds sunt distincte deci max 1 quest/kind
 * per zi).
 */
export async function bumpQuestProgress(
  userId: string,
  kind: QuestKind,
  increment: number = 1,
): Promise<void> {
  try {
    const today = questDateForNow();
    const active = await prisma.dailyQuest.findMany({
      where: {
        userId,
        questDate: today,
        completedAt: null,
        template: { kind },
      },
      include: { template: true },
    });

    if (active.length === 0) return;

    for (const dq of active) {
      const newProgress = Math.min(dq.requiredCount, dq.progress + increment);
      const justCompleted = newProgress >= dq.requiredCount && dq.completedAt == null;

      await prisma.dailyQuest.update({
        where: { id: dq.id },
        data: {
          progress: newProgress,
          completedAt: justCompleted ? new Date() : undefined,
        },
      });

      if (justCompleted) {
        // Award user XP pt quest individual.
        try {
          await awardXp(userId, dq.xpReward, 'daily_quest', dq.id, `Quest ${dq.slug}`);
        } catch (err) {
          logger.warn({ err, userId, slug: dq.slug }, 'quest_progress.xp_failed');
        }
      }
    }

    // Verificare bonus chest la sfarsit — daca toate 3 sunt complete.
    await maybeAwardDailyChest(userId, today);
  } catch (err) {
    logger.warn({ err, userId, kind }, 'quest_progress.bump_failed');
  }
}

/**
 * Daca toate quest-urile zilei sunt complete, acorda chest-ul daily.
 * Idempotent: Chest cu (userId, sourceType='daily_quest', sourceId=questDate)
 * unic via findFirst-then-create. Tier-ul depinde de dificultatea cumulata.
 */
async function maybeAwardDailyChest(userId: string, questDate: string): Promise<void> {
  const all = await prisma.dailyQuest.findMany({
    where: { userId, questDate },
    include: { template: true },
  });

  if (all.length === 0) return;
  if (!all.every((q) => q.completedAt != null)) return;

  // Existing chest pt aceasta zi?
  const existing = await prisma.chest.findFirst({
    where: { userId, sourceType: 'daily_quest', sourceId: questDate },
    select: { id: true },
  });
  if (existing) return;

  const weight = (d: string) => (d === 'hard' ? 3 : d === 'medium' ? 2 : 1);
  const total = all.reduce((s, q) => s + weight(q.template.difficulty), 0);
  const tier: ChestTier = total >= 8 ? ChestTier.GOLD : total >= 5 ? ChestTier.SILVER : ChestTier.BRONZE;

  // Loot — refolosim helper-ii de la phonedown. ChestTierConfig pt
  // BRONZE/SILVER/GOLD exista deja (seedChestConfig).
  try {
    const configs = await loadTierConfigs();
    const cfg = configs.get(tier);
    if (!cfg) {
      logger.warn({ userId, tier }, 'daily_chest.no_config');
      return;
    }
    const pool = await loadDroppableItems();
    const rolled = rollItemsForTier(cfg, pool);
    const items: ChestLoot['items'] = [];
    const seen = new Set<string>();
    for (const it of rolled) {
      if (seen.has(it.slug)) continue;
      seen.add(it.slug);
      items.push({ itemId: it.id, slug: it.slug, name: it.name, rarity: it.rarity as Rarity });
    }
    const loot: ChestLoot = { xp: cfg.xpBase, items, duplicates: [] };

    await prisma.chest.create({
      data: {
        userId,
        tier,
        sourceType: 'daily_quest',
        sourceId: questDate,
        lootJson: loot as unknown as object,
      },
    });
    logger.info({ userId, tier, questDate }, 'daily_chest.awarded');
  } catch (err) {
    logger.warn({ err, userId, questDate }, 'daily_chest.create_failed');
  }
}

void TIER_BY_TOTAL; // exported in case caller wants the map
