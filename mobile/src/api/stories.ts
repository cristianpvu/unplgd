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

export type StoryProgress = { gathered: number; total: number };

export type CreateChatResponse =
  | {
      reply: string;
      replyAudioUrl: string | null;
      progress: StoryProgress;
      finalStory?: undefined;
    }
  | {
      reply?: undefined;
      replyAudioUrl?: undefined;
      progress?: undefined;
      finalStory: FinalStory;
    };

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
  | { reply: string; replyAudioUrl: string | null; done?: undefined }
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

export function listFriendStories(friendId: string) {
  return api<{ stories: Story[] }>(`/stories/by-friend/${friendId}`);
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

export function ttsSynthesize(text: string) {
  return api<{ audioUrl: string; provider: 'eleven' | 'edge' }>('/stories/tts', {
    method: 'POST',
    body: { text },
  });
}

// Extindere lant: chat conversational pe povestea pe care am verificat-o.
// Eligibil doar daca am StoryClaim status=VERIFIED pe storyId. Final = poveste
// noua (parentStoryId=storyId, mostenind chainRootId).
export type ExtendFinalStory = {
  id: string;
  title: string;
  body: string;
  parentStoryId: string;
  chainRootId: string;
  chainLength: number;
  bodyAudioUrl: string | null;
  ttsProvider?: 'eleven' | 'edge' | null;
  ttsError?: string | null;
};

export type ExtendChatResponse =
  | { reply: string; replyAudioUrl: string | null; finalStory?: undefined }
  | {
      reply?: undefined;
      replyAudioUrl?: undefined;
      finalStory: ExtendFinalStory;
      xp: {
        extender: { alreadyAwarded: boolean; amount: number; newXp: number; newLevel: number; leveledUp: boolean };
        chainBonusAwarded: boolean;
      };
    };

export function postExtendChat(storyId: string, message: string) {
  return api<ExtendChatResponse>(`/stories/${storyId}/extend`, {
    method: 'POST',
    body: { message },
  });
}

export function resetExtendDraft(storyId: string) {
  return api<void>(`/stories/${storyId}/extend/draft`, { method: 'DELETE' });
}

export type ChainChapter = {
  order: number;
  storyId: string;
  title: string;
  body: string;
  audioUrl: string | null;
  audioProvider: 'eleven' | 'edge' | null;
  createdAt: string;
  author: { id: string; name: string; avatarSvg: string | null };
};

export function getStoryChain(storyId: string) {
  return api<{ chainRootId: string; chainLength: number; chapters: ChainChapter[] }>(
    `/stories/${storyId}/chain`,
  );
}
