import { api } from './client';

export type CoCreationStatus =
  | 'ACTIVE'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'FAILED';

export type CoCreationStory = {
  id: string;
  title: string;
  body: string;
};

export type CoCreationParticipant = {
  id: string;
  name: string;
};

export type CoCreation = {
  id: string;
  status: CoCreationStatus;
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  originalImageUrl: string | null;
  aiImageUrl: string | null;
  aiValid: boolean | null;
  aiFeedback: string | null;
  story: CoCreationStory;
  participants: CoCreationParticipant[];
};

export type AlbumItem = {
  id: string;
  submittedAt: string | null;
  story: { id: string; title: string };
  participants: CoCreationParticipant[];
  originalImageUrl: string | null;
  aiImageUrl: string | null;
};

export function startCoCreation(friendId: string, storyId: string) {
  return api<CoCreation>('/co-creations/start', {
    method: 'POST',
    body: { friendId, storyId },
  });
}

export function submitCoCreation(
  id: string,
  image: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
) {
  return api<CoCreation>(`/co-creations/${id}/submit`, {
    method: 'POST',
    body: { image, mimeType },
  });
}

export function getCoCreation(id: string) {
  return api<CoCreation>(`/co-creations/${id}`);
}

export function getActiveCoCreation() {
  return api<{ active: CoCreation | null }>('/co-creations/active');
}

export function getAlbum() {
  return api<{ items: AlbumItem[] }>('/co-creations/album');
}

export function cancelCoCreation(id: string) {
  return api<void>(`/co-creations/${id}`, { method: 'DELETE' });
}

