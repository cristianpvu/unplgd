import { api, API_BASE_URL } from './client';

export type Story = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

export type FinalStory = Story & {
  bodyAudioUrl: string | null;
  ttsProvider?: 'eleven' | 'edge' | null;
  ttsError?: string | null;
};

export type CreateChatResponse =
  | { reply: string; finalStory?: undefined }
  | { reply?: undefined; finalStory: FinalStory };

export type InboxItem = {
  storyId: string;
  title: string;
  createdAt: string;
  author: { id: string; name: string; avatarSvg: string | null };
  claimStatus: 'NONE' | 'ATTEMPTING';
};

export type ClaimDetails = {
  id: string;
  status: 'ATTEMPTING' | 'VERIFIED' | 'FAILED';
  attempts: number;
  score: number | null;
  story: {
    id: string;
    title: string;
    createdAt: string;
    author: { id: string; name: string; avatarSvg: string | null };
  };
};

export type VerifyChatResponse =
  | { reply: string; done?: undefined }
  | {
      done: true;
      status: 'VERIFIED' | 'FAILED' | 'ATTEMPTING';
      score: number;
      summary: string;
      summaryAudioUrl: string | null;
      ttsProvider?: 'eleven' | 'edge' | null;
      ttsError?: string | null;
      perFact: { q: string; given: string; correct: boolean }[];
      canRetry: boolean;
      xp: { listener: number; author: number };
    };

// URL-urile MP3 din backend sunt relative (/tts-cache/abc.mp3) — le facem
// absolute aici ca expo-av sa le poata fetch.
export function absoluteAudioUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE_URL}${path}`;
}

export function postCreateChat(message: string) {
  return api<CreateChatResponse>('/stories', { method: 'POST', body: { message } });
}

export function resetCreateDraft() {
  return api<void>('/stories/draft', { method: 'DELETE' });
}

export function listMyStories() {
  return api<{ stories: Story[] }>('/stories/mine');
}

export function listInbox() {
  return api<{ items: InboxItem[] }>('/stories/inbox');
}

export function startClaim(storyId: string) {
  return api<{ claimId: string }>(`/stories/${storyId}/claim`, { method: 'POST' });
}

export function getClaim(claimId: string) {
  return api<{ claim: ClaimDetails }>(`/stories/claims/${claimId}`);
}

export function postVerifyAnswer(claimId: string, message: string) {
  return api<VerifyChatResponse>(`/stories/claims/${claimId}/answer`, {
    method: 'POST',
    body: { message },
  });
}
