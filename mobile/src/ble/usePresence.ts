import { useEffect, useState } from 'react';
import { presence, type Peer, type CoWalkSession, type CoWalkEvent } from './presence';
import { requestBlePermissions, type BlePermissionResult } from './permissions';

export type PresenceState = {
  active: boolean;
  permission: BlePermissionResult | 'unknown';
  myToken: string | null;
  peers: Peer[];
  sessions: CoWalkSession[];
  error: string | null;
};

export function usePresence() {
  const [state, setState] = useState<PresenceState>({
    active: presence.isRunning(),
    permission: 'unknown',
    myToken: null,
    peers: [],
    sessions: [],
    error: null,
  });

  useEffect(() => {
    const unsub = presence.subscribe((snap) => {
      setState((s) => ({
        ...s,
        peers: snap.peers,
        myToken: snap.myToken,
        sessions: snap.sessions,
        active: presence.isRunning(),
      }));
    });
    return unsub;
  }, []);

  async function start() {
    setState((s) => ({ ...s, error: null }));
    const perm = await requestBlePermissions();
    setState((s) => ({ ...s, permission: perm }));
    if (perm !== 'granted') {
      setState((s) => ({ ...s, error: `Permisiuni BLE refuzate (${perm})` }));
      return;
    }
    try {
      await presence.start();
      setState((s) => ({ ...s, active: true }));
    } catch (e: any) {
      setState((s) => ({ ...s, error: e?.message ?? 'BLE start failed' }));
    }
  }

  async function stop() {
    await presence.stop();
    setState((s) => ({ ...s, active: false }));
  }

  return { ...state, start, stop };
}

// Hook separat pt UI care vrea sa reactioneze la evenimente discrete (toast,
// confetti) — emite o singura data pe completion/failure, nu la fiecare tick.
export function useCoWalkEvents(onEvent: (e: CoWalkEvent) => void) {
  useEffect(() => {
    return presence.subscribeEvents(onEvent);
  }, [onEvent]);
}
