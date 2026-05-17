import { getIO, userRoomName } from './io.js';

export type PhoneDownUpdateReason =
  | 'invited'
  | 'lobby_changed'
  | 'started'
  | 'participant_surrendered'
  | 'participant_paused'
  | 'participant_resumed'
  | 'ended'
  | 'cancelled';

export function phoneDownRoomName(sessionId: string): string {
  return `pd:s:${sessionId}`;
}

// Notificare push catre toti membrii unei sesiuni. Payload minimal — clientul
// re-fetch-uieste GET /phonedown/sessions/:id pentru sursa de adevar.
export function emitPhoneDownUpdate(
  sessionId: string,
  reason: PhoneDownUpdateReason,
): void {
  try {
    getIO()
      .to(phoneDownRoomName(sessionId))
      .emit('phonedown:update', { sessionId, reason });
  } catch {
    // socket neinitializat in teste — nu blocam workflow-ul.
  }
}

// Invitatie directa la user (folosita in lobby — invited-ul inca nu e
// subscriber la session room). Mobilul vede toast + buton join.
export function emitPhoneDownInvite(
  invitedUserId: string,
  payload: { sessionId: string; hostId: string; hostName: string },
): void {
  try {
    getIO().to(userRoomName(invitedUserId)).emit('phonedown:invite', payload);
  } catch {
    // socket neinitializat — ignore.
  }
}
