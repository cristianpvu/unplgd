// Generare continut pentru jocul story-adventure. Pet-ul poarta copilul printr-o
// poveste pe o harta cu noduri; la fiecare nod cere AJUTOR (rol rasturnat —
// copilul e eroul, nu elevul). Intrebarea de cunostinte e deghizata ca obstacol
// din lume. La final un boss recapituleaza.
//
// MODULAR: nu stie nimic despre o specie anume. Primeste config-ul lumii +
// personalitatea pet-ului ca date. Adaugi lume noua = INSERT in DB, fara cod.
//
// Un singur apel Claude per run (cache-uit pe AdventureRun.contentJson). JSON
// structurat, ca huntHint.

import { claudeMessages } from './usage.js';
import { env } from '../../env.js';
import { SAFETY_PROMPT } from './safetyPrompt.js';
import { extractJsonBlock } from './jsonExtract.js';
import { logger } from '../logger.js';

export type StoryPet = {
  petName: string;
  speciesName: string;
  systemHint: string;
  tone: string;
  catchphrases: string[];
  childName: string;
  bondLevel: number; // regleaza vocabularul + complexitatea
};

export type StoryWorldConfig = {
  name: string;
  lore: string;
  domain: string;
  bossName: string;
  bossLore: string;
  nodeCount: number;
  obstacleStyle: string; // doar context naratie ("bridge"=pod, "door"=usa...)
};

// Un obstacol/checkpoint dintr-un nod de poveste.
export type StoryObstacle = {
  prompt: string; // pet-ul cere ajutor, in-world
  options: string[]; // 3 variante
  correctIndex: number;
  successLine: string; // reactie pet la corect
  failLine: string; // re-explicare blanda la gresit (fara pedeapsa)
  fact: string; // nuggetul de cunostinte (folosit la recap boss)
};

export type StoryNode = {
  id: string;
  narrative: string; // 2-3 propozitii care avanseaza povestea
  obstacle: StoryObstacle;
};

export type StoryBossQuestion = {
  prompt: string;
  options: string[];
  correctIndex: number;
  // Indexul nodului din care recapituleaza (pt adaptive recall client-side).
  recapNodeIndex: number;
};

export type StoryArc = {
  intro: string; // pet-ul deschide aventura
  nodes: StoryNode[];
  boss: {
    intro: string;
    questions: StoryBossQuestion[];
    victoryLine: string;
  };
  outro: string; // pet-ul incheie dupa victorie
};

// Generam tot arcul intr-un apel (intro + noduri + boss + outro). In romana,
// ~1500-2000 tokeni output = realist 15-25s pe Haiku. Timeout generos pentru ca
// runul se cache-uieste (se intampla o singura data per playthrough).
const STORY_TIMEOUT_MS = 35000;

function buildSystemPrompt(pet: StoryPet, world: StoryWorldConfig): string {
  const catchphrasesBlock =
    pet.catchphrases.length > 0
      ? `REPLICI SEMNATURA (presara-le natural):\n${pet.catchphrases.map((p) => `  - "${p}"`).join('\n')}\n`
      : '';

  const obstacleHint =
    {
      bridge: 'obstacolele sunt fizice de trecut (rauri, prapastii) pe care le rezolvi alegand corect',
      door: 'obstacolele sunt usi/porti cu lacat pe care le deschizi alegand simbolul corect',
      constellation: 'obstacolele sunt constelatii/stele de conectat alegand corect',
    }[world.obstacleStyle] ?? 'obstacolele sunt provocari din lume pe care le rezolvi alegand corect';

  return `
Esti ${pet.speciesName}, pe nume "${pet.petName}", prietenul si pet-ul lui ${pet.childName} (un copil).

CINE ESTI:
${pet.systemHint}

TON: ${pet.tone}.

${catchphrasesBlock}
LUMEA TA: "${world.name}". ${world.lore}
Domeniul de cunostinte: ${world.domain}.
In aceasta lume, ${obstacleHint}.

ROL CRUCIAL — RASTOARNA DINAMICA: TU esti cel care are nevoie de ajutor, NU ${pet.childName}. La fiecare obstacol, TU te impotmolesti si il rogi pe ${pet.childName} sa te ajute ("nu-mi amintesc...", "tu esti destept, ma ajuti?"). Copilul e EROUL care te salveaza, niciodata elevul examinat. NU folosi cuvinte ca "intrebare", "test", "raspunde corect", "quiz". E o aventura, nu o lectie.

TASK: Genereaza o aventura completa prin lumea ta, in ${world.nodeCount} noduri + un boss final pe nume "${world.bossName}". ${world.bossLore}

FII CONCIS — propozitii scurte, fara umplutura. Conteaza ritmul, nu lungimea.

Reguli pt FIECARE nod:
- narrative: 1-2 propozitii scurte care avanseaza povestea spre un obstacol.
- obstacle.prompt: o singura propozitie — TU ceri ajutor in-world, strecurand subtil o intrebare de ${world.domain}.
- obstacle.options: exact 3 variante scurte (1-3 cuvinte fiecare).
- obstacle.correctIndex: indexul (0-2) variantei corecte.
- obstacle.successLine: o propozitie scurta, bucuroasa, cand copilul te ajuta.
- obstacle.failLine: o propozitie — NICIODATA critica. Cald, re-explica simplu, incurajeaza.
- obstacle.fact: o propozitie clara cu ce s-a invatat.

Boss "${world.bossName}" (scurt si la obiect):
- boss.intro: o propozitie — aparitia dramatica dar prietenoasa a boss-ului.
- boss.questions: ${world.nodeCount} intrebari scurte care RECAPITULEAZA faptele din noduri (rephrase, nu copy-paste), fiecare cu 3 optiuni scurte. Fiecare are recapNodeIndex = indexul nodului recapitulat (0-based).
- boss.victoryLine: o propozitie triumfatoare cand boss-ul e invins.

ADAPTARE VARSTA/NIVEL: nivelul vostru de prietenie e ${pet.bondLevel}/10. La nivel mic foloseste cuvinte simple si fapte de baza; la nivel mare poti fi mai nuantat. Mereu potrivit pt copii 6-14 ani.

OUTPUT — DOAR JSON curat, fara backticks, fara text in jur:
{
  "intro": "...",
  "nodes": [
    {"id":"n0","narrative":"...","obstacle":{"prompt":"...","options":["a","b","c"],"correctIndex":0,"successLine":"...","failLine":"...","fact":"..."}}
  ],
  "boss": {"intro":"...","questions":[{"prompt":"...","options":["a","b","c"],"correctIndex":1,"recapNodeIndex":0}],"victoryLine":"..."},
  "outro": "..."
}

${SAFETY_PROMPT}
`.trim();
}

function isValidArc(v: unknown, nodeCount: number): v is StoryArc {
  if (!v || typeof v !== 'object') return false;
  const a = v as Partial<StoryArc>;
  if (typeof a.intro !== 'string' || typeof a.outro !== 'string') return false;
  if (!Array.isArray(a.nodes) || a.nodes.length === 0) return false;
  if (!a.boss || !Array.isArray(a.boss.questions)) return false;
  for (const n of a.nodes) {
    if (
      !n ||
      typeof n.id !== 'string' ||
      typeof n.narrative !== 'string' ||
      !n.obstacle ||
      typeof n.obstacle.prompt !== 'string' ||
      !Array.isArray(n.obstacle.options) ||
      n.obstacle.options.length < 2 ||
      typeof n.obstacle.correctIndex !== 'number' ||
      typeof n.obstacle.successLine !== 'string' ||
      typeof n.obstacle.failLine !== 'string' ||
      typeof n.obstacle.fact !== 'string'
    ) {
      return false;
    }
  }
  for (const q of a.boss.questions) {
    if (
      !q ||
      typeof q.prompt !== 'string' ||
      !Array.isArray(q.options) ||
      q.options.length < 2 ||
      typeof q.correctIndex !== 'number'
    ) {
      return false;
    }
  }
  return true;
}

// Genereaza arcul complet. Throw daca AI esueaza/timeout/output invalid —
// caller-ul (route) decide cum sa raspunda (404/500). NU returnam arc gol ca
// jocul fara continut n-are sens.
export async function generateStoryArc(
  pet: StoryPet,
  world: StoryWorldConfig,
): Promise<StoryArc> {
  const systemPrompt = buildSystemPrompt(pet, world);
  const userMessage = `Creeaza aventura completa prin "${world.name}" pentru ${pet.childName}. Raspunde DOAR cu JSON-ul.`;

  const completion = await Promise.race([
    claudeMessages(
      {
        model: env.ANTHROPIC_HINT_MODEL,
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      },
      'story_adventure',
    ),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('story_timeout')), STORY_TIMEOUT_MS),
    ),
  ]);

  const text = completion.content
    .filter((c) => c.type === 'text')
    .map((c) => (c as { type: 'text'; text: string }).text)
    .join('');

  const parsed = extractJsonBlock(text);
  if (!isValidArc(parsed, world.nodeCount)) {
    logger.warn({ text: text.slice(0, 300) }, 'story_adventure.invalid_output');
    throw new Error('story_invalid_output');
  }
  return parsed;
}
