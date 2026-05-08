import { api } from './client';

// Pet-ul echipat al unui user — atasat oriunde returnam un user public
// (lista friends, profil, /me, co-walk participants).
export type PetSummary = {
  name: string;
  speciesSlug: string;
  speciesName: string;
  imageUrl: string | null;
};

export type Friend = {
  friendshipId: string;
  since: string;
  method: 'nfc' | 'ble' | 'manual';
  user: {
    id: string;
    name: string;
    xp: number;
    level: number;
    avatarSvg: string | null;
    pet: PetSummary | null;
  };
};

export function listFriends(): Promise<{ friends: Friend[] }> {
  return api<{ friends: Friend[] }>('/friends');
}

export type AddFriendResponse = {
  friendship: { id: string };
  created: boolean;
};

export function addFriend(friendUserId: string, method: 'nfc' | 'ble' | 'manual' = 'manual') {
  return api<AddFriendResponse>('/friends', {
    method: 'POST',
    body: { friendUserId, method },
  });
}
