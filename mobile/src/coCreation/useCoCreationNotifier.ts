import { useEffect } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../lib/socket';

// Socket-ul e auto-join in room-ul `user:<userId>` la handshake (vezi backend
// lib/socket/io.ts), asa ca event-urile catre user ajung instant fara `join`.
// Hook-ul se monteaza o singura data pe app shell — listener global care
// reactioneaza cand celalalt copil porneste o sesiune cu user-ul curent.

type JoinedPayload = { sessionId: string };
type StatusChangedPayload = { sessionId: string; status: string };

export function useCoCreationNotifier(enabled: boolean): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let socketRef: Awaited<ReturnType<typeof getSocket>> | null = null;

    const onJoined = (payload: JoinedPayload) => {
      if (!payload?.sessionId) return;
      qc.invalidateQueries({ queryKey: ['co-creations'] });
      // Push, nu replace — daca user-ul era pe alt ecran, ramane in stack.
      router.push(`/(app)/co-create/${payload.sessionId}`);
    };

    const onStatusChanged = (payload: StatusChangedPayload) => {
      if (!payload?.sessionId) return;
      qc.invalidateQueries({ queryKey: ['co-creations', payload.sessionId] });
      qc.invalidateQueries({ queryKey: ['co-creations', 'active'] });
    };

    (async () => {
      try {
        const socket = await getSocket();
        if (cancelled) return;
        socketRef = socket;
        socket.on('co-creation:joined', onJoined);
        socket.on('co-creation:status_changed', onStatusChanged);
      } catch (e) {
        console.warn('co-creation socket connect failed', e);
      }
    })();

    return () => {
      cancelled = true;
      if (socketRef) {
        socketRef.off('co-creation:joined', onJoined);
        socketRef.off('co-creation:status_changed', onStatusChanged);
      }
    };
  }, [enabled, qc]);
}
