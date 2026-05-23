// Skills = traits ale copilului (creativitate, perseverenta, sociabilitate...).
// Acumulate din evenimente existente (hunt, story, NFC, chat). Scorul efectiv
// se calculeaza la query cu decay exponential half-life 60 zile — profilul
// reflecta cine esti acum, nu cine ai fost cumulativ.
//
// Idempotent: awardSkillXp re-rulat cu acelasi (userId, skill, sourceType,
// sourceId) e no-op (unique constraint pe SkillXpTransaction).
//
// Sync Neo4j: fire-and-forget la final, nu blocheaza request-ul.

import type { PrismaClient } from '@prisma/client';
import { prisma } from './prisma.js';
import { syncSkillEvent } from './graphSync.js';

export const SKILLS_VALID = [
  'creativitate',
  'curiozitate',
  'sociabilitate',
  'perseverenta',
  'logica',
  'empatie',
] as const;

export type Skill = (typeof SKILLS_VALID)[number];

// Recompense mapate la evenimente reale din app. sourceType-urile aici trebuie
// sa fie unice global (la fel ca la XpTransaction). Extindem dupa cum cuplam
// mai multe surse.
export const SKILL_REWARDS = {
  // Hunt outdoor
  HUNT_MONSTER_DEFEATED: { perseverenta: 8, logica: 10 },
  HUNT_RANK_1: { perseverenta: 15, sociabilitate: 5 },
  HUNT_RANK_2: { perseverenta: 10 },
  HUNT_RANK_3: { perseverenta: 6 },

  // Story Adventure
  ADVENTURE_BOSS_DEFEATED: { perseverenta: 15, curiozitate: 8, logica: 5 },
  ADVENTURE_NODE_CORRECT: { curiozitate: 4, logica: 3 },
  JOURNEY_QUESTION_CORRECT: { logica: 3, curiozitate: 5 },
  JOURNEY_CHAPTER_COMPLETED: { perseverenta: 10, curiozitate: 5 },

  // Povesti
  STORY_AUTHORED: { creativitate: 25, curiozitate: 10 },
  STORY_LISTENED_VERIFIED: { empatie: 12, sociabilitate: 5 },
  STORY_CHAIN_EXTENDED: { creativitate: 15, empatie: 8 },

  // Co-creatie (desen)
  CO_CREATION_COMPLETED: { creativitate: 30, empatie: 10, sociabilitate: 8 },

  // NFC + prieteni
  FRIENDSHIP_NEW: { sociabilitate: 25 },
  DAILY_INTERACTION: { sociabilitate: 5 },
  CO_WALK_COMPLETED: { sociabilitate: 15, empatie: 5 },

  // Pet chat (un increment mic per mesaj — capped client-side la zi)
  PET_MESSAGE: { curiozitate: 1 },

  // PhoneDown — rezistenta = perseverenta
  PHONE_DOWN_WINNER: { perseverenta: 30 },
  PHONE_DOWN_PARTICIPATION: { perseverenta: 10, sociabilitate: 3 },
} as const;

// Decay: half-life 60 zile (skills = traits, schimba lent).
const HALF_LIFE_DAYS = 60;
const LAMBDA = Math.LN2 / HALF_LIFE_DAYS;
const MS_PER_DAY = 86400000;

// Praguri level discrete: 1-5 cu nume RPG (afisate in UI).
// Pragurile sunt mai blande decat user XP curve pentru ca scorul are decay
// si nu acumuleaza la infinit — peak realist ~1500 pt heavy user.
const LEVEL_THRESHOLDS = [0, 50, 200, 500, 1000] as const;
export const LEVEL_NAMES = ['Novice', 'Explorator', 'Aventurier', 'Erou', 'Maestru'] as const;

export function scoreToLevel(score: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (score >= (LEVEL_THRESHOLDS[i] ?? 0)) return i + 1;
  }
  return 1;
}

export function levelName(level: number): string {
  const idx = Math.max(0, Math.min(LEVEL_NAMES.length - 1, level - 1));
  return LEVEL_NAMES[idx] ?? LEVEL_NAMES[0];
}

type Tx = PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export type SkillAwardResult = {
  alreadyAwarded: boolean;
  amount: number;
  skill: Skill;
};

/**
 * Idempotent grant pe (userId, skill, sourceType, sourceId).
 * Re-run = no-op, returneaza alreadyAwarded=true.
 */
export async function awardSkillXp(
  userId: string,
  skill: Skill,
  amount: number,
  sourceType: string,
  sourceId: string,
  description?: string,
  client: Tx = prisma,
): Promise<SkillAwardResult> {
  if (!SKILLS_VALID.includes(skill)) {
    throw new Error(`Invalid skill: ${skill}`);
  }

  const existing = await client.skillXpTransaction.findUnique({
    where: {
      userId_skill_sourceType_sourceId: { userId, skill, sourceType, sourceId },
    },
  });
  if (existing) {
    return { alreadyAwarded: true, amount: 0, skill };
  }

  await client.skillXpTransaction.create({
    data: { userId, skill, amount, sourceType, sourceId, description },
  });

  // Fire-and-forget sync Neo4j — nu astept, nu prind exceptii.
  void syncSkillEvent(userId, skill, amount).catch(() => {});

  return { alreadyAwarded: false, amount, skill };
}

/**
 * Acordeaza toate skill-urile pentru un eveniment (reward map).
 * Ex: awardSkillsForEvent(userId, 'hunt_monster', monsterId, SKILL_REWARDS.HUNT_MONSTER_DEFEATED)
 * → award separat per (skill, amount) cu acelasi sourceId.
 */
export async function awardSkillsForEvent(
  userId: string,
  sourceType: string,
  sourceId: string,
  rewards: Partial<Record<Skill, number>>,
  description?: string,
  client: Tx = prisma,
): Promise<SkillAwardResult[]> {
  const results: SkillAwardResult[] = [];
  for (const [skill, amount] of Object.entries(rewards)) {
    if (!amount || amount <= 0) continue;
    results.push(
      await awardSkillXp(userId, skill as Skill, amount, sourceType, sourceId, description, client),
    );
  }
  return results;
}

/**
 * Score cu decay aplicat — half-life 60 zile.
 * scoreNow = Σ amountᵢ · exp(-λ · (now - tᵢ)) in zile.
 *
 * Implementare naiva (read all events). Pentru scale: pre-aggregate weekly,
 * cache in Redis. Pentru MVP licenta: ok pana la ~1000 evenimente/user.
 */
export async function calculateSkillScore(
  userId: string,
  skill: Skill,
  now: Date = new Date(),
  client: Tx = prisma,
): Promise<number> {
  const events = await client.skillXpTransaction.findMany({
    where: { userId, skill },
    select: { amount: true, createdAt: true },
  });

  return events.reduce((sum, e) => {
    const days = (now.getTime() - e.createdAt.getTime()) / MS_PER_DAY;
    return sum + e.amount * Math.exp(-LAMBDA * days);
  }, 0);
}

/**
 * Toate cele 6 skill-uri cu scor + level. Folosit la GET /me/skills.
 * O singura interogare cu group implicit in JS (sub 1000 events e mai rapid
 * decat 6 query-uri separate).
 */
export type SkillScore = {
  skill: Skill;
  score: number;
  level: number;
  levelName: string;
};

export async function getAllSkillScores(
  userId: string,
  now: Date = new Date(),
  client: Tx = prisma,
): Promise<SkillScore[]> {
  const events = await client.skillXpTransaction.findMany({
    where: { userId },
    select: { skill: true, amount: true, createdAt: true },
  });

  const bySkill = new Map<Skill, number>();
  for (const skill of SKILLS_VALID) bySkill.set(skill, 0);

  for (const e of events) {
    if (!SKILLS_VALID.includes(e.skill as Skill)) continue;
    const days = (now.getTime() - e.createdAt.getTime()) / MS_PER_DAY;
    const decayed = e.amount * Math.exp(-LAMBDA * days);
    bySkill.set(e.skill as Skill, (bySkill.get(e.skill as Skill) ?? 0) + decayed);
  }

  return SKILLS_VALID.map((skill) => {
    const score = Math.round(bySkill.get(skill) ?? 0);
    const level = scoreToLevel(score);
    return { skill, score, level, levelName: levelName(level) };
  });
}
