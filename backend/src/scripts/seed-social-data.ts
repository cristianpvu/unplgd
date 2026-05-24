// Seed sintetic pt testarea sistemului de park matching.
//
// Genereaza:
//   - 12 useri "test-social-N@unplgd.dev" cu personae distincte (space / sport /
//     nature / tech / mixed)
//   - SkillXp + DomainXp pe ultimele 60 zile, in concordanta cu persona
//   - ~50 hunt sessions COMPLETED distribuite in primele 3-4 parcuri din DB,
//     pe zile/ore diferite, cu 3-6 participanti/sessiune
//
// Idempotent — re-rulare gaseste user-ii existenti dupa email si NU recreaza.
//
// Cleanup: `node dist/scripts/seed-social-data.js --clean` sterge toti userii
// cu prefix `test-social-` (CASCADE pe tot ce au creat ei).
//
// Usage in prod:
//   docker compose -f docker-compose.prod.yml exec backend \
//     node dist/scripts/seed-social-data.js
//
// Sau cu --clean inainte ca sa resetezi.

import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/hash.js';
import { ensureDefaultPet } from '../lib/pet.js';
import { awardSkillXp, type Skill } from '../lib/skills.js';
import { awardDomainXp } from '../lib/domains.js';

const TEST_EMAIL_PREFIX = 'test-social-';

type Persona = {
  key: string;
  // Domeniile pe care le iubeste (slug-uri root) si pondere relativa.
  domains: Array<{ slug: string; weight: number }>;
  // Skills pe care le creste (skill -> weight).
  skills: Array<{ skill: Skill; weight: number }>;
  // Parcuri si zile/ore preferate (indici in lista de parcuri / slotwheel).
  preferredSlots: Array<{ parkIndex: number; dayOfWeek: number; hour: number }>;
};

// Slug-urile aici trebuie sa fie valide root domains in DB (din seed-domains).
const PERSONAE: Persona[] = [
  {
    key: 'space',
    domains: [
      { slug: 'stiinte', weight: 0.5 },
      { slug: 'tehnologie', weight: 0.3 },
      { slug: 'povesti', weight: 0.2 },
    ],
    skills: [
      { skill: 'curiozitate', weight: 0.5 },
      { skill: 'logica', weight: 0.3 },
      { skill: 'creativitate', weight: 0.2 },
    ],
    // Iubitorii de spatiu se aduna Cismigiu sambata dimineata.
    preferredSlots: [
      { parkIndex: 0, dayOfWeek: 6, hour: 10 }, // sambata 10
      { parkIndex: 0, dayOfWeek: 6, hour: 11 },
      { parkIndex: 1, dayOfWeek: 0, hour: 11 }, // duminica 11
    ],
  },
  {
    key: 'sport',
    domains: [
      { slug: 'sport', weight: 0.6 },
      { slug: 'sociale', weight: 0.3 },
      { slug: 'strategie', weight: 0.1 },
    ],
    skills: [
      { skill: 'perseverenta', weight: 0.5 },
      { skill: 'sociabilitate', weight: 0.5 },
    ],
    preferredSlots: [
      { parkIndex: 1, dayOfWeek: 0, hour: 16 }, // duminica 16 herastrau
      { parkIndex: 1, dayOfWeek: 0, hour: 17 },
      { parkIndex: 2, dayOfWeek: 5, hour: 17 },
    ],
  },
  {
    key: 'nature',
    domains: [
      { slug: 'natura', weight: 0.5 },
      { slug: 'animale', weight: 0.4 },
      { slug: 'arta', weight: 0.1 },
    ],
    skills: [
      { skill: 'empatie', weight: 0.5 },
      { skill: 'curiozitate', weight: 0.5 },
    ],
    preferredSlots: [
      { parkIndex: 2, dayOfWeek: 3, hour: 17 }, // miercuri 17 tineret
      { parkIndex: 2, dayOfWeek: 3, hour: 18 },
      { parkIndex: 0, dayOfWeek: 6, hour: 15 },
    ],
  },
  {
    key: 'tech',
    domains: [
      { slug: 'tehnologie', weight: 0.6 },
      { slug: 'strategie', weight: 0.3 },
      { slug: 'manualitate', weight: 0.1 },
    ],
    skills: [
      { skill: 'logica', weight: 0.6 },
      { skill: 'creativitate', weight: 0.4 },
    ],
    preferredSlots: [
      { parkIndex: 1, dayOfWeek: 4, hour: 18 }, // joi 18
      { parkIndex: 0, dayOfWeek: 6, hour: 11 },
    ],
  },
];

// 3 useri per persona → 12 total.
const USERS_PER_PERSONA = 3;

// Cate hunt sessions sintetice cream per slot preferat al fiecarui user.
// Fiecare user vine la slot-ul lui de ~4 ori in 60 zile (saptamanal).
const SESSIONS_PER_USER_SLOT = 4;

const NOW = Date.now();
const MS_PER_DAY = 86400000;

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]!);
  }
  return out;
}

async function cleanTestUsers(): Promise<number> {
  const result = await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_EMAIL_PREFIX } },
  });
  return result.count;
}

async function findOrCreateUser(persona: string, idx: number): Promise<string> {
  const email = `${TEST_EMAIL_PREFIX}${persona}-${idx}@unplgd.dev`;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;

  // Varsta 7-13 ani random.
  const ageDays = Math.floor(randomInRange(7 * 365, 13 * 365));
  const birthDate = new Date(NOW - ageDays * MS_PER_DAY);
  const passwordHash = await hashPassword('test-password-1234');

  const u = await prisma.user.create({
    data: {
      email,
      name: `${persona.charAt(0).toUpperCase() + persona.slice(1)} ${idx + 1}`,
      passwordHash,
      birthDate,
    },
  });
  await ensureDefaultPet(u.id);
  return u.id;
}

async function seedXpForUser(userId: string, persona: Persona): Promise<void> {
  // 30 evenimente skill / domain peste 60 zile, distribuite uniform.
  // sourceId unic per (userId, idx) ca awardXp sa fie idempotent la re-rulare.
  for (let i = 0; i < 30; i++) {
    const daysAgo = Math.floor(randomInRange(0, 55));
    const ageMs = daysAgo * MS_PER_DAY;
    const fakeCreatedAt = new Date(NOW - ageMs);

    // Pondereaza random pe distributia persona.
    const r = Math.random();
    let cum = 0;
    const pickedSkill = persona.skills.find((s) => {
      cum += s.weight;
      return r <= cum;
    }) ?? persona.skills[0]!;

    const r2 = Math.random();
    let cum2 = 0;
    const pickedDomain = persona.domains.find((d) => {
      cum2 += d.weight;
      return r2 <= cum2;
    }) ?? persona.domains[0]!;

    const sourceId = `seed:${persona.key}:${userId.slice(-6)}:${i}`;
    const amount = Math.floor(randomInRange(5, 20));

    await awardSkillXp(userId, pickedSkill.skill, amount, 'seed_social', sourceId);
    await awardDomainXp(userId, pickedDomain.slug, amount, 'seed_social', sourceId);

    // Manual override pentru createdAt (awardSkillXp si awardDomainXp folosesc
    // default now(). Ajustam direct rand-ul ca decay-ul sa simuleze 60 zile.)
    await prisma.skillXpTransaction.updateMany({
      where: { userId, sourceType: 'seed_social', sourceId, skill: pickedSkill.skill },
      data: { createdAt: fakeCreatedAt },
    });
    await prisma.domainXpTransaction.updateMany({
      where: {
        userId,
        sourceType: 'seed_social',
        sourceId,
        domainSlug: pickedDomain.slug,
      },
      data: { createdAt: fakeCreatedAt },
    });
  }
}

async function seedHuntSessions(
  parkIds: string[],
  usersByPersona: Map<string, string[]>,
): Promise<number> {
  let created = 0;

  for (const persona of PERSONAE) {
    const personaUsers = usersByPersona.get(persona.key) ?? [];
    if (personaUsers.length === 0) continue;

    for (const userId of personaUsers) {
      for (const slot of persona.preferredSlots) {
        const parkId = parkIds[slot.parkIndex];
        if (!parkId) continue;

        for (let week = 0; week < SESSIONS_PER_USER_SLOT; week++) {
          // Plasam in zilele potrivite din ultimele 4-8 saptamani.
          const weeksAgo = week * 2 + Math.floor(randomInRange(0, 2));
          const targetDate = computeSlotDate(slot.dayOfWeek, slot.hour, weeksAgo);
          if (targetDate.getTime() > NOW) continue;
          if (targetDate.getTime() < NOW - 60 * MS_PER_DAY) continue;

          // Co-participanti: 2-4 useri RANDOM cu aceeasi persona (dar diferiti
          // de host). Asta creeaza overlap-ul de "aglomerare pe slot".
          const lobby = pickN(personaUsers.filter((u) => u !== userId), Math.floor(randomInRange(2, 5)));

          // Dedup: cautam daca exista deja un sessiune sintetica la fix slot-ul
          // asta cu acelasi host (idempotenta).
          const dedupTime = new Date(targetDate);
          dedupTime.setMinutes(0, 0, 0);
          const existing = await prisma.huntSession.findFirst({
            where: {
              hostId: userId,
              parkId,
              startedAt: {
                gte: new Date(dedupTime.getTime() - 30 * 60_000),
                lte: new Date(dedupTime.getTime() + 30 * 60_000),
              },
            },
          });
          if (existing) continue;

          const session = await prisma.huntSession.create({
            data: {
              hostId: userId,
              parkId,
              status: 'COMPLETED',
              durationSec: 1800,
              startedAt: targetDate,
              endsAt: new Date(targetDate.getTime() + 30 * 60_000),
              endedAt: new Date(targetDate.getTime() + 30 * 60_000),
              monsterCount: 8,
            },
          });

          await prisma.huntLobbyMember.create({
            data: { sessionId: session.id, userId },
          });
          for (const memberId of lobby) {
            await prisma.huntLobbyMember.create({
              data: { sessionId: session.id, userId: memberId },
            });
          }
          created += 1;
        }
      }
    }
  }
  return created;
}

// Calculeaza un Date cu day-of-week + ora fixa, X saptamani inapoi.
function computeSlotDate(dayOfWeek: number, hour: number, weeksAgo: number): Date {
  const target = new Date(NOW);
  target.setHours(hour, Math.floor(randomInRange(0, 50)), 0, 0);
  target.setDate(target.getDate() - weeksAgo * 7);
  // Ajustam pana cade pe dayOfWeek corect.
  while (target.getDay() !== dayOfWeek) {
    target.setDate(target.getDate() - 1);
  }
  return target;
}

async function main() {
  const clean = process.argv.includes('--clean');
  if (clean) {
    const removed = await cleanTestUsers();
    console.log(`[clean] removed ${removed} test users (cascade)`);
    return;
  }

  // 1. Verifica parcuri in DB. Avem nevoie de minim 3 (folosim primele 3-4).
  const parks = await prisma.park.findMany({
    orderBy: { areaSqm: 'desc' },
    take: 4,
    select: { id: true, name: true },
  });
  if (parks.length < 3) {
    console.error(
      `[error] need >=3 parks in DB, found ${parks.length}. ` +
        `Apeleaza /hunt/parks/nearby cu coords valide (ex. Bucuresti) ca sa populezi Park.`,
    );
    process.exit(1);
  }
  console.log(`[parks] using ${parks.length}: ${parks.map((p) => p.name).join(', ')}`);

  // 2. Creeaza userii pt fiecare persona.
  const usersByPersona = new Map<string, string[]>();
  for (const persona of PERSONAE) {
    const ids: string[] = [];
    for (let i = 0; i < USERS_PER_PERSONA; i++) {
      const id = await findOrCreateUser(persona.key, i);
      ids.push(id);
    }
    usersByPersona.set(persona.key, ids);
    console.log(`[users] ${persona.key}: ${ids.length} created/found`);
  }

  // 3. Seed XP per user.
  for (const persona of PERSONAE) {
    const ids = usersByPersona.get(persona.key) ?? [];
    for (const userId of ids) {
      await seedXpForUser(userId, persona);
    }
    console.log(`[xp] seeded for ${ids.length} ${persona.key} users`);
  }

  // 4. Seed hunt sessions.
  const sessionsCreated = await seedHuntSessions(parks.map((p) => p.id), usersByPersona);
  console.log(`[sessions] ${sessionsCreated} hunt sessions created`);

  // 5. Invalideaza cache-ul park-aggregates ca sa picam pe date proaspete la
  // urmatorul GET. Cache-ul e singleton in Redis sub cheia 'social:park-aggregates:v1'.
  try {
    const { redis } = await import('../lib/redis.js');
    await redis.del('social:park-aggregates:v1');
    console.log('[cache] invalidated park-aggregates');
  } catch (err) {
    console.warn('[cache] invalidate failed:', err);
  }

  console.log('[done]');
}

main()
  .catch((err) => {
    console.error('[fatal]', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
