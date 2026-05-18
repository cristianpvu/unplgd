import { useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';
import type { PhoneDownInviteEvent } from '../api/phonedown';

// Asculta invitatiile push catre user-ul curent (room user:<id>, auto-join
// la handshake). Returneaza ultima invitatie primita — folosit pentru toast
// "X te-a invitat la Phone Down".
//
// Consumer-ul (un provider/layout root) decide cum sa o afiseze si cum sa
// o stearga (acknowledge).
export function usePhoneDownInvites(): {
  invite: PhoneDownInviteEvent | null;
  dismiss: () => void;
} {
  const [invite, setInvite] = useState<PhoneDownInviteEvent | null>(null);

  useEffect(() => {
    let cancelled = false;
    let socketRef: Awaited<ReturnType<typeof getSocket>> | null = null;

    const onInvite = (payload: PhoneDownInviteEvent) => {
      setInvite(payload);
    };

    (async () => {
      try {
        const socket = await getSocket();
        if (cancelled) return;
        socketRef = socket;
        socket.on('phonedown:invite', onInvite);
      } catch (e) {
        console.warn('phonedown invites failed', e);
      }
    })();

    return () => {
      cancelled = true;
      socketRef?.off('phonedown:invite', onInvite);
    };
  }, []);

  return { invite, dismiss: () => setInvite(null) };
}
