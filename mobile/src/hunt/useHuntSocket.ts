import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../lib/socket';

type HuntUpdatePayload = {
  sessionId: string;
  reason:
    | 'lobby_changed'
    | 'started'
    | 'ended'
    | 'cancelled'
    | 'monster_engaged'
    | 'monster_finalized'
    | 'run_answered';
};

// Subscribe la push-uri pentru o sesiune. La fiecare update server-ul ne
// notifica si invalidam query-ul de session — refetch-ul e instant.
export function useHuntSocket(sessionId: string | undefined): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let socketRef: Awaited<ReturnType<typeof getSocket>> | null = null;
    const onUpdate = (payload: HuntUpdatePayload) => {
      if (payload.sessionId !== sessionId) return;
      qc.invalidateQueries({ queryKey: ['hunt', 'session', sessionId] });
    };
    const onReconnect = () => {
      if (cancelled || !socketRef) return;
      // Room-urile se pierd la disconnect — re-join la fiecare reconnect.
      socketRef.emit('hunt:join', { sessionId });
    };

    (async () => {
      try {
        const socket = await getSocket();
        if (cancelled) return;
        socketRef = socket;
        socket.emit('hunt:join', { sessionId }, (resp: { ok: boolean; error?: string }) => {
          if (!resp?.ok) {
            console.warn('hunt:join failed', resp?.error);
          }
        });
        socket.on('hunt:update', onUpdate);
        socket.on('connect', onReconnect);
      } catch (e) {
        console.warn('socket connection failed', e);
      }
    })();

    return () => {
      cancelled = true;
      if (socketRef) {
        socketRef.off('hunt:update', onUpdate);
        socketRef.off('connect', onReconnect);
        socketRef.emit('hunt:leave', { sessionId });
      }
    };
  }, [sessionId, qc]);
}
