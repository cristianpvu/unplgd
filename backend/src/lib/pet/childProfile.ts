// Snapshot concis al profilului copilului — folosit ca background context
// in chat-ul cu pet-ul. NU e dashboard, NU listeaza scoruri. Pet-ul foloseste
// asta ca sa STIE pe ce sa puna accent, nu ca sa lectureze copilul.
//
// Scope:
//   - top 2 skills (denumire, fara scor)
//   - top 3 domenii (denumire)
//   - 1-2 activitati notabile in ultimele 7 zile (textual, scurt)
//   - bond level (cat de bine cunoaste pet-ul copilul)
//
// Cache: 5 min in Redis per user — chat-ul are rate limit, deci probabil
// nu se cheama mai des, dar evitam loviri repetate de DB pe back-to-back
// mesaje.

import { prisma } from '../prisma.js';
import { redis } from '../redis.js';
import { logger } from '../logger.js';

const CACHE_TTL_SEC = 5 * 60;
const SKILL_WINDOW_DAYS = 30;
const DOMAIN_WINDOW_DAYS = 14;
const ACTIVITY_WINDOW_DAYS = 7;
const MS_PER_DAY = 86400000;

export type ChildProfileSnapshot = {
  topSkills: string[];      // ["creativitate", "curiozitate"]
  topDomains: string[];     // ["spatiu", "dinozauri"]
  recentHighlights: string[]; // ["a scris 2 povesti", "a batut 5 monstri"]
  bondLevel: number;        // 1-5
};

function cacheKey(userId: string): string {
  return `pet:childprofile:${userId}`;
}

// Sursele de evenimente mapate la text legibil pentru prompt. Plural unde
// se aplica — cantitatea o adaugam in front.
const SOURCE_TO_TEXT: Record<string, (n: number) => string> = {
  hunt_monster: (n) => `${n} ${n === 1 ? 'monstru batut' : 'monstri batuti'}`,
  hunt_rank: (n) => `${n} ${n === 1 ? 'vanatoare terminata' : 'vanatori terminate'}`,
  adventure_boss: (n) => `${n} ${n === 1 ? 'boss invins' : 'bossi invinsi'}`,
  adventure_node: (n) => `${n} ${n === 1 ? 'aventura' : 'aventuri'}`,
  journey_chapter: (n) => `${n} ${n === 1 ? 'capitol din journey' : 'capitole din journey'}`,
  story_told: (n) => `${n} ${n === 1 ? 'poveste scrisa' : 'povesti scrise'}`,
  story_listened: (n) => `${n} ${n === 1 ? 'poveste ascultata' : 'povesti ascultate'}`,
  co_creation: (n) => `${n} ${n === 1 ? 'desen comun' : 'desene comune'}`,
  friendship_new: (n) => `${n} ${n === 1 ? 'prieten nou' : 'prieteni noi'}`,
  co_walk: (n) => `${n} ${n === 1 ? 'plimbare cu prieten' : 'plimbari cu prieteni'}`,
};

async function gather(userId: string): Promise<ChildProfileSnapshot> {
  const now = Date.now();
  const skillSince = new Date(now - SKILL_WINDOW_DAYS * MS_PER_DAY);
  const domainSince = new Date(now - DOMAIN_WINDOW_DAYS * MS_PER_DAY);
  const activitySince = new Date(now - ACTIVITY_WINDOW_DAYS * MS_PER_DAY);

  const [skillEvents, domainEvents, allDomains, activityEvents, pet] = await Promise.all([
    prisma.skillXpTransaction.findMany({
      where: { userId, createdAt: { gte: skillSince } },
      select: { skill: true, amount: true },
    }),
    prisma.domainXpTransaction.findMany({
      where: { userId, createdAt: { gte: domainSince } },
      select: { domainSlug: true, amount: true },
    }),
    prisma.domain.findMany({
      where: { active: true, parentSlug: null },
      select: { slug: true, name: true },
    }),
    prisma.skillXpTransaction.findMany({
      where: { userId, createdAt: { gte: activitySince } },
      select: { sourceType: true },
    }),
    prisma.pet.findUnique({
      where: { userId },
      select: { bondXp: true },
    }),
  ]);

  // Top skills.
  const skillBy = new Map<string, number>();
  for (const e of skillEvents) skillBy.set(e.skill, (skillBy.get(e.skill) ?? 0) + e.amount);
  const topSkills = [...skillBy.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([s]) => s);

  // Top domenii — filtreaza la radacini ca lista de pe dashboard. Daca user-ul
  // are subdomenii multe, le aggregam la radacina lor doar daca e clar (skip
  // logica complicata aici — folosim direct slug-urile root).
  const rootSlugs = new Set(allDomains.map((d) => d.slug));
  const domainBy = new Map<string, number>();
  for (const e of domainEvents) {
    if (rootSlugs.has(e.domainSlug)) {
      domainBy.set(e.domainSlug, (domainBy.get(e.domainSlug) ?? 0) + e.amount);
    }
  }
  const nameBySlug = new Map<string, string>();
  for (const d of allDomains) nameBySlug.set(d.slug, d.name);
  const topDomains = [...domainBy.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([slug]) => nameBySlug.get(slug) ?? slug);

  // Highlights — agregam per sourceType, luam top 2 cu render text.
  const byType = new Map<string, number>();
  for (const e of activityEvents) {
    byType.set(e.sourceType, (byType.get(e.sourceType) ?? 0) + 1);
  }
  const recentHighlights = [...byType.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([type, count]) => {
      const renderer = SOURCE_TO_TEXT[type];
      return renderer ? renderer(count) : null;
    })
    .filter((s): s is string => s !== null);

  const bondLevel = pet ? Math.max(1, Math.min(5, 1 + Math.floor(Math.sqrt(pet.bondXp / 50)))) : 1;

  return { topSkills, topDomains, recentHighlights, bondLevel };
}

/**
 * Snapshot al profilului copilului, cached 5 min.
 * Pune un fallback gol daca DB esueaza — chat-ul nu trebuie sa cada.
 */
export async function getChildProfileSnapshot(userId: string): Promise<ChildProfileSnapshot> {
  const key = cacheKey(userId);

  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as ChildProfileSnapshot;
  } catch (err) {
    logger.warn({ err, userId }, 'child_profile.cache_read_failed');
  }

  let snapshot: ChildProfileSnapshot;
  try {
    snapshot = await gather(userId);
  } catch (err) {
    logger.warn({ err, userId }, 'child_profile.gather_failed');
    snapshot = { topSkills: [], topDomains: [], recentHighlights: [], bondLevel: 1 };
  }

  try {
    await redis.set(key, JSON.stringify(snapshot), 'EX', CACHE_TTL_SEC);
  } catch (err) {
    logger.warn({ err, userId }, 'child_profile.cache_write_failed');
  }

  return snapshot;
}
