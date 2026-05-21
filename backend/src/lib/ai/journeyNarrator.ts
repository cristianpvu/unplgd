// Generator de "beat-uri" narrative scurte pentru joculetul Journey.
//
// Un beat = 1-2 propozitii spuse de narator (NU de pet) despre ce vede pet-ul
// pe drum, in biome-ul curent, cu o adiere de informatie de domeniul pet-ului.
// Naratorul vorbeste despre pet la persoana a 3-a ("si pasi pe nisip mosul de
// Stitch...") — copilul e ascultator, nu participant aici.
//
// Output: 3-5 beats deodata, intr-un singur apel Claude → mobile le canta in
// secventa pe masura ce pet-ul merge.
//
// Cache: aceleasi (pet, biome, sectionIndex) → acelasi rezultat (idempotent).
// Stocam in Redis cu TTL lung; se regenereaza doar daca admin-ul invalideaza.

import { claudeMessages } from './usage.js';
import { env } from '../../env.js';
import { SAFETY_PROMPT } from './safetyPrompt.js';
import { extractJsonBlock } from './jsonExtract.js';
import { logger } from '../logger.js';

export type NarratorPet = {
  petName: string;
  speciesName: string;
  childName: string;
  // Domeniile lui de cunostinte (ex. "spatiu cosmic", "padure", "ocean").
  // Naratorul presara natural informatii de aici, fara sa "intrebe" pe copil.
  expertiseDomains: string[];
  // Personalitate scurta — narratoru' refera la felul pet-ului ("isi misca
  // urechile", "scoate limba mare" — vine din shortLore).
  shortLore: string;
};

export type NarratorBiome = {
  // Nume biome de afisat in poveste (ex. "Plaja insorita", "Galaxia intunecata").
  name: string;
  // Lume + dominanta — un cuvant ("plaja", "spatiu", "padure", "mlastina").
  worldHint: string;
};

export type NarratorBeat = {
  // Textul rostit — 1-2 propozitii, max ~25 cuvinte. Romana, calde, simple.
  text: string;
};

export type NarratorArc = {
  beats: NarratorBeat[];
};

const NARRATION_TIMEOUT_MS = 20000;

function buildPrompt(pet: NarratorPet, biome: NarratorBiome, beatsCount: number): string {
  const domains = pet.expertiseDomains.length > 0
    ? pet.expertiseDomains.join(', ')
    : 'lumea inconjuratoare';

  return `
Esti naratorul unei povesti dulci pentru ${pet.childName}, un copil de 6-14 ani.
Pe ecran, ${pet.childName} se uita la pet-ul lui — ${pet.speciesName} pe nume "${pet.petName}" — care merge printr-un peisaj animat.

CINE E PET-UL:
${pet.shortLore}

LUMEA ACUM:
${biome.name}. Ambient: ${biome.worldHint}.

TASK: Scrie ${beatsCount} beat-uri narrative scurte, in ROMANA, despre cum merge ${pet.petName} prin lumea asta. Naratorul povesteste la persoana a 3-a despre pet ("si Buddy isi sune nasul...", "Vader priveste in zare...") — NU vorbeste in numele pet-ului.

REGULI:
- Fiecare beat: 1-2 propozitii, max 25 de cuvinte total.
- Voce CALDA si LINISTITA, ca un parinte care citeste inainte de culcare.
- Ritmic — folositi pauze (virgule, multe puncte) ca asculta-toru sa respire intre fraze.
- Strecoara natural o curiozitate sau un mic detaliu real despre ${domains} (max 1 pe beat, fara sa para o lectie).
- NU adresa intrebari catre copil. NU "stii ce e asta?". E poveste curga, nu test.
- NU folosi cuvinte ca "test", "intrebare", "raspuns".
- Beat-urile trebuie sa curga unul dupa altul — povestea progreseaza.
- NICIODATA copia un loc/eveniment specific (oras, scoala, brand) — totul ramane in lumea ${biome.name}.

OUTPUT — DOAR JSON curat, fara backticks, fara text in jur:
{
  "beats": [
    {"text": "..."},
    {"text": "..."}
  ]
}

${SAFETY_PROMPT}
`.trim();
}

function isValidArc(v: unknown, expected: number): v is NarratorArc {
  if (!v || typeof v !== 'object') return false;
  const a = v as Partial<NarratorArc>;
  if (!Array.isArray(a.beats) || a.beats.length === 0) return false;
  if (a.beats.length > expected + 2) return false; // tolerant la +1-2
  for (const b of a.beats) {
    if (!b || typeof b.text !== 'string' || b.text.length < 5 || b.text.length > 400) {
      return false;
    }
  }
  return true;
}

// Genereaza un arc narrative. Throw daca AI esueaza — caller-ul decide raspunsul.
export async function generateNarratorArc(
  pet: NarratorPet,
  biome: NarratorBiome,
  beatsCount = 4,
): Promise<NarratorArc> {
  const systemPrompt = buildPrompt(pet, biome, beatsCount);
  const userMessage = `Spune-mi povestea lui ${pet.petName} prin ${biome.name}. Raspunde DOAR cu JSON-ul.`;

  const completion = await Promise.race([
    claudeMessages(
      {
        model: env.ANTHROPIC_HINT_MODEL,
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      },
      'journey_narrator',
    ),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('narrator_timeout')), NARRATION_TIMEOUT_MS),
    ),
  ]);

  const text = completion.content
    .filter((c) => c.type === 'text')
    .map((c) => (c as { type: 'text'; text: string }).text)
    .join('');

  const parsed = extractJsonBlock(text);
  if (!isValidArc(parsed, beatsCount)) {
    logger.warn({ text: text.slice(0, 300) }, 'journey_narrator.invalid_output');
    throw new Error('narrator_invalid_output');
  }
  return parsed;
}
