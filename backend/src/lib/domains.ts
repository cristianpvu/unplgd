// Domains = WHAT-ul: subiecte / interese care iti plac. Hierarchice via
// Domain.parentSlug. Acelasi pattern idempotent ca skills, dar cu decay mai
// scurt (21 zile half-life) — interesele copiilor 6-14 pivoteaza lunar.
//
// `domain` din MonsterTemplate, HuntChallenge, AdventureWorld, etc. trebuie
// sa fie slug-uri valide aici. Validare la award (throws daca slug-ul nu
// exista in DB).

import type { PrismaClient } from '@prisma/client';
import { prisma } from './prisma.js';
import { syncDomainEvent } from './graphSync.js';

// Recompense per eveniment. Amount-ul e o singura cifra — domeniile primesc
// scor per sursa (vs skills care primesc map de skill→amount). sourceType
// distinct per categorie de eveniment.
export const DOMAIN_REWARDS = {
  HUNT_MONSTER_DEFEATED: 15,
  HUNT_CHALLENGE_CORRECT: 5,
  ADVENTURE_BOSS_DEFEATED: 25,
  ADVENTURE_NODE_COMPLETED: 8,
  JOURNEY_QUESTION_CORRECT: 5,
  STORY_AUTHORED: 15,
  STORY_LISTENED: 8,
  PET_TOPIC_DETECTED: 3, // per mesaj cu topic clar — capat la 5/zi/topic in code
  EXPLICIT_LIKE: 30, // buton "imi place" pe un content tag-uit
} as const;

// Decay: half-life 21 zile (interesele pivoteaza lunar).
const HALF_LIFE_DAYS = 21;
const LAMBDA = Math.LN2 / HALF_LIFE_DAYS;
const MS_PER_DAY = 86400000;

// Praguri level pentru domenii — mai mici decat skills pt ca decay-ul e mai
// rapid (steady-state realist ~150-450 chiar la engagement intens).
const LEVEL_THRESHOLDS = [0, 20, 80, 200, 400] as const;
const LEVEL_NAMES = ['Curios', 'Pasionat', 'Pasionat ++', 'Expert', 'Maestru'] as const;

export function domainScoreToLevel(score: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (score >= (LEVEL_THRESHOLDS[i] ?? 0)) return i + 1;
  }
  return 1;
}

export function domainLevelName(level: number): string {
  const idx = Math.max(0, Math.min(LEVEL_NAMES.length - 1, level - 1));
  return LEVEL_NAMES[idx] ?? LEVEL_NAMES[0];
}

type Tx = PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export type DomainAwardResult = {
  alreadyAwarded: boolean;
  amount: number;
  domainSlug: string;
};

/**
 * Idempotent grant pe (userId, domainSlug, sourceType, sourceId).
 * Re-run = no-op. Throws daca slug-ul nu exista in Domain.
 */
export async function awardDomainXp(
  userId: string,
  domainSlug: string,
  amount: number,
  sourceType: string,
  sourceId: string,
  description?: string,
  client: Tx = prisma,
): Promise<DomainAwardResult> {
  // Validare existenta domain — FK pe DB ar arunca oricum, dar mesaj curat e util.
  const domain = await client.domain.findUnique({ where: { slug: domainSlug } });
  if (!domain) {
    throw new Error(`Invalid domain slug: ${domainSlug}`);
  }
  if (!domain.active) {
    return { alreadyAwarded: true, amount: 0, domainSlug };
  }

  const existing = await client.domainXpTransaction.findUnique({
    where: {
      userId_domainSlug_sourceType_sourceId: {
        userId,
        domainSlug,
        sourceType,
        sourceId,
      },
    },
  });
  if (existing) {
    return { alreadyAwarded: true, amount: 0, domainSlug };
  }

  await client.domainXpTransaction.create({
    data: { userId, domainSlug, amount, sourceType, sourceId, description },
  });

  void syncDomainEvent(userId, domainSlug, amount).catch(() => {});

  return { alreadyAwarded: false, amount, domainSlug };
}

/**
 * Score cu decay aplicat — half-life 21 zile.
 */
export async function calculateDomainScore(
  userId: string,
  domainSlug: string,
  now: Date = new Date(),
  client: Tx = prisma,
): Promise<number> {
  const events = await client.domainXpTransaction.findMany({
    where: { userId, domainSlug },
    select: { amount: true, createdAt: true },
  });

  return events.reduce((sum, e) => {
    const days = (now.getTime() - e.createdAt.getTime()) / MS_PER_DAY;
    return sum + e.amount * Math.exp(-LAMBDA * days);
  }, 0);
}

export type DomainScore = {
  slug: string;
  parentSlug: string | null;
  name: string;
  icon: string | null;
  kind: string;
  score: number;
  level: number;
  levelName: string;
};

/**
 * Toate domeniile cu scor — pentru GET /me/domains.
 * Aplica decay-ul in JS. Include domeniile cu scor 0 (utile pt UI de
 * "neexplorat inca").
 */
export async function getAllDomainScores(
  userId: string,
  now: Date = new Date(),
  client: Tx = prisma,
): Promise<DomainScore[]> {
  const [domains, events] = await Promise.all([
    client.domain.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    client.domainXpTransaction.findMany({
      where: { userId },
      select: { domainSlug: true, amount: true, createdAt: true },
    }),
  ]);

  const scoreBy = new Map<string, number>();
  for (const e of events) {
    const days = (now.getTime() - e.createdAt.getTime()) / MS_PER_DAY;
    const decayed = e.amount * Math.exp(-LAMBDA * days);
    scoreBy.set(e.domainSlug, (scoreBy.get(e.domainSlug) ?? 0) + decayed);
  }

  return domains.map((d) => {
    const score = Math.round(scoreBy.get(d.slug) ?? 0);
    const level = domainScoreToLevel(score);
    return {
      slug: d.slug,
      parentSlug: d.parentSlug,
      name: d.name,
      icon: d.icon,
      kind: d.kind,
      score,
      level,
      levelName: domainLevelName(level),
    };
  });
}

/**
 * Top N domenii dupa scor — pentru "constelatie" UI. Doar radacinile (fara
 * parent) pt ca dashboard-ul sa fie clar. Filtreaza scor > 0 implicit.
 */
export async function getTopRootDomains(
  userId: string,
  limit: number = 10,
  now: Date = new Date(),
  client: Tx = prisma,
): Promise<DomainScore[]> {
  const all = await getAllDomainScores(userId, now, client);
  return all
    .filter((d) => d.parentSlug === null && d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
