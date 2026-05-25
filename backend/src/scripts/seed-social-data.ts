// Seed sintetic REALIST pt evaluarea sistemelor ML (Markov next-domain + park
// matching). Modeleaza comportament plauzibil de copil, NU date "curate":
//
//   - 6 personae cu path canonic de interese + cohorte INEGALE (realismul cere
//     ca unele interese sa fie mai populare).
//   - ~27% useri INDECISI: domenii random, fara persona → noise floor pe care
//     orice app real il are.
//   - Lungime path VARIABILA per copil (1-5 domenii, distributie inclinata):
//     unii exploreaza putin, altii mult.
//   - DEVIATIE per pas (~22%): copilul nu urmeaza mereu traseul "tipic".
//   - ENGAGEMENT variat: heavy / regular / casual / churned (ultimii doar cu
//     activitate veche, fara recenta).
//   - Frecventa sesiuni SPORADICA (Poisson-ish), + vizite INCRUCISATE la alte
//     parcuri (~25%), nu doar parcul "lor".
//
// Reproductibil: RNG seedat per user (hash email) → re-rulare = date identice
// + idempotent (awardXp unic pe sourceId). Cleanup: `--clean`.
//
// REGULA: modelam comportament dintr-o ipoteza, generam, APOI masuram cu
// evaluate-ml.js. NU reglam seed-ul pana ies numere frumoase (cherry-picking).
//
// Usage prod:
//   docker compose -f docker-compose.prod.yml exec backend \
//     node dist/scripts/seed-social-data.js [--clean]

import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/hash.js';
import { ensureDefaultPet } from '../lib/pet.js';
import { awardSkillXp, type Skill } from '../lib/skills.js';
import { awardDomainXp } from '../lib/domains.js';

const TEST_EMAIL_PREFIX = 'test-social-';

type Persona = {
  key: string;
  path: string[]; // path canonic de interese (root domains, ordine descoperire)
  skills: Array<{ skill: Skill; weight: number }>;
  parkIndex: number;
  dayOfWeek: number;
  hour: number;
};

const PERSONAE: Persona[] = [
  { key: 'science', path: ['stiinte', 'tehnologie', 'strategie'],
    skills: [{ skill: 'curiozitate', weight: 0.5 }, { skill: 'logica', weight: 0.5 }],
    parkIndex: 0, dayOfWeek: 6, hour: 10 },
  { key: 'nature', path: ['animale', 'natura', 'stiinte'],
    skills: [{ skill: 'empatie', weight: 0.5 }, { skill: 'curiozitate', weight: 0.5 }],
    parkIndex: 2, dayOfWeek: 3, hour: 17 },
  { key: 'artist', path: ['arta', 'povesti', 'sociale'],
    skills: [{ skill: 'creativitate', weight: 0.6 }, { skill: 'empatie', weight: 0.4 }],
    parkIndex: 1, dayOfWeek: 0, hour: 11 },
  { key: 'athlete', path: ['sport', 'manualitate', 'animale'],
    skills: [{ skill: 'perseverenta', weight: 0.5 }, { skill: 'sociabilitate', weight: 0.5 }],
    parkIndex: 1, dayOfWeek: 0, hour: 16 },
  { key: 'tinkerer', path: ['tehnologie', 'strategie', 'arta'],
    skills: [{ skill: 'logica', weight: 0.5 }, { skill: 'creativitate', weight: 0.5 }],
    parkIndex: 0, dayOfWeek: 4, hour: 18 },
  { key: 'storyteller', path: ['povesti', 'sociale', 'natura'],
    skills: [{ skill: 'creativitate', weight: 0.5 }, { skill: 'curiozitate', weight: 0.5 }],
    parkIndex: 3, dayOfWeek: 6, hour: 15 },
];

const ALL_ROOTS = ['sport', 'animale', 'stiinte', 'arta', 'tehnologie', 'natura', 'povesti', 'manualitate', 'strategie', 'sociale'];
const ALL_SKILLS: Skill[] = ['creativitate', 'curiozitate', 'sociabilitate', 'perseverenta', 'logica', 'empatie'];

// Cohorte INEGALE — unele interese mai populare (realist).
const PERSONA_COHORTS: Array<{ persona: Persona; count: number }> = [
  { persona: PERSONAE[0]!, count: 16 }, // science
  { persona: PERSONAE[1]!, count: 13 }, // nature
  { persona: PERSONAE[2]!, count: 12 }, // artist
  { persona: PERSONAE[3]!, count: 11 }, // athlete
  { persona: PERSONAE[4]!, count: 8 },  // tinkerer
  { persona: PERSONAE[5]!, count: 6 },  // storyteller
];
const UNDECIDED_COUNT = 24; // ~27% din ~90 useri

const DEVIATION_RATE = 0.22; // sansa ca un copil sa devieze de la path la un pas

const NOW = Date.now();
const MS_PER_DAY = 86400000;

// ---------- RNG seedat (reproductibil per user) ----------

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function rangeInt(rng: () => number, min: number, max: number): number {
  return Math.floor(min + rng() * (max - min + 1));
}
function rangeFloat(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}
function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

// ---------- Distributii comportamentale ----------

type Engagement = 'heavy' | 'regular' | 'casual' | 'churned';

function pickEngagement(rng: () => number): Engagement {
  const r = rng();
  if (r < 0.20) return 'heavy';
  if (r < 0.55) return 'regular';
  if (r < 0.80) return 'casual';
  return 'churned';
}

// Lungime path inclinata: majoritatea 2-3, putini 1 sau 4-5.
function pickPathLength(rng: () => number): number {
  const r = rng();
  if (r < 0.12) return 1;
  if (r < 0.45) return 2;
  if (r < 0.75) return 3;
  if (r < 0.92) return 4;
  return 5;
}

// Fereastra de zile (daysAgo) in functie de engagement. Churned = doar vechi.
function engagementWindow(eng: Engagement): { min: number; max: number } {
  switch (eng) {
    case 'heavy': return { min: 1, max: 55 };
    case 'regular': return { min: 2, max: 55 };
    case 'casual': return { min: 4, max: 50 };
    case 'churned': return { min: 28, max: 60 };
  }
}

function reinforceCount(rng: () => number, eng: Engagement): number {
  switch (eng) {
    case 'heavy': return rangeInt(rng, 6, 10);
    case 'regular': return rangeInt(rng, 3, 6);
    case 'casual': return rangeInt(rng, 1, 3);
    case 'churned': return rangeInt(rng, 1, 3);
  }
}

function sessionCount(rng: () => number, eng: Engagement): number {
  switch (eng) {
    case 'heavy': return rangeInt(rng, 6, 11);
    case 'regular': return rangeInt(rng, 3, 6);
    case 'casual': return rangeInt(rng, 1, 2);
    case 'churned': return rangeInt(rng, 0, 2);
  }
}

// ---------- Constructie secventa de domenii ----------

function buildSequence(
  rng: () => number,
  persona: Persona | null,
  length: number,
): string[] {
  const seq: string[] = [];
  const used = new Set<string>();
  const randomUnusedRoot = (): string | null => {
    const avail = ALL_ROOTS.filter((r) => !used.has(r));
    return avail.length ? pick(rng, avail) : null;
  };

  for (let i = 0; i < length; i++) {
    let candidate: string | null = null;
    if (persona && i < persona.path.length && rng() > DEVIATION_RATE) {
      // urmeaza path-ul canonic la acest pas
      const c = persona.path[i]!;
      candidate = used.has(c) ? randomUnusedRoot() : c;
    } else {
      // indecis SAU deviatie SAU dincolo de path canonic → root random
      candidate = randomUnusedRoot();
    }
    if (!candidate) break;
    used.add(candidate);
    seq.push(candidate);
  }
  return seq;
}

// Genereaza `n` valori daysAgo in fereastra, sortate DESCRESCATOR (vechi intai
// = descoperit primul). Garanteaza ordine stricta cu gap minim.
function firstTouchDays(rng: () => number, n: number, win: { min: number; max: number }): number[] {
  const vals: number[] = [];
  for (let i = 0; i < n; i++) vals.push(rangeFloat(rng, win.min, win.max));
  vals.sort((a, b) => b - a); // descrescator
  return vals.map((v) => Math.max(1, Math.round(v)));
}

// ---------- Persistenta cu createdAt fortat ----------

async function awardDomainDated(userId: string, slug: string, amount: number, sourceId: string, daysAgo: number): Promise<void> {
  await awardDomainXp(userId, slug, amount, 'seed_social', sourceId);
  await prisma.domainXpTransaction.updateMany({
    where: { userId, sourceType: 'seed_social', sourceId, domainSlug: slug },
    data: { createdAt: new Date(NOW - daysAgo * MS_PER_DAY) },
  });
}

async function awardSkillDated(userId: string, skill: Skill, amount: number, sourceId: string, daysAgo: number): Promise<void> {
  await awardSkillXp(userId, skill, amount, 'seed_social', sourceId);
  await prisma.skillXpTransaction.updateMany({
    where: { userId, sourceType: 'seed_social', sourceId, skill },
    data: { createdAt: new Date(NOW - daysAgo * MS_PER_DAY) },
  });
}

// ---------- Tipuri user generat ----------

type SeedUser = {
  userId: string;
  rng: () => number;
  persona: Persona | null;
  engagement: Engagement;
  sequence: string[];
};

async function cleanTestUsers(): Promise<number> {
  const result = await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } });
  return result.count;
}

async function findOrCreateUser(label: string, idx: number, rng: () => number): Promise<string> {
  const email = `${TEST_EMAIL_PREFIX}${label}-${idx}@unplgd.dev`;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;

  const ageDays = rangeInt(rng, 7 * 365, 13 * 365);
  const birthDate = new Date(NOW - ageDays * MS_PER_DAY);
  const passwordHash = await hashPassword('test-password-1234');
  const u = await prisma.user.create({
    data: { email, name: `${label.charAt(0).toUpperCase() + label.slice(1)} ${idx + 1}`, passwordHash, birthDate },
  });
  await ensureDefaultPet(u.id);
  return u.id;
}

async function seedXpForUser(su: SeedUser): Promise<void> {
  const { userId, rng, persona, engagement, sequence } = su;
  const win = engagementWindow(engagement);
  const ftDays = firstTouchDays(rng, sequence.length, win);

  for (let i = 0; i < sequence.length; i++) {
    const slug = sequence[i]!;
    const ft = ftDays[i]!;
    // First-touch — cel mai vechi eveniment pe acest domeniu.
    await awardDomainDated(userId, slug, rangeInt(rng, 8, 15), `dom-ft-${i}`, ft);
    // Reinforcement — mai recente (intre win.min si ft), volum dupa engagement.
    const rc = reinforceCount(rng, engagement);
    for (let r = 0; r < rc; r++) {
      const rDays = rangeInt(rng, win.min, Math.max(win.min, ft - 1));
      await awardDomainDated(userId, slug, rangeInt(rng, 5, 18), `dom-rf-${i}-${r}`, rDays);
    }
  }

  // Skills — volum dupa engagement, ponderat pe persona (sau random pt indecisi).
  const skillEvents = engagement === 'heavy' ? 22 : engagement === 'regular' ? 14 : engagement === 'casual' ? 7 : 6;
  for (let k = 0; k < skillEvents; k++) {
    const daysAgo = rangeInt(rng, win.min, win.max);
    let skill: Skill;
    if (persona && rng() > 0.3) {
      const r = rng();
      let cum = 0;
      skill = (persona.skills.find((s) => { cum += s.weight; return r <= cum; }) ?? persona.skills[0]!).skill;
    } else {
      skill = pick(rng, ALL_SKILLS);
    }
    await awardSkillDated(userId, skill, rangeInt(rng, 5, 20), `skill-${k}`, daysAgo);
  }
}

function slotDate(rng: () => number, dayOfWeek: number, hour: number, daysAgo: number): Date {
  const target = new Date(NOW - daysAgo * MS_PER_DAY);
  target.setHours(hour, rangeInt(rng, 0, 50), 0, 0);
  // snap inapoi pana cade pe dayOfWeek
  let guard = 0;
  while (target.getDay() !== dayOfWeek && guard++ < 7) target.setDate(target.getDate() - 1);
  return target;
}

// Pass 1: decide sesiunile fiecarui user (park + data). Pass 2: creeaza
// HuntSession + lobby din pool-ul aceluiasi parc (co-locatie coerenta).
async function seedHuntSessions(su: SeedUser[], parkIds: string[]): Promise<number> {
  type Plan = { userId: string; parkId: string; date: Date };
  const plans: Plan[] = [];
  const parkPool = new Map<string, Set<string>>();

  for (const u of su) {
    const win = engagementWindow(u.engagement);
    const n = sessionCount(u.rng, u.engagement);
    for (let s = 0; s < n; s++) {
      const homePark = u.persona ? parkIds[u.persona.parkIndex] : null;
      // ~75% acasa pt persona kids; restul incrucisat. Indecisii: random.
      const useHome = homePark && u.persona && u.rng() < 0.75;
      const parkId = useHome ? homePark! : pick(u.rng, parkIds);
      const daysAgo = rangeInt(u.rng, win.min, win.max);
      const day = useHome ? u.persona!.dayOfWeek : rangeInt(u.rng, 0, 6);
      const hour = useHome ? u.persona!.hour : rangeInt(u.rng, 9, 19);
      const date = slotDate(u.rng, day, hour, daysAgo);
      if (date.getTime() > NOW || date.getTime() < NOW - 62 * MS_PER_DAY) continue;
      plans.push({ userId: u.userId, parkId, date });
      const pool = parkPool.get(parkId) ?? new Set<string>();
      pool.add(u.userId);
      parkPool.set(parkId, pool);
    }
  }

  const rngByUser = new Map(su.map((u) => [u.userId, u.rng]));
  let created = 0;
  for (const plan of plans) {
    const rng = rngByUser.get(plan.userId)!;
    // dedup idempotent: host+park in fereastra de 30min
    const existing = await prisma.huntSession.findFirst({
      where: {
        hostId: plan.userId, parkId: plan.parkId,
        startedAt: { gte: new Date(plan.date.getTime() - 30 * 60_000), lte: new Date(plan.date.getTime() + 30 * 60_000) },
      },
    });
    if (existing) continue;

    const session = await prisma.huntSession.create({
      data: {
        hostId: plan.userId, parkId: plan.parkId, status: 'COMPLETED',
        durationSec: 1800, startedAt: plan.date,
        endsAt: new Date(plan.date.getTime() + 30 * 60_000),
        endedAt: new Date(plan.date.getTime() + 30 * 60_000),
        monsterCount: 8,
      },
    });
    await prisma.huntLobbyMember.create({ data: { sessionId: session.id, userId: plan.userId } });

    // Lobby: 1-3 useri din pool-ul aceluiasi parc (excl host) — co-locatie.
    const pool = [...(parkPool.get(plan.parkId) ?? new Set())].filter((id) => id !== plan.userId);
    const lobbyN = Math.min(pool.length, rangeInt(rng, 1, 3));
    const lobby = new Set<string>();
    let guard = 0;
    while (lobby.size < lobbyN && guard++ < 20) lobby.add(pick(rng, pool));
    for (const memberId of lobby) {
      await prisma.huntLobbyMember.create({ data: { sessionId: session.id, userId: memberId } }).catch(() => {});
    }
    created += 1;
  }
  return created;
}

async function main() {
  if (process.argv.includes('--clean')) {
    const removed = await cleanTestUsers();
    console.log(`[clean] removed ${removed} test users (cascade)`);
    return;
  }

  const parks = await prisma.park.findMany({ orderBy: { areaSqm: 'desc' }, take: 4, select: { id: true, name: true } });
  if (parks.length < 4) {
    console.error(`[error] need >=4 parks, found ${parks.length}. Apeleaza /hunt/parks/nearby cu coords Bucuresti.`);
    process.exit(1);
  }
  console.log(`[parks] using ${parks.length}: ${parks.map((p) => p.name).join(', ')}`);
  const parkIds = parks.map((p) => p.id);

  // 1. Genereaza populatia (persona kids + indecisi) cu trasaturi deterministe.
  const seedUsers: SeedUser[] = [];

  for (const cohort of PERSONA_COHORTS) {
    for (let i = 0; i < cohort.count; i++) {
      const email = `${TEST_EMAIL_PREFIX}${cohort.persona.key}-${i}@unplgd.dev`;
      const rng = mulberry32(hashStr(email));
      const userId = await findOrCreateUser(cohort.persona.key, i, rng);
      const engagement = pickEngagement(rng);
      const length = pickPathLength(rng);
      const sequence = buildSequence(rng, cohort.persona, length);
      seedUsers.push({ userId, rng, persona: cohort.persona, engagement, sequence });
    }
    console.log(`[users] ${cohort.persona.key}: ${cohort.count}`);
  }

  for (let i = 0; i < UNDECIDED_COUNT; i++) {
    const email = `${TEST_EMAIL_PREFIX}undecided-${i}@unplgd.dev`;
    const rng = mulberry32(hashStr(email));
    const userId = await findOrCreateUser('undecided', i, rng);
    const engagement = pickEngagement(rng);
    const length = pickPathLength(rng);
    const sequence = buildSequence(rng, null, length);
    seedUsers.push({ userId, rng, persona: null, engagement, sequence });
  }
  console.log(`[users] undecided: ${UNDECIDED_COUNT}`);
  console.log(`[users] TOTAL: ${seedUsers.length}`);

  // 2. XP per user.
  for (const su of seedUsers) await seedXpForUser(su);
  console.log(`[xp] seeded for ${seedUsers.length} users`);

  // 3. Hunt sessions.
  const sessions = await seedHuntSessions(seedUsers, parkIds);
  console.log(`[sessions] ${sessions} hunt sessions created`);

  // 4. Invalideaza cache ML.
  try {
    const { redis } = await import('../lib/redis.js');
    await redis.del('social:park-aggregates:v2');
    await redis.del('social:markov:matrix:v1');
    console.log('[cache] invalidated park-aggregates + markov');
  } catch (err) {
    console.warn('[cache] invalidate failed:', err);
  }

  console.log('[done] ruleaza `node dist/scripts/evaluate-ml.js` pt precision@k');
}

main()
  .catch((err) => { console.error('[fatal]', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
