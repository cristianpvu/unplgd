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
}): Promise<CoWalkResult> {
  return api<CoWalkResult>('/interactions/co-walk', { method: 'POST', body: args });
}
