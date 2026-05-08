import { api } from './client';
import type { PetSummary } from './friends';

export type UserProfile = {
  id: string;
  name: string;
  xp: number;
  level: number;
  createdAt: string;
  avatarSvg: string | null;
  avatarSvgBlink: string | null;
  pet: PetSummary | null;
};

export type CoCreationAlbumItem = {
  id: string;
  submittedAt: string | null;
  story: { id: string; title: string };
  originalImageUrl: string | null;
  aiImageUrl: string | null;
  participants: { id: string; name: string }[];
};

export type FriendAlbum = {
  partner: { id: string; name: string; avatarSvg: string | null };
  count: number;
  coverImageUrl: string | null;
  items: CoCreationAlbumItem[];
};

export function getUserProfile(id: string) {
  return api<UserProfile>(`/users/${id}`);
}

export function getUserCoCreations(id: string) {
  return api<{ albums: FriendAlbum[] }>(`/users/${id}/co-creations`);
}
