import { api } from './client';
import type { AvatarPicks, Slot } from '../avatar/catalog';

export type AvatarResponse = {
  picks: AvatarPicks;
  svg: string;
  svgBlink: string | null;
  level: number;
  updatedAt: string;
};

export type CatalogItem = {
  slug: string;
  name: string;
  feature: string | null;
  level: number;
  locked: boolean;
};

export type CatalogType = {
  slug: Slot;
  name: string;
  group: 'face' | 'body';
  items: CatalogItem[];
};

export type CatalogResponse = {
  level: number;
  types: CatalogType[];
  defaultPicks: AvatarPicks;
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
