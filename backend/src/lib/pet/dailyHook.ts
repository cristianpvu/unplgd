// Daily hook — un mesaj scurt personalizat afisat pe home (in bubble-ul
// pet-ului) si folosit ca intro la chat. Idea: in loc de catchphrase random,
// pet-ul aduce un teaser bazat pe ce a facut copilul in ultimele 48h.
//
// Acelasi hook se foloseste si in PetSpeechBubble pe home, si ca intro la
// chat — asa cand user-ul tap-uieste pe pet, conversatia continua natural
// din unde a tease-uit bubble-ul.
//
// Cache: 1 hook/zi/(user) — cheia se schimba la miezul noptii Europe/Bucharest.
// Pe day boundary nou, urmatorul GET regenereaza.

import { claudeMessages } from '../ai/usage.js';
import { redis } from '../redis.js';
import { logger } from '../logger.js';
import { prisma } from '../prisma.js';
import { ensureDefaultPet } from '../pet.js';
import { env } from '../../env.js';
import type Anthropic from '@anthropic-ai/sdk';

const CACHE_TTL_SEC = 26 * 3600; // 26h ca sa acopere day boundary
const WINDOW_HOURS = 48;
const MS_PER_HOUR = 3600000;

export type DailyHookPayload = {
  text: string;
  generatedAt: string;
  basedOn: {
    topSkill: { skill: string; amount: number } | null;
    topDomain: { slug: string; name: string; amount: number } | null;
    eventCount: number;
    daysSinceLastActivity: number | null;
  };
};

// Ziua locala Bucuresti, format YYYY-MM-DD — stabila pana la miezul noptii.
function bucharestDayKey(d = new Date()): string {
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(d);
}

function cacheKey(userId: string): string {
  return `pet:hook:${userId}:${bucharestDayKey()}`;
}

async function gatherContext(userId: string): Promise<{
  basedOn: DailyHookPayload['basedOn'];
  petName: string;
  speciesName: string;
  speciesTone: string;
  childName: string;
}> {
  const since = new Date(Date.now() - WINDOW_HOURS * MS_PER_HOUR);

  const [skillEvents, domainEvents, allDomains, lastEvent, user, pet] = await Promise.all([
    prisma.skillXpTransaction.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { skill: true, amount: true },
    }),
    prisma.domainXpTransaction.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { domainSlug: true, amount: true },
    }),
    prisma.domain.findMany({
      where: { active: true },
      select: { slug: true, name: true },
    }),
    prisma.skillXpTransaction.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
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

  // Agregare top 1 per axa.
  const skillBy = new Map<string, number>();
  for (const e of skillEvents) skillBy.set(e.skill, (skillBy.get(e.skill) ?? 0) + e.amount);
  const topSkillEntry = [...skillBy.entries()].sort((a, b) => b[1] - a[1])[0];
  const topSkill = topSkillEntry
    ? { skill: topSkillEntry[0], amount: topSkillEntry[1] }
    : null;

  const nameBySlug = new Map<string, string>();
  for (const d of allDomains) nameBySlug.set(d.slug, d.name);
  const domainBy = new Map<string, number>();
  for (const e of domainEvents) {
    domainBy.set(e.domainSlug, (domainBy.get(e.domainSlug) ?? 0) + e.amount);
  }
  const topDomainEntry = [...domainBy.entries()].sort((a, b) => b[1] - a[1])[0];
  const topDomain = topDomainEntry
    ? {
        slug: topDomainEntry[0],
        name: nameBySlug.get(topDomainEntry[0]) ?? topDomainEntry[0],
        amount: topDomainEntry[1],
      }
    : null;

  const daysSinceLastActivity = lastEvent
    ? Math.floor((Date.now() - lastEvent.createdAt.getTime()) / (24 * MS_PER_HOUR))
    : null;

  return {
    basedOn: {
      topSkill,
      topDomain,
      eventCount: skillEvents.length,
      daysSinceLastActivity,
    },
    petName: pet.name,
    speciesName: pet.species.name,
    speciesTone: pet.species.tone,
    childName: user.name,
  };
}

const SYSTEM_PROMPT = `Esti un pet AI care saluta copilul (6-14 ani) cand deschide aplicatia. Mesajul tau apare intr-un bubble mic deasupra ta pe home screen si serveste ca teaser pentru o conversatie ulterioara.

REGULI STRICTE:
- O singura propozitie, MAXIM 18 cuvinte. Bubble-ul e mic.
- Romana FARA DIACRITICE.
- Fara emoji. Fara markdown. Fara JSON. DOAR textul mesajului.
- Voce de pet: curios, prietenos, jucaus. NU institutional, NU coach.
- Daca exista o activitate concreta recenta (skill in crestere SAU domeniu cu care s-a jucat), fa-o curioasa: "Te-ai luptat bine cu dinozaurii ieri — mai vrem azi?" sau "Iar visez la spatiu... vrei sa-ti zic ce am visat?"
- Daca nu e nicio activitate recenta (zero evenimente sau cativa zile pauza), fa-o calduros: "Hei, mi-a fost dor de tine — vrem o aventura?" sau "Sper sa fii ok — vreau sa-ti povestesc ceva."
- NU mentiona cifre, scoruri, nivele, XP. Vorbesti ca un prieten, nu ca un dashboard.
- NU oferi sfaturi educationale ("hai sa invatam"). Sune ca o invitatie la joaca / conversatie.
- Mesajul trebuie sa invite tap pe pet pentru a deschide chat-ul.`;

function buildUserPrompt(ctx: {
  basedOn: DailyHookPayload['basedOn'];
  petName: string;
  speciesName: string;
  speciesTone: string;
  childName: string;
}): string {
  const { basedOn, petName, speciesName, speciesTone, childName } = ctx;
  const skillLine = basedOn.topSkill
    ? `${basedOn.topSkill.skill} (+${basedOn.topSkill.amount})`
    : '(nimic)';
  const domainLine = basedOn.topDomain
    ? `${basedOn.topDomain.name}`
    : '(nimic)';
  const lastActivity = basedOn.daysSinceLastActivity == null
    ? 'niciodata'
    : basedOn.daysSinceLastActivity === 0
      ? 'azi'
      : basedOn.daysSinceLastActivity === 1
        ? 'ieri'
        : `acum ${basedOn.daysSinceLastActivity} zile`;

  return `Esti ${petName}, un ${speciesName} cu ton ${speciesTone}. Copilul tau este ${childName}.

Ce a facut ${childName} in ultimele 48h:
- Skill cu cea mai mare crestere: ${skillLine}
- Domeniu/topic cu care s-a jucat cel mai mult: ${domainLine}
- Evenimente totale: ${basedOn.eventCount}
- Ultima activitate: ${lastActivity}

Scrie mesajul tau de salut pentru ${childName} azi. O singura propozitie, sub 18 cuvinte, doar textul.`;
}

/**
 * Genereaza sau returneaza hook-ul zilei pt user. Cache pe zi locala
 * Bucuresti. `forceFresh` sare cache (debug/admin).
 */
export async function getOrGenerateDailyHook(
  userId: string,
  opts: { forceFresh?: boolean } = {},
): Promise<DailyHookPayload> {
  const key = cacheKey(userId);

  if (!opts.forceFresh) {
    try {
      const cached = await redis.get(key);
      if (cached) return JSON.parse(cached) as DailyHookPayload;
    } catch (err) {
      logger.warn({ err, userId }, 'pet_hook.cache_read_failed');
    }
  }

  const ctx = await gatherContext(userId);

  const completion = await claudeMessages(
    {
      model: env.ANTHROPIC_HINT_MODEL,
      max_tokens: 80,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(ctx) }],
    },
    'pet_daily_hook',
  );

  const text = completion.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join(' ')
    .trim()
    .replace(/^["']|["']$/g, ''); // unele modele inveleau in ghilimele

  const payload: DailyHookPayload = {
    text,
    generatedAt: new Date().toISOString(),
    basedOn: ctx.basedOn,
  };

  try {
    await redis.set(key, JSON.stringify(payload), 'EX', CACHE_TTL_SEC);
  } catch (err) {
    logger.warn({ err, userId }, 'pet_hook.cache_write_failed');
  }

  return payload;
}
