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
};

export type HintPet = {
  petId: string;
  petName: string;
  speciesName: string;
  systemHint: string;
  tone: string;
  catchphrases: string[];
  childName: string; // numele copilului care detine pet-ul
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

TASK: Pentru FIECARE intrebare primita, scrie un HINT SUBTIL — o singura propozitie scurta (max 18 cuvinte) care:
- NU spune raspunsul direct.
- Strecoara un indiciu (o asociere, o regula, un detaliu care exclude o varianta gresita din MCQ).
- Suna in vocea TA: tonul, catchphrases-urile, lumea ta.
- E adresat afectuos lui ${pet.childName} (folosindu-i numele sau in stilul tau natural).

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
  runs.map((r) => ({ runId: r.runId, prompt: r.prompt, options: r.options })),
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
