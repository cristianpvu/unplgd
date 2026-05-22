import { api } from './client';

// ===== Story-adventure: pet-ul te poarta printr-o lume pe o harta cu noduri +
// boss. Intrebari deghizate ca obstacole, deblochezi fundaluri de profil.

export type AdventureBackground = {
  key: string;
  name: string;
  imageUrl: string;
  tier: number;
  requiredCompletions: number;
  unlocked: boolean;
};

export type AdventureWorld = {
  slug: string;
  name: string;
  lore: string;
  domain: string;
  bossName: string;
  nodeCount: number;
  accentColor: string;
  bgColor: string;
  obstacleStyle: string;
  completions: number;
  activeRunId: string | null;
  backgrounds: AdventureBackground[];
};

export type AdventureWorldsResponse = {
  pet: { name: string; speciesName: string };
  worlds: AdventureWorld[];
};

// Arc public (fara correctIndex / fact — ascunse server-side).
export type AdventureObstacle = {
  prompt: string;
  options: string[];
};

export type AdventureNode = {
  id: string;
  narrative: string;
  obstacle: AdventureObstacle;
};

export type AdventureBossQuestion = {
  id: string;
  prompt: string;
  options: string[];
  recapNodeIndex: number;
};

export type AdventureArc = {
  intro: string;
  outro: string;
  nodes: AdventureNode[];
  boss: {
    intro: string;
    victoryLine: string;
    questions: AdventureBossQuestion[];
  };
};

export type AdventureProgress = {
  nodeIndex: number;
  nodeAnswers: { nodeId: string; correct: boolean }[];
  bossDefeated: boolean;
};

export type AdventureRunResponse = {
  runId: string;
  worldSlug: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  progress: AdventureProgress;
  arc: AdventureArc;
};

export type NodeAnswerResponse = {
  correct: boolean;
  line: string; // reactia pet-ului (success sau fail)
  fact: string; // nuggetul de cunostinte
  correctIndex: number;
};

export type BossAnswerResponse = {
  correct: boolean;
  correctIndex: number;
};

export type CompleteResponse = {
  worldSlug: string;
  completions: number;
  bondAwarded: number;
  unlockedBackgrounds: {
    key: string;
    name: string;
    imageUrl: string;
    tier: number;
    isNew: boolean;
  }[];
};

export type BackgroundsResponse = {
  selectedKey: string | null;
  backgrounds: {
    key: string;
    name: string;
    imageUrl: string;
    videoUrl: string | null;
    tier: number;
    worldSlug: string | null;
  }[];
};

export function getAdventureWorlds() {
  return api<AdventureWorldsResponse>('/adventure/worlds');
}

export function startAdventureRun(worldSlug: string) {
  return api<AdventureRunResponse>(`/adventure/worlds/${worldSlug}/run`, {
    method: 'POST',
  });
}

export function answerNode(runId: string, nodeIndex: number, optionIndex: number) {
  return api<NodeAnswerResponse>(`/adventure/runs/${runId}/node/${nodeIndex}/answer`, {
    method: 'POST',
    body: { optionIndex },
  });
}

export function answerBoss(runId: string, questionIndex: number, optionIndex: number) {
  return api<BossAnswerResponse>(`/adventure/runs/${runId}/boss/answer`, {
    method: 'POST',
    body: { questionIndex, optionIndex },
  });
}

export function completeAdventure(runId: string) {
  return api<CompleteResponse>(`/adventure/runs/${runId}/complete`, { method: 'POST' });
}

export function getBackgrounds() {
  return api<BackgroundsResponse>('/adventure/backgrounds');
}

export function selectBackground(key: string | null) {
  return api<{ selectedKey: string | null }>('/adventure/backgrounds/select', {
    method: 'POST',
    body: { key },
  });
}
