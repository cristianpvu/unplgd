import type Anthropic from '@anthropic-ai/sdk';
import { anthropic, ANTHROPIC_MODEL } from '../ai/client.js';
import { extractJsonBlock } from '../ai/jsonExtract.js';
import { logger } from '../logger.js';

// Judecator AI pentru raspunsuri la ghicitori. Compara raspunsul copilului cu
// `expected` semantic (synonime, formulari diferite, greseli ortografice mici).
// Returneaza si un feedback scurt copil-prieten ("aproape!", "Bravo!").
//
// Costs: ~$0.001 per call cu Claude Haiku — pentru o sesiune cu 8 monstri x
// 4 challenge-uri = 32 calls = ~$0.03. Acceptabil.
//
// Fallback: daca Claude pica, comparam normalizat (lowercase + diacritice
// inlocuite) — dur dar nu blocheaza jocul.

export type JudgeResult = {
  correct: boolean;
  feedback: string;
};

const SYSTEM = `Esti un judecator amabil pentru ghicitori adresate copiilor de 6-14 ani.
Compari raspunsul copilului cu raspunsul asteptat. Esti GENEROS — accepti:
  - synonime apropiate (catelus = caine, masina = automobil)
  - greseli ortografice mici (pisicuta vs pisicutza, ploaia vs ploia)
  - formulari diferite cu acelasi sens semantic
  - diminutive si forme afective

RESPINGI:
  - raspunsuri complet diferite tematic
  - "nu stiu", "ceva", raspunsuri evazive
  - tema gresita complet

Raspunzi DOAR cu un bloc JSON:

\`\`\`json
{
  "correct": true,
  "feedback": "Bravo! Asa este!"
}
\`\`\`

Feedback-ul e scurt (max 12 cuvinte), prietenos, romana fara diacritice.
Fara text inainte sau dupa block-ul JSON.`;

function normalizeRomanian(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ăâ]/g, 'a')
    .replace(/[î]/g, 'i')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fallbackJudge(answer: string, expected: string): JudgeResult {
  const a = normalizeRomanian(answer);
  const e = normalizeRomanian(expected);
  if (!a || !e) return { correct: false, feedback: 'Nu am inteles raspunsul' };
  if (a === e) return { correct: true, feedback: 'Bravo! Asa este!' };
  // Includere partiala in ambele sensuri (kid: "iepurele" vs expected: "iepure")
  if (a.includes(e) || e.includes(a)) {
    return { correct: true, feedback: 'Bravo! Asa este!' };
  }
  return { correct: false, feedback: 'Aproape, dar nu chiar' };
}

export async function judgeRiddleAnswer(
  prompt: string,
  expected: string,
  answer: string,
): Promise<JudgeResult> {
  const userMessage = `Ghicitoare: "${prompt}"
Raspuns asteptat: "${expected}"
Raspunsul copilului: "${answer}"`;

  try {
    const completion = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 200,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    });

    const replyText = completion.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
    const json = extractJsonBlock(replyText);
    if (
      json &&
      typeof json === 'object' &&
      'correct' in json &&
      typeof (json as Record<string, unknown>).correct === 'boolean'
    ) {
      const o = json as Record<string, unknown>;
      return {
        correct: o.correct as boolean,
        feedback: typeof o.feedback === 'string' ? o.feedback : 'Bine!',
      };
    }
    logger.warn({ replyText }, 'judge.malformed_response_using_fallback');
    return fallbackJudge(answer, expected);
  } catch (err) {
    logger.warn({ err }, 'judge.ai_failed_using_fallback');
    return fallbackJudge(answer, expected);
  }
}

// Counting challenge: comparare directa numerica. expected e numarul ca string.
export function judgeCountingAnswer(expected: string, answer: string): JudgeResult {
  const e = parseInt(expected, 10);
  const a = parseInt(answer, 10);
  if (Number.isNaN(e) || Number.isNaN(a)) {
    return { correct: false, feedback: 'Trebuie sa atingi de N ori, nu sa scrii' };
  }
  if (a === e) return { correct: true, feedback: 'Exact! Bravo!' };
  return { correct: false, feedback: `Erau ${e}, tu ai zis ${a}` };
}

// MCQ: client trimite textul variantei alese. Validare deterministica prin
// comparare normalizata (lowercase + diacritice eliminate) cu `expected`. Daca
// raspunsul nu e printre `options`, refuzam ca raspuns invalid (anti-cheat).
export function judgeMcqAnswer(
  expected: string,
  options: string[],
  answer: string,
): JudgeResult {
  const norm = normalizeRomanian;
  const a = norm(answer);
  const validOptions = options.map(norm);
  if (!validOptions.includes(a)) {
    return { correct: false, feedback: 'Raspuns invalid' };
  }
  if (a === norm(expected)) return { correct: true, feedback: 'Bravo! Asa este!' };
  return { correct: false, feedback: `Era: ${expected}` };
}
