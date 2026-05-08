import { api } from './client';

export type BleResolved = {
  token: string;
  userId: string;
  name: string;
  level: number;
  isFriend: boolean;
};

export type ServerSession = {
  id: string;
  startedAt: number;
  participants: Array<{
    userId: string;
    joinedAt: number;
    awarded: boolean;
    name: string;
    level: number;
  }>;
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

// Heartbeat de prezenta — trimite lista de prieteni pe care ii vezi ACUM prin
// BLE. Backend-ul stocheaza in Redis cu TTL 90s SI rulează tick-ul de session
// co-walk: identifica mutual visibility, creeaza/extinde sesiuni si emite
// evenimente prin socket.
export function postPresenceHeartbeat(peers: string[]): Promise<{ ok: boolean; count: number; sessionEvents: number }> {
  return api<{ ok: boolean; count: number; sessionEvents: number }>('/presence/heartbeat', {
    method: 'POST',
    body: { peers },
  });
}

// Returneaza sesiunea curenta (daca exista) — folosit la reconnect socket
// sau cold-start ca sa preluam UI-ul de unde a ramas.
export function getCurrentCoWalk(): Promise<{ serverNow: number; session: ServerSession | null }> {
  return api<{ serverNow: number; session: ServerSession | null }>('/presence/cowalk/current');
}
