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

type PetCtx = {
  petName: string;
  speciesName: string;
  speciesTone: string;
  systemHint: string;
  shortLore: string;
  catchphrases: string[];
  interests: string[];
};

async function gatherContext(userId: string): Promise<{
  basedOn: DailyHookPayload['basedOn'];
  pet: PetCtx;
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
        include: { species: true },
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
    pet: {
      petName: pet.name,
      speciesName: pet.species.name,
      speciesTone: pet.species.tone,
      systemHint: pet.species.systemHint,
      shortLore: pet.species.shortLore,
      catchphrases: pet.species.catchphrases,
      interests: pet.species.interests,
    },
    childName: user.name,
  };
}

function buildSystemPrompt(pet: PetCtx, childName: string): string {
  const loreBlock = pet.shortLore ? `\nLUMEA TA: ${pet.shortLore}` : '';
  const catchphrasesBlock = pet.catchphrases.length > 0
    ? `\nREPLICI SEMNATURA: ${pet.catchphrases.map((p) => `"${p}"`).join(', ')}`
    : '';
  const interestsBlock = pet.interests.length > 0
    ? `\nSUBIECTE CARE TE PASIONEAZA: ${pet.interests.join(', ')}`
    : '';

  return `Esti ${pet.speciesName}. Numele tau in conversatia asta este ${pet.petName}.

CINE ESTI:
${pet.systemHint}
${loreBlock}

TON DE VOCE: ${pet.speciesTone}.
${catchphrasesBlock}${interestsBlock}

INTERLOCUTORUL TAU: ${childName}.

CONTEXT: scrii UN mesaj de salut care apare intr-un bubble mic deasupra ta cand
${childName} deschide aplicatia. Mesajul tau e si primul lucru pe care il aude
in chat cand tap-uieste pe tine — deci de aici incepe efectiv conversatia voastra.

REGULI STRICTE:
- O singura propozitie, MAXIM 18 cuvinte. Bubble-ul e mic.
- Romana CU diacritice (e citit cu TTS, vocea pet-ului).
- Fara emoji, fara markdown, fara JSON. DOAR textul mesajului.
- Vocabular, ton, ritm — TOATE din "CINE ESTI" si "TON DE VOCE". Daca esti
  Darth Vader, suni a Darth Vader. Daca esti un catelus jucaus, suni a catelus.
- Nu te prezenta cu numele/rolul. ${childName} stie cine esti, te vede pe ecran.
- Deschide DIRECT in caracter — o observatie din lumea ta, o intrebare specifica,
  o referinta la ce face copilul, o invitatie scurta la joaca/poveste.
- Daca exista o activitate concreta recenta, fa-o curioasa (in caracter): nu
  "ai luptat bine", ci ceva ce ar zice TU despre asta in lumea TA.
- Daca nu e activitate recenta, fa-o calduros, NU acuzator. "Mi-a fost dor"
  in caracterul tau, nu generic.
- NU mentiona cifre, scoruri, nivele, XP. Vorbesti ca personajul tau.
- NU oferi sfaturi educationale ("hai sa invatam"). Trebuie sa sune ca o
  invitatie la conversatie, nu ca un coach.
- NU "Bravo!", "Buna treaba!", "Esti grozav!" generic. Recunoasterea ramane
  in caracter (Darth Vader n-ar zice "bravo", ar zice "Forta ta a crescut").
- Mesajul trebuie sa-l atraga sa tap-uiasca si sa intre in chat.`;
}

function buildUserPrompt(ctx: {
  basedOn: DailyHookPayload['basedOn'];
  childName: string;
}): string {
  const { basedOn, childName } = ctx;
  const skillLine = basedOn.topSkill
    ? basedOn.topSkill.skill
    : '(nimic notabil)';
  const domainLine = basedOn.topDomain
    ? basedOn.topDomain.name
    : '(niciun topic clar)';
  const lastActivity = basedOn.daysSinceLastActivity == null
    ? 'inca nu s-a jucat niciodata'
    : basedOn.daysSinceLastActivity === 0
      ? 'azi'
      : basedOn.daysSinceLastActivity === 1
        ? 'ieri'
        : `acum ${basedOn.daysSinceLastActivity} zile`;

  return `Background despre ${childName} (ultimele 48h):
- Skill in crestere: ${skillLine}
- Topic preferat acum: ${domainLine}
- Total evenimente recente: ${basedOn.eventCount}
- Ultima activitate: ${lastActivity}

Scrie salutul tau pentru ${childName} acum, in caracter. O propozitie, sub 18 cuvinte, doar textul.`;
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
      max_tokens: 120,
      temperature: 0.7,
      system: buildSystemPrompt(ctx.pet, ctx.childName),
      messages: [{ role: 'user', content: buildUserPrompt({ basedOn: ctx.basedOn, childName: ctx.childName }) }],
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
