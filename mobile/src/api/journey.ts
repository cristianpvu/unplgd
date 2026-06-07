// Client journey — TTS + random friend pt encounter dinamic.

import { api, API_BASE_URL } from './client';

export type JourneyVoice = 'narrator' | 'pet';

export type JourneyTtsResponse = {
  text: string;
  audioUrl: string | null;
  provider: 'eleven' | 'edge' | null;
};

export function synthesizeJourneyTts(
  text: string,
  voice: JourneyVoice,
  visitorSpeciesSlug?: string,
) {
  return api<JourneyTtsResponse>('/journey/tts', {
    method: 'POST',
    body: { text, voice, visitorSpeciesSlug },
  });
}

export type RandomFriendPet = {
  friendName: string;
  petName: string;
  speciesSlug: string;
  speciesName: string;
  petImageUrl: string | null;
};

export function getRandomFriendPet() {
  return api<RandomFriendPet>('/journey/random-friend');
}

export type CheckpointReward = {
  bondAwarded: number;
  unlockedBackground: {
    key: string;
    name: string;
    imageUrl: string;
    videoUrl: string | null;
    tier: number;
  } | null;
};

export type JourneyQuestionDto = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  successLine: string;
  failLine: string;
  // Citita de narator dupa reactia pet-ului. Optional.
  explanation: string | null;
};

export function fetchJourneyQuestions(domain: string, count: number) {
  return api<{ questions: JourneyQuestionDto[]; age: number }>(
    `/journey/questions?domain=${encodeURIComponent(domain)}&count=${count}`,
  );
}

// Trimite raspunsul la backend. Fire-and-forget — UI nu asteapta. Server
// valideaza correctIndex si acorda XP idempotent pe questionId.
export type JourneyAnswerResponse = {
  correct: boolean;
  awarded: { domain: number; domainSlug?: string; skills: number };
};

export function submitJourneyAnswer(questionId: string, chosenIndex: number) {
  return api<JourneyAnswerResponse>('/journey/answer', {
    method: 'POST',
    body: { questionId, chosenIndex },
  });
}

export function getJourneyProgress(petSlug: string) {
  return api<{ petSlug: string; completedChapters: string[]; completedToday: boolean }>(
    `/journey/progress?petSlug=${encodeURIComponent(petSlug)}`,
  );
}

export function claimCheckpoint(args: {
  sceneId: string;
  chapterId: string;
  petSlug?: string;
  bondXp?: number;
  backgroundKey?: string;
}) {
  return api<CheckpointReward>('/journey/checkpoint', { method: 'POST', body: args });
}

export function absoluteAudioUrl(path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path}`;
}
