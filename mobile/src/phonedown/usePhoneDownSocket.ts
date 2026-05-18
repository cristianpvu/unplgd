import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../lib/socket';

type PhoneDownUpdatePayload = {
  sessionId: string;
  reason:
    | 'invited'
    | 'lobby_changed'
    | 'started'
    | 'participant_surrendered'
    | 'participant_paused'
    | 'participant_resumed'
    | 'ended'
    | 'cancelled';
};

// Subscribe la push-uri pentru o sesiune Phone Down. La fiecare update
// invalidam query-ul de sesiune ca consumatorul sa refetch-uiasca starea.
export function usePhoneDownSocket(sessionId: string | undefined): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let socketRef: Awaited<ReturnType<typeof getSocket>> | null = null;

    const onUpdate = (payload: PhoneDownUpdatePayload) => {
      if (payload.sessionId !== sessionId) return;
      qc.invalidateQueries({ queryKey: ['phonedown', 'session', sessionId] });
      if (payload.reason === 'ended' || payload.reason === 'cancelled') {
        // Cufarul putut fi creat la ended — invalidam si lista.
        qc.invalidateQueries({ queryKey: ['chests'] });
        qc.invalidateQueries({ queryKey: ['phonedown', 'current'] });
      }
    };
    const onReconnect = () => {
      if (cancelled || !socketRef) return;
      // Room-ul se pierde la disconnect — re-join.
      socketRef.emit('phonedown:join', { sessionId });
    };

    (async () => {
      try {
        const socket = await getSocket();
        if (cancelled) return;
        socketRef = socket;
        socket.emit(
          'phonedown:join',
          { sessionId },
          (resp: { ok: boolean; error?: string } | undefined) => {
            // Ack absent = timeout (server lent / pierdere pachet) — nu logam,
            // polling-ul REST acopera oricum starea. Error explicit "not_participant"
            // = sesiune invalida pentru user → forteaza re-detectare.
            if (resp && resp.ok === false) {
              if (resp.error === 'not_participant') {
                qc.invalidateQueries({ queryKey: ['phonedown', 'current'] });
                qc.removeQueries({ queryKey: ['phonedown', 'session', sessionId] });
              } else if (resp.error) {
                console.warn('phonedown:join failed', resp.error);
              }
            }
          },
        );
        socket.on('phonedown:update', onUpdate);
        socket.on('connect', onReconnect);
      } catch (e) {
        console.warn('phonedown socket failed', e);
      }
    })();

    return () => {
      cancelled = true;
      if (socketRef) {
        socketRef.off('phonedown:update', onUpdate);
        socketRef.off('connect', onReconnect);
        socketRef.emit('phonedown:leave', { sessionId });
      }
    };
  }, [sessionId, qc]);
}
