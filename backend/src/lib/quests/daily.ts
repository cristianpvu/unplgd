// Daily quests — 3 mini-taskuri/zi/user, populate lazy din pool ponderat.
//
// Selectia e DETERMINISTIC pe (userId, date) — kid-ul vede acelasi set toata
// ziua, dar diferit fata de un alt user, si diferit maine. Asa nu poate
// refresha pana primeste quest-urile pe care le vrea ("gaming").
//
// Reset la 00:00 Europe/Bucharest. `questDate` se stocheaza ca string
// 'YYYY-MM-DD' calculat pe tz Bucharest, deci re-deploy in tz diferit nu
// invalideaza intrarile.

import { prisma } from '../prisma.js';
import { logger } from '../logger.js';

const BUCHAREST_TZ = 'Europe/Bucharest';

export function questDateForNow(now: Date = new Date()): string {
  // 'sv-SE' produce YYYY-MM-DD nativ.
  return new Intl.DateTimeFormat('sv-SE', { timeZone: BUCHAREST_TZ }).format(now);
}

// Day of week in Bucharest tz: 0=Sunday, 1=Mon...6=Sat. Mapat la chei
// scurte folosite in weekdayBoost JSON.
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

function weekdayKey(now: Date = new Date()): WeekdayKey {
  const tzDate = new Date(now.toLocaleString('en-US', { timeZone: BUCHAREST_TZ }));
  return WEEKDAY_KEYS[tzDate.getDay()] ?? 'mon';
}

// Hash determinist (userId + date) → 32-bit unsigned. Folosit ca seed pt RNG.
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Mulberry32 — PRNG simplu, deterministic, suficient pentru selectie quest.
function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type Template = {
  slug: string;
  kind: string;
  requiredCount: number;
  baseXp: number;
  difficulty: string;
  weight: number;
  weekdayBoost: Record<string, number>;
  title: string;
  description: string;
  icon: string;
};

// Pick N quests distincte (pe `kind` distinct ca sa nu primeasca acelasi tip
// de 2 ori, ex. nfc_meet_1 si nfc_meet_2 in aceeasi zi).
function pickQuests(
  templates: Template[],
  count: number,
  rng: () => number,
  weekday: WeekdayKey,
): Template[] {
  const remaining = templates.map((t) => ({
    ...t,
    effectiveWeight: t.weight * (t.weekdayBoost[weekday] ?? 1),
  }));
  const picked: Template[] = [];
  const usedKinds = new Set<string>();

  while (picked.length < count && remaining.length > 0) {
    const available = remaining.filter((t) => !usedKinds.has(t.kind));
    if (available.length === 0) break;

    const totalWeight = available.reduce((s, t) => s + t.effectiveWeight, 0);
    if (totalWeight <= 0) break;

    let roll = rng() * totalWeight;
    let chosen: typeof available[number] | null = null;
    for (const t of available) {
      roll -= t.effectiveWeight;
      if (roll <= 0) {
        chosen = t;
        break;
      }
    }
    if (!chosen) chosen = available[available.length - 1] ?? null;
    if (!chosen) break;

    picked.push(chosen);
    usedKinds.add(chosen.kind);
  }

  return picked;
}

export type QuestSlotData = {
  slot: number;
  slug: string;
  kind: string;
  title: string;
  description: string;
  icon: string;
  difficulty: string;
  requiredCount: number;
  xpReward: number;
  progress: number;
  completedAt: Date | null;
};

export type DailyQuestState = {
  questDate: string;
  quests: QuestSlotData[];
  allComplete: boolean;
  chestTier: 'BRONZE' | 'SILVER' | 'GOLD' | null;
  chestId: string | null;
  chestOpenedAt: Date | null;
};

// Chest tier in functie de dificultatea cumulata a celor 3 quests. Adunam
// dificultate pondata: easy=1, medium=2, hard=3. Total: min 3 (3xeasy), max 9
// (3xhard). Praguri:
//   3-4  → BRONZE
//   5-7  → SILVER
//   8-9  → GOLD
function chestTierForQuests(quests: QuestSlotData[]): 'BRONZE' | 'SILVER' | 'GOLD' {
  const weight = (d: string) => (d === 'hard' ? 3 : d === 'medium' ? 2 : 1);
  const total = quests.reduce((s, q) => s + weight(q.difficulty), 0);
  if (total >= 8) return 'GOLD';
  if (total >= 5) return 'SILVER';
  return 'BRONZE';
}

/**
 * Returneaza setul de quests pt user-ul + ziua curenta. Lazy: daca nu exista
 * randuri pt questDate, le creeaza din pool. Idempotent prin unique (userId,
 * questDate, slot).
 */
export async function getOrCreateDailyQuests(
  userId: string,
  now: Date = new Date(),
): Promise<DailyQuestState> {
  const questDate = questDateForNow(now);

  let existing = await prisma.dailyQuest.findMany({
    where: { userId, questDate },
    orderBy: { slot: 'asc' },
    include: { template: true },
  });

  if (existing.length === 0) {
    // Generam din pool.
    const allTemplates = await prisma.questTemplate.findMany({ where: { active: true } });
    if (allTemplates.length === 0) {
      logger.warn({ userId, questDate }, 'daily_quests.no_templates');
      return emptyState(questDate);
    }

    const seed = hashSeed(`${userId}|${questDate}`);
    const rng = mulberry32(seed);
    const wkey = weekdayKey(now);

    const templates: Template[] = allTemplates.map((t) => ({
      slug: t.slug,
      kind: t.kind,
      requiredCount: t.requiredCount,
      baseXp: t.baseXp,
      difficulty: t.difficulty,
      weight: t.weight,
      weekdayBoost: (t.weekdayBoost as Record<string, number>) ?? {},
      title: t.title,
      description: t.description,
      icon: t.icon,
    }));

    const picked = pickQuests(templates, 3, rng, wkey);
    if (picked.length === 0) {
      logger.warn({ userId, questDate }, 'daily_quests.pick_empty');
      return emptyState(questDate);
    }

    // Insert race-safe: alt request paralel poate sa fi facut create. Tolerate
    // P2002 — re-fetch.
    try {
      await prisma.dailyQuest.createMany({
        data: picked.map((t, idx) => ({
          userId,
          questDate,
          slot: idx,
          slug: t.slug,
          requiredCount: t.requiredCount,
          xpReward: t.baseXp,
          progress: 0,
        })),
        skipDuplicates: true,
      });
    } catch (err) {
      logger.warn({ err, userId, questDate }, 'daily_quests.create_failed');
    }

    existing = await prisma.dailyQuest.findMany({
      where: { userId, questDate },
      orderBy: { slot: 'asc' },
      include: { template: true },
    });
  }

  const quests: QuestSlotData[] = existing.map((dq) => ({
    slot: dq.slot,
    slug: dq.slug,
    kind: dq.template.kind,
    title: dq.template.title,
    description: dq.template.description,
    icon: dq.template.icon,
    difficulty: dq.template.difficulty,
    requiredCount: dq.requiredCount,
    xpReward: dq.xpReward,
    progress: dq.progress,
    completedAt: dq.completedAt,
  }));

  const allComplete = quests.length > 0 && quests.every((q) => q.completedAt != null);
  const chestTier = allComplete ? chestTierForQuests(quests) : null;

  // Verificam daca chest-ul a fost deja acordat (idempotency).
  let chestId: string | null = null;
  let chestOpenedAt: Date | null = null;
  if (allComplete) {
    const chest = await prisma.chest.findFirst({
      where: { userId, sourceType: 'daily_quest', sourceId: questDate },
      select: { id: true, openedAt: true },
    });
    if (chest) {
      chestId = chest.id;
      chestOpenedAt = chest.openedAt;
    }
  }

  return { questDate, quests, allComplete, chestTier, chestId, chestOpenedAt };
}

function emptyState(questDate: string): DailyQuestState {
  return { questDate, quests: [], allComplete: false, chestTier: null, chestId: null, chestOpenedAt: null };
}
