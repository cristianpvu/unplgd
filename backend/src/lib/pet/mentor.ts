// Mentor agent — pet-ul reflecteaza asupra saptamanii copilului. Citeste
// agregate din ultimele 7 zile (skill XP, domain XP, surse de evenimente),
// trimite contextul la Claude cu system prompt strict si returneaza un singur
// mesaj scurt (~60 cuvinte) cu voce de pet.
//
// REGULI:
//   - Observa, NU prescrie. "Am vazut ca..." nu "Ar trebui sa...".
//   - Incadrare pozitiva intotdeauna. Niciun "scor scazut" sau "ai cazut la X".
//   - Refuza sa dea sfaturi cu impact real (medical, familie, scoala) — pet-ul
//     sugereaza copilului sa vorbeasca cu un adult de incredere.
//
// Cache: 1 mesaj pe saptamana ISO per user, stocat in Redis. Apel urmator
// re-foloseste mesajul curent. Cheia se schimba automat luni dimineata.

import { claudeMessages } from '../ai/usage.js';
import { redis } from '../redis.js';
import { logger } from '../logger.js';
import { prisma } from '../prisma.js';
import { ensureDefaultPet } from '../pet.js';
import { ANTHROPIC_MODEL } from '../ai/client.js';
import type Anthropic from '@anthropic-ai/sdk';

const CACHE_TTL_SEC = 7 * 24 * 3600;
const WINDOW_DAYS = 7;
const MS_PER_DAY = 86400000;

export type InsightPayload = {
  message: string;
  generatedAt: string;
  basedOn: {
    daysAnalyzed: number;
    topSkills: Array<{ skill: string; amount: number }>;
    topDomains: Array<{ slug: string; name: string; amount: number }>;
    activityCounts: Record<string, number>;
    eventTotal: number;
  };
};

// Saptamana ISO (Luni-Duminica). Cheie cache stabila intr-o saptamana.
function isoWeekKey(d = new Date()): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((dt.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function cacheKey(userId: string): string {
  return `insight:${userId}:${isoWeekKey()}`;
}

function aggregateSkills(events: Array<{ skill: string; amount: number }>) {
  const by = new Map<string, number>();
  for (const e of events) by.set(e.skill, (by.get(e.skill) ?? 0) + e.amount);
  return [...by.entries()]
    .map(([skill, amount]) => ({ skill, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);
}

function aggregateDomains(
  events: Array<{ domainSlug: string; amount: number }>,
  nameBySlug: Map<string, string>,
) {
  const by = new Map<string, number>();
  for (const e of events) by.set(e.domainSlug, (by.get(e.domainSlug) ?? 0) + e.amount);
  return [...by.entries()]
    .map(([slug, amount]) => ({ slug, name: nameBySlug.get(slug) ?? slug, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);
}

function aggregateActivity(
  events: Array<{ sourceType: string }>,
): Record<string, number> {
  const by: Record<string, number> = {};
  for (const e of events) by[e.sourceType] = (by[e.sourceType] ?? 0) + 1;
  return by;
}

async function gatherContext(userId: string): Promise<{
  basedOn: InsightPayload['basedOn'];
  petName: string;
  speciesName: string;
  speciesTone: string;
  childName: string;
}> {
  const since = new Date(Date.now() - WINDOW_DAYS * MS_PER_DAY);

  const [skillEvents, domainEvents, allDomains, user, pet] = await Promise.all([
    prisma.skillXpTransaction.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { skill: true, amount: true, sourceType: true },
    }),
    prisma.domainXpTransaction.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { domainSlug: true, amount: true },
    }),
    prisma.domain.findMany({
      where: { active: true },
      select: { slug: true, name: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true },
    }),
    ensureDefaultPet(userId).then(() =>
      prisma.pet.findUniqueOrThrow({
        where: { userId },
        include: { species: { select: { name: true, tone: true } } },
      }),
    ),
  ]);

  const nameBySlug = new Map<string, string>();
  for (const d of allDomains) nameBySlug.set(d.slug, d.name);

  const topSkills = aggregateSkills(skillEvents);
  const topDomains = aggregateDomains(domainEvents, nameBySlug);
  const activityCounts = aggregateActivity(skillEvents);
  const eventTotal = skillEvents.length;

  return {
    basedOn: {
      daysAnalyzed: WINDOW_DAYS,
      topSkills,
      topDomains,
      activityCounts,
      eventTotal,
    },
    petName: pet.name,
    speciesName: pet.species.name,
    speciesTone: pet.species.tone,
    childName: user.name,
  };
}

const SYSTEM_PROMPT = `Esti un pet AI virtual care reflecteaza asupra ultimelor 7 zile ale unui copil 6-14 ani.

REGULI STRICTE:
- Observa, NU prescrie. Foloseste "Am vazut...", "Mi-am dat seama...". Niciodata "Ar trebui...", "Trebuie...".
- Mentioneaza maxim 2 lucruri concrete (skill care a crescut SAU un topic cu care s-a jucat).
- Incadrare POZITIVA intotdeauna. Niciodata "ai scazut" sau "n-ai facut destul".
- Stil: cald, prietenos, exact ca un pet care isi observa copilul. Fara emoji.
- Maxim 60 de cuvinte.
- Limba: romana fara diacritice.
- Daca activitatea e ZERO sau aproape zero, scrie un mesaj scurt de incurajare ("hei, ne-am vazut prea putin saptamana asta, sunt aici cand vrei").
- NU oferi sfaturi cu impact real (medical, scoala, familie). Daca pare ceva important, sugereaza "vorbeste cu un adult de incredere".

Formatul output-ului: doar mesajul, fara prefixe, fara markdown, fara JSON.`;

function buildUserPrompt(ctx: {
  basedOn: InsightPayload['basedOn'];
  petName: string;
  speciesName: string;
  speciesTone: string;
  childName: string;
}): string {
  const { basedOn, petName, speciesName, speciesTone, childName } = ctx;
  const skillsLine = basedOn.topSkills.length
    ? basedOn.topSkills.map((s) => `${s.skill} (+${s.amount})`).join(', ')
    : '(nimic notabil)';
  const domainsLine = basedOn.topDomains.length
    ? basedOn.topDomains.map((d) => `${d.name} (+${d.amount})`).join(', ')
    : '(niciun topic clar)';
  const activityLine = Object.keys(basedOn.activityCounts).length
    ? Object.entries(basedOn.activityCounts)
        .map(([k, v]) => `${k}:${v}`)
        .join(', ')
    : '(zero activitate)';

  return `Esti ${petName}, un ${speciesName} cu ton ${speciesTone}. Copilul tau se numeste ${childName}.

Datele ultimelor ${basedOn.daysAnalyzed} zile:
- Skills care au crescut cel mai mult: ${skillsLine}
- Topicuri active: ${domainsLine}
- Activitati: ${activityLine}
- Numar total de evenimente: ${basedOn.eventTotal}

Scrie reflectia ta scurta despre saptamana lui ${childName}. Maxim 60 cuvinte. Doar mesajul.`;
}

/**
 * Genereaza sau returneaza din cache reflectia saptamanii. Cache cheie ISO week.
 *
 * `forceFresh=true` ignora cache (folosit din admin sau pt debug).
 */
export async function getOrGenerateInsight(
  userId: string,
  opts: { forceFresh?: boolean } = {},
): Promise<InsightPayload> {
  const key = cacheKey(userId);

  if (!opts.forceFresh) {
    try {
      const cached = await redis.get(key);
      if (cached) return JSON.parse(cached) as InsightPayload;
    } catch (err) {
      logger.warn({ err, userId }, 'insight.cache_read_failed');
    }
  }

  const ctx = await gatherContext(userId);

  const completion = await claudeMessages(
    {
      model: ANTHROPIC_MODEL,
      max_tokens: 200,
      temperature: 0.6,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(ctx) }],
    },
    'mentor_insight',
  );

  const message = completion.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  const payload: InsightPayload = {
    message,
    generatedAt: new Date().toISOString(),
    basedOn: ctx.basedOn,
  };

  try {
    await redis.set(key, JSON.stringify(payload), 'EX', CACHE_TTL_SEC);
  } catch (err) {
    logger.warn({ err, userId }, 'insight.cache_write_failed');
  }

  return payload;
}
