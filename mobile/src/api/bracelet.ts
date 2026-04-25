import { api } from './client';

export type Bracelet = {
  id: string;
  uid: string;
  userId: string;
  provisionedAt: string;
};

export function getMyBracelet() {
  return api<Bracelet>('/me/bracelet');
}

export function provisionBracelet(uid: string) {
  return api<Bracelet>('/me/bracelet', { method: 'POST', body: { uid } });
}

export function deleteMyBracelet() {
  return api<void>('/me/bracelet', { method: 'DELETE' });
}

export type ScanFriendResponse = {
  friend: { id: string; name: string; level: number; xp: number };
  friendshipCreated: boolean;
  interactionCreated: boolean;
};

export function scanFriend(uid: string) {
  return api<ScanFriendResponse>('/interactions/scan', { method: 'POST', body: { uid } });
}
