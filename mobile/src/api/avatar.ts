import { api } from './client';
import type { AvatarPicks, Slot } from '../avatar/catalog';

export type AvatarResponse = {
  picks: AvatarPicks;
  svg: string;
  level: number;
  updatedAt: string;
};

export type CatalogItem = {
  id: string; // = slug; expus ca "id" pentru compatibilitate cu UI-ul existent
  slug: string;
  name: string;
  feature: string | null;
  level: number;
  locked: boolean;
};

export type CatalogResponse = {
  level: number;
  slots: Record<Slot, CatalogItem[]>;
};

export function getMyAvatar() {
  return api<AvatarResponse>('/me/avatar');
}

export function updateMyAvatar(picks: AvatarPicks) {
  return api<AvatarResponse>('/me/avatar', { method: 'PATCH', body: picks });
}

export function getAvatarCatalog() {
  return api<CatalogResponse>('/avatar/catalog');
}

export function previewAvatar(picks: AvatarPicks) {
  return api<{ svg: string }>('/avatar/preview', { method: 'POST', body: picks });
}
