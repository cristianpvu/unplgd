import { api } from './client';

export type PhoneDownStatus = 'WAITING' | 'PLAYING' | 'ENDED' | 'CANCELLED';
export type PhoneDownParticipantStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'SURRENDERED'
  | 'WINNER';

export type PhoneDownParticipantDto = {
  id: string;
  userId: string;
  name: string;
  status: PhoneDownParticipantStatus;
  joinedAt: string;
  phoneDownAt: string | null;
  surrenderedAt: string | null;
  rank: number | null;
  durationMs: number;
  isPaused: boolean;
};

export type PhoneDownSessionDto = {
  id: string;
  status: PhoneDownStatus;
  hostId: string;
  startedAt: string | null;
  capAt: string | null;
  endedAt: string | null;
  serverNow: string;
  participants: PhoneDownParticipantDto[];
};

export type PhoneDownInviteEvent = {
  sessionId: string;
  hostId: string;
  hostName: string;
};

// ---------- Lobby / session lifecycle ----------

export function createLobby(invitedFriendIds: string[]) {
  return api<PhoneDownSessionDto>('/phonedown/lobby', {
    method: 'POST',
    body: { invitedFriendIds },
  });
}

export function joinSession(sessionId: string) {
  return api<PhoneDownSessionDto>(`/phonedown/sessions/${sessionId}/join`, {
    method: 'POST',
  });
}

export function leaveSession(sessionId: string) {
  return api<{ ok: true }>(`/phonedown/sessions/${sessionId}/leave`, {
    method: 'POST',
  });
}

export function startSession(sessionId: string) {
  return api<PhoneDownSessionDto>(`/phonedown/sessions/${sessionId}/start`, {
    method: 'POST',
  });
}

export function surrenderSession(sessionId: string) {
  return api<PhoneDownSessionDto>(`/phonedown/sessions/${sessionId}/surrender`, {
    method: 'POST',
  });
}

export function pauseSession(sessionId: string) {
  return api<{ ok: true }>(`/phonedown/sessions/${sessionId}/pause`, {
    method: 'POST',
  });
}

export function resumeSession(sessionId: string) {
  return api<{ ok: true }>(`/phonedown/sessions/${sessionId}/resume`, {
    method: 'POST',
  });
}

export function getSession(sessionId: string) {
  return api<PhoneDownSessionDto>(`/phonedown/sessions/${sessionId}`);
}

export function getCurrent() {
  return api<{ session: PhoneDownSessionDto | null }>('/phonedown/current');
}

export type PhoneDownInviteDto = {
  sessionId: string;
  hostId: string;
  hostName: string;
  createdAt: string;
  participantCount: number;
};

// Lobby-uri WAITING in care esti invitat dar inca n-ai aderat. Recuperare
// pentru invitatii ratate (socket/push pierdut).
export function getInvites() {
  return api<{ invites: PhoneDownInviteDto[] }>('/phonedown/invites');
}
