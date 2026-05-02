import { getIO, huntRoomName } from './io.js';

export type HuntUpdateReason =
  | 'lobby_changed'
  | 'started'
  | 'ended'
  | 'cancelled'
  | 'monster_engaged'
  | 'monster_finalized'
  | 'run_answered';

// Notifica toti subscriberii la sesiune ca state-ul s-a schimbat. Payload-ul e
// minimal (reason + sessionId) — clientul re-fetch-uieste GET /hunt/sessions/:id
// ca sursa de adevar. Asta evita drift intre push si DB.
export function emitHuntUpdate(sessionId: string, reason: HuntUpdateReason): void {
  try {
    getIO().to(huntRoomName(sessionId)).emit('hunt:update', { sessionId, reason });
  } catch {
    // socket.io neinitializat (ex. teste, scripts) — nu cadem.
  }
}
