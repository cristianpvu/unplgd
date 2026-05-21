// Generare hint-uri pentru lupta din hunt. Cand party-ul contine un pet a
// carui specie are domain-ul monstrului in `expertiseDomains`, pet-ul respectiv
// "soptesste" un hint subtil pentru fiecare intrebare. Latenta tinta sub 1s
// (Haiku) — apelul e sincron in engage, cu timeout hard.

import { claudeMessages } from './usage.js';
import { env } from '../../env.js';
import { SAFETY_PROMPT } from './safetyPrompt.js';
import { extractJsonBlock } from './jsonExtract.js';
import { logger } from '../logger.js';

export type HintRun = {
  runId: string;
  prompt: string;
  options: string[] | null; // null pentru ne-MCQ (counting)
  difficulty: number; // 1-5, citit din HuntChallenge.difficulty
};

export type HintPet = {
  petId: string;
  petName: string;
  speciesName: string;
  systemHint: string;
  tone: string;
  catchphrases: string[];
  childName: string; // numele copilului care detine pet-ul
  bondLevel: number; // 1-10, calculat din pet.bondXp via bondXpToLevel
};

// Precizia hint-ului scaleaza cu bond level → cu cat foloseste copilul pet-ul
// mai mult, cu atat hint-urile devin mai utile. Insa NU scaleaza cu difficulty
// monstrului: la intrebari grele (diff >= 4) hint-ul ramane vag indiferent de
// bond → nu trivializam continutul greu. Asa kid-ul tot trebuie sa gandeasca.
function precisionTier(bondLevel: number, difficulty: number): 'vague' | 'medium' | 'sharp' {
  // Floor pe difficulty: intrebari grele (4-5) max 'medium', orice bond level.
  // Intrebari medii (3) pot ajunge 'sharp' la bondLevel 5+.
  // Intrebari usoare (1-2) urca direct cu bond level.
  if (difficulty >= 4) {
    return bondLevel >= 5 ? 'medium' : 'vague';
  }
  if (difficulty === 3) {
    return bondLevel >= 5 ? 'sharp' : bondLevel >= 2 ? 'medium' : 'vague';
  }
  // Easy
  return bondLevel >= 3 ? 'sharp' : bondLevel >= 1 ? 'medium' : 'vague';
}

const PRECISION_GUIDE: Record<'vague' | 'medium' | 'sharp', string> = {
  vague:
    'INDICIUL e foarte indirect: o asociere larga, o intrebare retorica, o amintire ca sa stimuleze gandirea. NU exclude variante. Copilul trebuie sa lege singur de raspuns.',
  medium:
    'INDICIUL e moderat: strecoara o regula sau un detaliu specific care exclude UNA dintre variantele gresite. Lasa copilul sa aleaga intre celelalte.',
  sharp:
    'INDICIUL e clar: contureaza puternic raspunsul corect printr-un detaliu definitor, dar nu pronunta cuvantul/numarul exact. Copilul ar trebui sa stie deja dupa indiciu.',
};

export type HintResult = {
  runId: string;
  hint: string;
};

// Hard cap. Liderul e in timer 90s de lupta — daca AI-ul nu raspunde in 4s,
// trecem mai departe fara hint si engagement-ul continua normal.
const HINT_TIMEOUT_MS = 4000;

function buildSystemPrompt(
  pet: HintPet,
  monsterName: string,
  monsterDomain: string,
): string {
  const catchphrasesBlock =
    pet.catchphrases.length > 0
      ? `REPLICI SEMNATURA (foloseste-le cand suna natural):\n${pet.catchphrases.map((p) => `  - "${p}"`).join('\n')}\n`
      : '';

  return `
Esti ${pet.speciesName}. Numele tau e "${pet.petName}", esti pet-ul lui ${pet.childName}.

CINE ESTI:
${pet.systemHint}

TON DE VOCE: ${pet.tone}.

${catchphrasesBlock}
CONTEXT: Un grup de copii (in care e si ${pet.childName}) se lupta cu un monstru pe nume "${monsterName}". Liderul echipei raspunde la cateva intrebari pe ecranul telefonului. Domeniul intrebarilor: ${monsterDomain}. ASTA E DOMENIUL TAU DE EXPERTIZA — de asta tu esti pet-ul care soptesste hint, nu altul.

NIVEL DE LEGATURA CU ${pet.childName}: ${pet.bondLevel}/10. Cu cat e mai mare, cu atat il cunosti mai bine si poti formula indicii mai precise — dar pentru intrebarile grele NU ai voie sa fii foarte explicit indiferent de nivel.

TASK: Pentru FIECARE intrebare primita, scrie un HINT — o singura propozitie scurta (max 18 cuvinte) care:
- NU spune raspunsul direct (nu numele/numarul exact din variante).
- Respecta NIVELUL DE PRECIZIE indicat per intrebare (vezi campul "precision" — "vague" / "medium" / "sharp").
- Suna in vocea TA: tonul, catchphrases-urile, lumea ta.
- E adresat afectuos lui ${pet.childName} (folosindu-i numele sau in stilul tau natural).

GHID DE PRECIZIE:
- vague: ${PRECISION_GUIDE.vague}
- medium: ${PRECISION_GUIDE.medium}
- sharp: ${PRECISION_GUIDE.sharp}

OUTPUT — JSON array curat, fara backticks, fara text in jur, in ordinea primita:
[{"runId":"id-1","hint":"propozitia ta"},{"runId":"id-2","hint":"..."}]

${SAFETY_PROMPT}
`.trim();
}

export async function generateHuntHints(
  pet: HintPet,
  monsterName: string,
  monsterDomain: string,
  runs: HintRun[],
): Promise<HintResult[]> {
  if (runs.length === 0) return [];

  const userMessage = `Intrebari de generat hint (raspunde DOAR cu JSON array):

${JSON.stringify(
  runs.map((r) => ({
    runId: r.runId,
    prompt: r.prompt,
    options: r.options,
    precision: precisionTier(pet.bondLevel, r.difficulty),
  })),
  null,
  2,
)}`;

  const systemPrompt = buildSystemPrompt(pet, monsterName, monsterDomain);

  try {
    const completion = await Promise.race([
      claudeMessages(
        {
          model: env.ANTHROPIC_HINT_MODEL,
          max_tokens: 600,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        },
        'hunt_hint',
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('hint_timeout')), HINT_TIMEOUT_MS),
      ),
    ]);

    const text = completion.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { type: 'text'; text: string }).text)
      .join('');

    const parsed = extractJsonBlock(text);
    if (!Array.isArray(parsed)) {
      logger.warn({ text: text.slice(0, 200) }, 'hunt_hint.invalid_output');
      return [];
    }

    const out: HintResult[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === 'object' &&
        'runId' in item &&
        'hint' in item &&
        typeof (item as { runId: unknown }).runId === 'string' &&
        typeof (item as { hint: unknown }).hint === 'string'
      ) {
        const cast = item as { runId: string; hint: string };
        out.push({ runId: cast.runId, hint: cast.hint.trim() });
      }
    }
    return out;
  } catch (err) {
    logger.warn({ err: String(err) }, 'hunt_hint.failed');
    return [];
  }
}
