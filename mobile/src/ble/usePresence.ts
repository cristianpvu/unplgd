import { useEffect, useState } from 'react';
import {
  presence,
  type Peer,
  type ClientSession,
  type CoWalkEvent,
} from './presence';
import { requestBlePermissions, type BlePermissionResult } from './permissions';

export type PresenceState = {
  active: boolean;
  permission: BlePermissionResult | 'unknown';
  myUserId: string | null;
  myToken: string | null;
  peers: Peer[];
  sessions: ClientSession[];
  error: string | null;
  // Advertising-ul (CBPeripheralManager pe iOS, BluetoothLeAdvertiser pe
  // Android) poate sa pice independent de scan: BT off, permisiune refuzata,
  // pachet prea mare. Scan-ul continua, dar user-ul e invizibil pt ceilalti
  // pana se reactiveaza.
  advertiseFailed: boolean;
  socketConnected: boolean;
};

export function usePresence() {
  const [state, setState] = useState<PresenceState>({
    active: presence.isRunning(),
    permission: 'unknown',
    myUserId: null,
    myToken: null,
    peers: [],
    sessions: [],
    error: null,
    advertiseFailed: false,
    socketConnected: false,
  });

  useEffect(() => {
    const unsub = presence.subscribe((snap) => {
      setState((s) => ({
        ...s,
        peers: snap.peers,
        myUserId: snap.myUserId,
        myToken: snap.myToken,
        sessions: snap.sessions,
        active: presence.isRunning(),
        advertiseFailed: snap.advertiseFailed,
        socketConnected: snap.socketConnected,
      }));
    });
    return unsub;
  }, []);

  async function start() {
    setState((s) => ({ ...s, error: null }));
    const perm = await requestBlePermissions();
    setState((s) => ({ ...s, permission: perm }));
    if (perm !== 'granted') {
      setState((s) => ({ ...s, error: `Permisiuni refuzate: ${perm}. Activeaza Locatie + Bluetooth in Setari.` }));
      return;
    }
    try {
      await presence.start();
      setState((s) => ({ ...s, active: true }));
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn('[usePresence] presence.start failed:', e);
      setState((s) => ({
        ...s,
        error: e?.message ? `BLE start: ${e.message}` : 'BLE start failed (vezi Metro logs)',
      }));
    }
  }

  async function stop() {
    await presence.stop();
    setState((s) => ({ ...s, active: false }));
  }

  return { ...state, start, stop };
}

// Hook separat pt UI care vrea sa reactioneze la evenimente discrete (toast,
// confetti) — emite o singura data pe completion (event-ul vine direct din
// socket-ul backend-ului).
export function useCoWalkEvents(onEvent: (e: CoWalkEvent) => void) {
  useEffect(() => {
    return presence.subscribeEvents(onEvent);
  }, [onEvent]);
}
