import { api } from './client';

export type HuntStatus = 'LOBBY' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type MonsterType = 'green' | 'yellow' | 'red' | 'gold';
export type MonsterStatus = 'HIDDEN' | 'ENGAGED' | 'DEFEATED' | 'ESCAPED';
export type ChallengeOutcome = 'PENDING' | 'CORRECT' | 'WRONG' | 'SKIPPED';
export type ChallengeType = 'riddle' | 'photo' | 'counting';
export type Warmth = 'cold' | 'cool' | 'warm' | 'hot' | 'very_hot';

export type HuntPark = {
  id: string;
  osmId: string;
  name: string;
  polygon: unknown;
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  areaSqm: number;
  city: string | null;
  distanceM: number;
};

export type HuntLobbyMemberDto = {
  userId: string;
  name: string;
  level: number;
  avatarSvg: string | null;
};

export type HuntTeamDto = {
  id: string;
  name: string;
  score: number;
  monstersDefeated: number;
  memberCount: number;
  zone: unknown | null;
  members: { id: string; name: string; avatarSvg: string | null }[];
};

export type HuntSessionState =
  | {
      sessionId: string;
      status: 'LOBBY';
      isHost: boolean;
      durationSec: number;
      startedAt: string | null;
      endsAt: string | null;
      endedAt: string | null;
      park: { id: string; name: string };
      host: { id: string; name: string; avatarSvg: string | null };
      lobby: HuntLobbyMemberDto[];
      canStart: boolean;
      playersNeeded: number;
    }
  | {
      sessionId: string;
      status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
      isHost: boolean;
      durationSec: number;
      startedAt: string | null;
      endsAt: string | null;
      endedAt: string | null;
      park: { id: string; name: string };
      host: { id: string; name: string; avatarSvg: string | null };
      monsterCount: number;
      teams: HuntTeamDto[];
      myTeamId: string | null;
    };

export type HuntLobbyNearbyItem = {
  sessionId: string;
  host: { id: string; name: string; level: number; avatarSvg: string | null };
  parkName: string;
  durationSec: number;
  playerCount: number;
  joined: boolean;
};

export type HeartbeatResponse =
  | { status: 'COMPLETED'; autoCompleted: true }
  | {
      status: 'ACTIVE';
      timeRemainingSec: number;
      inPark: boolean;
      inZone: boolean;
      warmth: Warmth;
      nearestBearing: number | null;
      nearestType: MonsterType | null;
      revealMonster: { id: string; lat: number; lng: number; type: MonsterType } | null;
      engagedMonsters: Array<{
        id: string;
        type: MonsterType;
        name: string;
        loreShort: string;
        engagedAt: string;
        expiresAt: string;
      }>;
    };

export type ChallengeRunDto = {
  id: string;
  userId: string;
  mine: boolean;
  challenge: {
    id: string;
    type: ChallengeType;
    prompt: string;
    difficulty: number;
  };
  outcome: ChallengeOutcome;
  feedback: string | null;
  finishedAt: string | null;
};

export type EngageResponse = {
  monsterId: string;
  monster?: { type: MonsterType; name: string; loreShort: string };
  engagedAt: string;
  expiresAt: string;
  runs: ChallengeRunDto[];
};

export type FinalizeResponse = {
  status: MonsterStatus;
  pointsAwarded: number;
  durationMs?: number;
};

export type HuntResultsResponse = {
  sessionId: string;
  startedAt: string | null;
  endedAt: string | null;
  teams: Array<{
    rank: number;
    id: string;
    name: string;
    score: number;
    monstersDefeated: number;
    members: { id: string; name: string; avatarSvg: string | null }[];
  }>;
  myXp: { amount: number; rank: number } | null;
};

// Endpoint wrappers

export function listParksNearby(lat: number, lng: number) {
  return api<{ parks: HuntPark[] }>(`/hunt/parks/nearby?lat=${lat}&lng=${lng}`);
}

export function createSession(args: {
  parkId: string;
  durationSec: number;
  lat: number;
  lng: number;
}) {
  return api<{
    sessionId: string;
    parkName: string;
    durationSec: number;
    status: HuntStatus;
    lobby: { userId: string }[];
  }>('/hunt/sessions', { method: 'POST', body: args });
}

export function listLobbiesNearby(bleTokens: string[]) {
  return api<{ lobbies: HuntLobbyNearbyItem[] }>('/hunt/sessions/lobby/nearby', {
    method: 'POST',
    body: { bleTokens },
  });
}

export function joinSession(sessionId: string) {
  return api<{ joined: boolean }>(`/hunt/sessions/${sessionId}/join`, { method: 'POST' });
}

export function leaveSession(sessionId: string) {
  return api<{ left: boolean }>(`/hunt/sessions/${sessionId}/leave`, { method: 'POST' });
}

export function startSession(sessionId: string) {
  return api<{
    sessionId: string;
    status: HuntStatus;
    startedAt: string | null;
    endsAt: string | null;
    monsterCount: number;
    teamCount: number;
  }>(`/hunt/sessions/${sessionId}/start`, { method: 'POST' });
}

export function cancelSession(sessionId: string) {
  return api<{ cancelled: boolean }>(`/hunt/sessions/${sessionId}/cancel`, { method: 'POST' });
}

export function getSessionState(sessionId: string) {
  return api<HuntSessionState>(`/hunt/sessions/${sessionId}`);
}

export function postHeartbeat(sessionId: string, lat: number, lng: number) {
  return api<HeartbeatResponse>(`/hunt/sessions/${sessionId}/heartbeat`, {
    method: 'POST',
    body: { lat, lng },
  });
}

export function engageMonster(sessionId: string, monsterId: string, lat: number, lng: number) {
  return api<EngageResponse>(`/hunt/sessions/${sessionId}/monsters/${monsterId}/engage`, {
    method: 'POST',
    body: { lat, lng },
  });
}

export function answerRun(
  sessionId: string,
  monsterId: string,
  runId: string,
  answer: string,
) {
  return api<{ correct: boolean; feedback: string }>(
    `/hunt/sessions/${sessionId}/monsters/${monsterId}/runs/${runId}/answer`,
    { method: 'POST', body: { answer } },
  );
}

export function finalizeMonster(sessionId: string, monsterId: string) {
  return api<FinalizeResponse>(
    `/hunt/sessions/${sessionId}/monsters/${monsterId}/finalize`,
    { method: 'POST' },
  );
}

export function endSession(sessionId: string) {
  return api<{ ended: boolean }>(`/hunt/sessions/${sessionId}/end`, { method: 'POST' });
}

export function getResults(sessionId: string) {
  return api<HuntResultsResponse>(`/hunt/sessions/${sessionId}/results`);
}
