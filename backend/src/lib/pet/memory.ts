// Memorie persistenta a pet-ului despre copil — segregata pe specie de pet.
//
// FLOW:
//   1. Dupa fiecare schimb de replici (user msg + pet reply), un fire-and-
//      forget job apeleaza Haiku ca sa extraga 0-3 fapte durabile despre
//      copil din ce-a zis user-ul.
//   2. Faptele sunt salvate in PetMemory cu cheia (userId, speciesSlug).
//   3. La urmatorul chat cu acelasi pet (specie), top N memorii non-archive
//      sunt injectate in system prompt ca bloc "CE-TI AMINTESTI DESPRE COPIL".
//
// IDEMPOTENTA: nu strict — dedup-uim prin lowercase fact match per (user,
// species) inainte de INSERT. Daca Haiku extrage "are o pisica Mira" de 5 ori
// in saptamana, ramane o singura inregistrare.
//
// PRIVACY: prompt-ul de extragere refuza explicit date sensibile (adresa,
// scoala, prenume parinti, contact). Daca extrage ceva sensibil, marcam ca
// `sourceType='filtered'` si nu il injectam mai departe (pastram pentru audit).

import { claudeMessages } from '../ai/usage.js';
import { prisma } from '../prisma.js';
import { logger } from '../logger.js';
import { env } from '../../env.js';
import type Anthropic from '@anthropic-ai/sdk';

// Pragul minim de lungime pe mesajul user-ului ca sa merite extragere — sub
// asta sunt "ok", "da", "nu", emoji-uri, etc. — fara fapte de memorat.
const MIN_USER_MSG_LEN_FOR_EXTRACT = 12;

// Plafon memorii ACTIVE per (user, species). Cand depasim, arhivam cele mai
// vechi. Tine prompt-ul sub control + DB curata.
const MAX_ACTIVE_MEMORIES_PER_PET = 80;

// Cate memorii includem in prompt-ul de chat (top recent + active).
export const MEMORIES_FOR_PROMPT = 12;

const EXTRACT_SYSTEM_PROMPT = `Esti un sistem care extrage fapte durabile despre un copil (6-14 ani) dintr-un schimb de replici cu pet-ul lui virtual.

OUTPUT STRICT JSON: { "facts": ["fact 1", "fact 2", ...] }. Maxim 3 fapte. Daca nu exista nimic memorabil, returneaza { "facts": [] }.

CE EXTRAGI (fapte DURABILE, nu de moment):
- Preferinte: "Ii place fotbalul", "Adora dinozaurii"
- Oameni / animale mentionate cu nume: "Are o pisica numita Mira", "Are un frate mai mic, Andrei"
- Vise / aspiratii: "Vrea sa fie astronaut"
- Frici / obstacole personale: "Ii e frica de paianjeni"
- Hobby-uri concrete: "Canta la pian", "Joaca chess"
- Personaje inventate impreuna: "Au inventat personajul Captain Banana"
- Vacante / experiente recente importante: "A fost la mare cu familia"

CE NU EXTRAGI:
- Replici de moment ("sunt obosit", "ma bucur") — temporare
- Sentimente reactive in conversatia curenta
- Fapte despre pet (numele lui, ce a zis pet-ul) — nu sunt despre copil
- Generalitati banale ("ii place sa se joace")
- Repetitii ale unor fapte deja stiute

NU EXTRAGI (PRIVACY HARD):
- Adresa, oras specific, scoala, gradinita
- Prenume + nume complet parinti, rude
- Numere telefon, conturi, link-uri
- Date medicale specifice (diagnostic, medicamente)
- Date despre alti copii care nu sunt prieteni in app

FORMAT FAPT:
- Romana CU diacritice
- 5-12 cuvinte per fapt
- Persoana 3 ("Are", "Ii place", "Visa sa")
- Concret. NU "are interese diverse". DA "Adora masinile de cursa".
- Fara cifre / scoruri / nivele
- Fara emoji, fara markdown

DOAR JSON. Niciun text inainte sau dupa. Nicio explicatie.`;

function buildExtractUserPrompt(userMsg: string, assistantReply: string, existingFactsSample: string[]): string {
  const existingBlock = existingFactsSample.length > 0
    ? `\nFAPTE DEJA STIUTE (NU REPETA):\n${existingFactsSample.map((f) => `- ${f}`).join('\n')}\n`
    : '';
  return `Schimb recent:
COPIL: ${userMsg}
PET: ${assistantReply}
${existingBlock}
Extrage fapte noi durabile despre copil. Doar JSON.`;
}

/**
 * Extrage si salveaza memorii noi din ultimul turn (user msg + pet reply).
 * Fire-and-forget — apelat din POST /pets/chat dupa ce am raspuns user-ului.
 * Erori sunt log-uite dar NU se propaga.
 */
export async function extractAndSaveMemories(args: {
  userId: string;
  speciesSlug: string;
  userMessage: string;
  assistantReply: string;
  sourceId?: string;
}): Promise<void> {
  const { userId, speciesSlug, userMessage, assistantReply, sourceId } = args;

  if (userMessage.trim().length < MIN_USER_MSG_LEN_FOR_EXTRACT) {
    return; // sub prag — probabil "ok", "da", emoji
  }

  // Sample mic din memoriile existente, ca Haiku sa nu duplice. Trimitem doar
  // text-ul, nu id-uri.
  let existingSample: string[] = [];
  try {
    const recent = await prisma.petMemory.findMany({
      where: { userId, speciesSlug, archived: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { fact: true },
    });
    existingSample = recent.map((m) => m.fact);
  } catch (err) {
    logger.warn({ err, userId, speciesSlug }, 'pet_memory.existing_fetch_failed');
  }

  let facts: string[] = [];
  try {
    const completion = await claudeMessages(
      {
        model: env.ANTHROPIC_HINT_MODEL,
        max_tokens: 300,
        temperature: 0.2,
        system: EXTRACT_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildExtractUserPrompt(userMessage, assistantReply, existingSample),
          },
        ],
      },
      'pet_memory_extract',
    );
    const text = completion.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    // Toleram markdown fence-uri (` ```json `) chiar daca prompt-ul interzice.
    const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    const parsed = JSON.parse(cleaned) as { facts?: unknown };
    if (Array.isArray(parsed.facts)) {
      facts = parsed.facts
        .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
        .map((f) => f.trim())
        .slice(0, 3);
    }
  } catch (err) {
    logger.warn({ err, userId, speciesSlug }, 'pet_memory.extract_failed');
    return;
  }

  if (facts.length === 0) return;

  // Dedup fata de memoriile existente prin lowercase match. Filtrare ieftina.
  const existingLower = new Set(existingSample.map((f) => f.toLowerCase()));
  const newFacts = facts.filter((f) => !existingLower.has(f.toLowerCase()));
  if (newFacts.length === 0) return;

  try {
    await prisma.petMemory.createMany({
      data: newFacts.map((fact) => ({
        userId,
        speciesSlug,
        fact,
        sourceType: 'chat',
        sourceId: sourceId ?? null,
      })),
    });
  } catch (err) {
    logger.warn({ err, userId, speciesSlug, newFacts }, 'pet_memory.create_failed');
    return;
  }

  // Plafonare: daca am depasit MAX_ACTIVE_MEMORIES, archiveaza cele mai vechi.
  try {
    const activeCount = await prisma.petMemory.count({
      where: { userId, speciesSlug, archived: false },
    });
    if (activeCount > MAX_ACTIVE_MEMORIES_PER_PET) {
      const excess = activeCount - MAX_ACTIVE_MEMORIES_PER_PET;
      const oldest = await prisma.petMemory.findMany({
        where: { userId, speciesSlug, archived: false },
        orderBy: { createdAt: 'asc' },
        take: excess,
        select: { id: true },
      });
      await prisma.petMemory.updateMany({
        where: { id: { in: oldest.map((m) => m.id) } },
        data: { archived: true },
      });
    }
  } catch (err) {
    logger.warn({ err, userId, speciesSlug }, 'pet_memory.archive_failed');
  }
}

/**
 * Returneaza top N memorii active pt (userId, speciesSlug), sortate descrescator
 * dupa createdAt. Folosit la construirea system prompt-ului de chat.
 */
export async function getPetMemoriesForPrompt(
  userId: string,
  speciesSlug: string,
  limit: number = MEMORIES_FOR_PROMPT,
): Promise<string[]> {
  try {
    const rows = await prisma.petMemory.findMany({
      where: { userId, speciesSlug, archived: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { fact: true },
    });
    return rows.map((r) => r.fact);
  } catch (err) {
    logger.warn({ err, userId, speciesSlug }, 'pet_memory.fetch_for_prompt_failed');
    return [];
  }
}
