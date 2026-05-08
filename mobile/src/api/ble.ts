import { api } from './client';

export type BleResolved = {
  token: string;
  userId: string;
  name: string;
  level: number;
  isFriend: boolean;
};

export type CoWalkResult = {
  dailyAwarded: boolean;
  me: { alreadyAwarded: boolean; amount: number; newXp: number; newLevel: number; leveledUp: boolean };
  friend: { alreadyAwarded: boolean; amount: number; newXp: number; newLevel: number; leveledUp: boolean };
  durationSec: number;
  startedAt: string;
  squadSize: number;
  squadMultiplier: number;
};

export function getMyBleToken(): Promise<{ token: string }> {
  return api<{ token: string }>('/me/ble-token');
}

export function resolveBleTokens(tokens: string[]): Promise<{ resolved: BleResolved[] }> {
  return api<{ resolved: BleResolved[] }>('/interactions/ble-resolve', {
    method: 'POST',
    body: { tokens },
  });
}

export function postCoWalk(args: {
  friendUserId: string;
  durationSec: number;
  startedAt: string;
  stepsMe: number;
  rssiStdDev: number;
  squadFriendIds: string[];
}): Promise<CoWalkResult> {
  return api<CoWalkResult>('/interactions/co-walk', { method: 'POST', body: args });
}

// Heartbeat de prezenta — trimite lista de prieteni pe care ii vezi ACUM prin
// BLE. Backend-ul stocheaza in Redis cu TTL 90s si verifica mutual visibility
// la commit co-walk (refuza XP daca peer-ul nu te-a vazut).
export function postPresenceHeartbeat(peers: string[]): Promise<{ ok: boolean; count: number }> {
  return api<{ ok: boolean; count: number }>('/presence/heartbeat', {
    method: 'POST',
    body: { peers },
  });
}
