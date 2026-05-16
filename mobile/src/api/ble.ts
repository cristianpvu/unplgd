import { api } from './client';
import type { PetSummary } from './friends';

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
    // XP cumulat din tick-uri (escaladator dupa baseline). 0 = inca nu se
    // acorda (sesiune sub 10 min sau prag nedat).
    totalTickXp: number;
    name: string;
    level: number;
    // SVG-ul capului (Avatar.svg din DB) cand userul si-a generat avatar.
    // null = afisam fallback (initiala numelui).
    avatarSvg: string | null;
    // Pet-ul echipat — afisat ca chip mic in coltul avatarului.
    pet: PetSummary | null;
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

// Iesire explicita din sesiunea curenta — emite cowalk:left catre ceilalti
// membri instant, fara sa astepte grace-ul de 90s. Folosit cand user-ul
// dezactiveaza manual co-walk-ul din UI.
export function leaveCoWalk(): Promise<{ ok: boolean; leftEvents: number }> {
  return api<{ ok: boolean; leftEvents: number }>('/presence/cowalk/leave', {
    method: 'POST',
  });
}

// Pune sesiunea pe pauza fara s-o distruga. La urmatorul heartbeat mutual,
// daca pauza singulara < 3min si total < 5min, sesiunea continua de unde a
// ramas. Altfel ghostul expira si pornim un handshake nou.
export function pauseCoWalk(): Promise<{ ok: boolean; leftEvents: number }> {
  return api<{ ok: boolean; leftEvents: number }>('/presence/cowalk/pause', {
    method: 'POST',
  });
}
