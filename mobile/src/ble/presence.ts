import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BleManager,
  ScanMode,
  ScanCallbackType,
  type Device,
  type State,
  type Subscription,
} from 'react-native-ble-plx';
import { Pedometer } from 'expo-sensors';
import { blePresence } from 'ble-presence';
import {
  UNPLGD_PROXIMITY_UUID,
  RSSI_THRESHOLD_DBM,
  STALE_AFTER_MS,
  RESOLVE_INTERVAL_MS,
  HEARTBEAT_INTERVAL_MS,
  TICK_INTERVAL_MS,
  COWALK_MIN_DURATION_MS,
  COWALK_RESUME_GAP_MS,
  COWALK_MIN_STEPS,
  COWALK_MIN_RSSI_STDDEV_DBM,
  COWALK_MIN_RSSI_SAMPLES,
  RSSI_SAMPLES_CAP,
} from './constants';
import {
  getMyBleToken,
  resolveBleTokens,
  postCoWalk,
  postPresenceHeartbeat,
  type CoWalkResult,
} from '../api/ble';

export type Peer = {
  token: string;
  userId?: string;
  name?: string;
  level?: number;
  isFriend?: boolean;
  rssi: number;
  firstSeenAt: number;
  lastSeenAt: number;
};

export type CoWalkSession = {
  userId: string;
  name: string;
  startedAt: number;
  lastSeenAt: number;
  committed: boolean;
  startStepCount: number;
  rssiSamples: number[];
};

export type CoWalkEvent =
  | { type: 'completed'; userId: string; name: string; durationSec: number; result: CoWalkResult }
  | { type: 'failed'; userId: string; name: string; durationSec: number; error: string };

export type PresenceSnapshot = {
  peers: Peer[];
  myToken: string | null;
  sessions: CoWalkSession[];
  advertiseFailed: boolean;
  advertiseLastError: string | null;
  bleState: string;
  scanCounters: {
    devicesSeen: number;
    withServiceUuid: number;
    tokenExtracted: number;
  };
};

type StateListener = (state: PresenceSnapshot) => void;
type EventListener = (e: CoWalkEvent) => void;

function dayKeyUTC(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}
const committedKey = (day: string, userId: string) => `cowalk:committed:${day}:${userId}`;

// Decodeaza ASCII text dintr-un buffer base64. ble-plx returneaza serviceData
// ca base64. Token-ul nostru e 8 chars hex ASCII.
function base64AsciiDecode(b64: string): string | null {
  try {
    // RN Hermes are atob; aici e cea mai mica dependinta.
    const bin = globalThis.atob(b64);
    return bin;
  } catch {
    return null;
  }
}

// Token-ul e 8 chars hex (ex "a3f2bc91"). Verificare format pt siguranta —
// un peer corupt sau alt app care emite acelasi service UUID nu trebuie sa ne
// strice peer map-ul.
function isValidToken(s: string | null | undefined): s is string {
  return !!s && /^[0-9a-fA-F]{8}$/.test(s);
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

class PresenceEngine {
  private manager: BleManager | null = null;
  private myToken: string | null = null;
  private peers = new Map<string, Peer>();
  private sessions = new Map<string, CoWalkSession>();
  private committedToday = new Set<string>();
  private currentDay = dayKeyUTC();
  private stateListeners = new Set<StateListener>();
  private eventListeners = new Set<EventListener>();
  private inflightCommits = new Set<string>();
  private running = false;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private resolveTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pedometerSub: { remove: () => void } | null = null;
  private pedometerAvailable = false;
  private myStepCount = 0;
  private advertiseFailed = false;
  private bleState: State | 'Unknown' = 'Unknown';
  private stateSub: Subscription | null = null;
  private advertiseLastError: string | null = null;
  private scanDevicesSeen = 0;
  private scanWithServiceUuid = 0;
  private scanTokenExtracted = 0;

  isRunning() {
    return this.running;
  }

  getBleState() {
    return this.bleState;
  }

  private getManager(): BleManager {
    if (!this.manager) {
      this.manager = new BleManager();
      this.stateSub = this.manager.onStateChange((s) => {
        this.bleState = s;
        this.emit();
      }, true);
    }
    return this.manager;
  }

  subscribe(fn: StateListener): () => void {
    this.stateListeners.add(fn);
    fn(this.snapshot());
    return () => {
      this.stateListeners.delete(fn);
    };
  }

  subscribeEvents(fn: EventListener): () => void {
    this.eventListeners.add(fn);
    return () => {
      this.eventListeners.delete(fn);
    };
  }

  async start() {
    if (this.running) return;

    const manager = this.getManager();

    try {
      await this.loadCommittedToday();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[presence] loadCommittedToday failed:', e);
    }

    this.pedometerAvailable = await Pedometer.isAvailableAsync().catch(() => false);
    this.myStepCount = 0;
    if (this.pedometerAvailable) {
      try {
        this.pedometerSub = Pedometer.watchStepCount((result) => {
          this.myStepCount = result.steps;
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[presence] pedometer watch failed:', e);
      }
    }

    let token: string;
    try {
      const r = await getMyBleToken();
      token = r.token;
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn('[presence] getMyBleToken failed:', e);
      throw new Error(`Nu am primit token de la backend: ${e?.message ?? e}`);
    }
    this.myToken = token;

    // Asteapta starea PoweredOn — startDeviceScan / startAdvertising arunca
    // daca radio-ul n-a primit inca didUpdateState.
    if (this.bleState !== 'PoweredOn') {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 5000);
        const sub = manager.onStateChange((s) => {
          if (s === 'PoweredOn') {
            clearTimeout(timeout);
            sub.remove();
            resolve();
          }
        }, true);
      });
    }

    // Advertise: GATT cu Service UUID + token in localName (iOS) sau
    // serviceData (Android) — uniform via modulul nostru BlePresence.
    this.advertiseFailed = false;
    this.advertiseLastError = null;
    try {
      await blePresence.startAdvertising(UNPLGD_PROXIMITY_UUID, token);
      // Verifica nativ daca chiar advertising-ul a pornit. Pe Android promise-ul
      // se resolve sincron dar onStartFailure poate veni cativa ms mai tarziu.
      setTimeout(() => {
        void blePresence.getState().then((s) => {
          if (!s.isAdvertising) {
            const msg = `state=${s.state} lastError=${s.lastError ?? '?'}`;
            // eslint-disable-next-line no-console
            console.warn(`[presence] advertise NOT running. ${msg}`);
            this.advertiseFailed = true;
            this.advertiseLastError = msg;
            this.emit();
          }
        });
      }, 800);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn('[presence] advertise failed, continuing scan-only:', e?.message ?? e);
      this.advertiseFailed = true;
      this.advertiseLastError = e?.message ?? String(e);
    }

    // Scan: ble-plx pe ambele platforme cu filtru pe Service UUID Unplgd.
    // Asa primim DOAR device-uri Unplgd, fara a scana zgomotul radio.
    try {
      manager.startDeviceScan(
        [UNPLGD_PROXIMITY_UUID],
        {
          allowDuplicates: true,
          scanMode: ScanMode.LowLatency,
          callbackType: ScanCallbackType.AllMatches,
          legacyScan: true,
        },
        (error, device) => {
          if (error) {
            // eslint-disable-next-line no-console
            console.warn('[presence] scan error:', error.message ?? error);
            return;
          }
          if (!device) return;
          this.handleDevice(device);
        },
      );
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn('[presence] startDeviceScan failed:', e);
      this.pedometerSub?.remove();
      this.pedometerSub = null;
      try {
        await blePresence.stopAdvertising();
      } catch {}
      throw new Error(`Scanare BLE: ${e?.message ?? e}`);
    }

    this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
    this.resolveTimer = setInterval(() => void this.resolveUnknownTokens(), RESOLVE_INTERVAL_MS);
    this.heartbeatTimer = setInterval(
      () => void this.sendHeartbeat(),
      HEARTBEAT_INTERVAL_MS,
    );
    // Trimite primul heartbeat imediat (best-effort): cand auto-start ruleaza,
    // user-ul poate fi deja langa un peer si nu vrem sa asteptam 25s pana
    // backend-ul afla.
    void this.sendHeartbeat();
    this.running = true;
    this.emit();
  }

  async stop() {
    this.running = false;
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.resolveTimer) clearInterval(this.resolveTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.tickTimer = null;
    this.resolveTimer = null;
    this.heartbeatTimer = null;
    try {
      this.manager?.stopDeviceScan();
    } catch {}
    try {
      await blePresence.stopAdvertising();
    } catch {}
    if (this.pedometerSub) {
      this.pedometerSub.remove();
      this.pedometerSub = null;
    }
    this.pedometerAvailable = false;
    this.myStepCount = 0;
    this.advertiseFailed = false;
    this.scanDevicesSeen = 0;
    this.scanWithServiceUuid = 0;
    this.scanTokenExtracted = 0;
    this.peers.clear();
    this.sessions.clear();
    this.myToken = null;
    this.emit();
  }

  private async loadCommittedToday() {
    const today = dayKeyUTC();
    this.currentDay = today;
    this.committedToday.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const todayPrefix = `cowalk:committed:${today}:`;
      const staleKeys: string[] = [];
      for (const k of keys) {
        if (k.startsWith(todayPrefix)) {
          this.committedToday.add(k.slice(todayPrefix.length));
        } else if (k.startsWith('cowalk:committed:')) {
          staleKeys.push(k);
        }
      }
      if (staleKeys.length) await AsyncStorage.multiRemove(staleKeys);
    } catch {}
  }

  // Scan callback: peer Unplgd vazut. Token-ul vine fie in localName (iOS-emis)
  // fie in serviceData[SERVICE_UUID] (Android-emis). Incercam ambele path-uri.
  private handleDevice(device: Device) {
    this.scanDevicesSeen++;
    const rssi = device.rssi;
    if (rssi == null) return;
    if (rssi < RSSI_THRESHOLD_DBM) return;
    this.scanWithServiceUuid++;

    let token: string | null = null;

    // Path 1: iOS-emis. CBAdvertisementDataLocalNameKey → device.localName.
    if (isValidToken(device.localName)) {
      token = device.localName.toLowerCase();
    }

    // Path 2: Android-emis. ServiceData[SERVICE_UUID] e bytes ASCII ai token-ului.
    if (!token && device.serviceData) {
      // ble-plx normalizeaza UUID-urile la lowercase 36-char form.
      const lowerUuid = UNPLGD_PROXIMITY_UUID.toLowerCase();
      const b64 = device.serviceData[lowerUuid] ?? device.serviceData[UNPLGD_PROXIMITY_UUID];
      if (b64) {
        const ascii = base64AsciiDecode(b64);
        if (isValidToken(ascii)) {
          token = ascii.toLowerCase();
        }
      }
    }

    if (!token) return;
    this.scanTokenExtracted++;

    if (this.myToken && token === this.myToken) return;

    const now = Date.now();
    const existing = this.peers.get(token);
    if (existing) {
      existing.rssi = rssi;
      existing.lastSeenAt = now;
    } else {
      this.peers.set(token, {
        token,
        rssi,
        firstSeenAt: now,
        lastSeenAt: now,
      });
    }
  }

  private tick() {
    const now = Date.now();

    const today = dayKeyUTC();
    if (today !== this.currentDay) {
      this.sessions.clear();
      void this.loadCommittedToday();
    }

    for (const peer of this.peers.values()) {
      if (!peer.userId || !peer.name || !peer.isFriend) continue;
      if (this.committedToday.has(peer.userId)) continue;
      const existing = this.sessions.get(peer.userId);
      if (existing) {
        if (peer.lastSeenAt > existing.lastSeenAt) {
          existing.lastSeenAt = peer.lastSeenAt;
          existing.rssiSamples.push(peer.rssi);
          if (existing.rssiSamples.length > RSSI_SAMPLES_CAP) existing.rssiSamples.shift();
        }
      } else {
        this.sessions.set(peer.userId, {
          userId: peer.userId,
          name: peer.name,
          startedAt: peer.firstSeenAt,
          lastSeenAt: peer.lastSeenAt,
          committed: false,
          startStepCount: this.myStepCount,
          rssiSamples: [peer.rssi],
        });
      }
    }

    for (const [userId, s] of this.sessions) {
      if (s.committed) continue;
      const gap = now - s.lastSeenAt;
      if (gap > COWALK_RESUME_GAP_MS) {
        this.sessions.delete(userId);
        continue;
      }
      const duration = s.lastSeenAt - s.startedAt;
      if (duration >= COWALK_MIN_DURATION_MS && !this.inflightCommits.has(userId)) {
        this.inflightCommits.add(userId);
        void this.commitCoWalk(s);
      }
    }

    for (const [token, peer] of this.peers) {
      if (now - peer.lastSeenAt > STALE_AFTER_MS) {
        this.peers.delete(token);
      }
    }

    this.emit();
  }

  private async commitCoWalk(s: CoWalkSession) {
    const now = Date.now();
    const startedAtIso = new Date(s.startedAt).toISOString();
    const durationSec = Math.floor((s.lastSeenAt - s.startedAt) / 1000);
    const steps = Math.max(0, this.myStepCount - s.startStepCount);
    const rssiStdDev = stdDev(s.rssiSamples);

    const squadFriendIds: string[] = [];
    for (const [otherId, other] of this.sessions) {
      if (otherId === s.userId) continue;
      const otherDuration = other.lastSeenAt - other.startedAt;
      const recent = now - other.lastSeenAt <= COWALK_RESUME_GAP_MS;
      if (recent && otherDuration >= COWALK_MIN_DURATION_MS) {
        squadFriendIds.push(otherId);
      }
    }

    const reject = (reason: string) => {
      this.sessions.delete(s.userId);
      this.fireEvent({ type: 'failed', userId: s.userId, name: s.name, durationSec, error: reason });
      this.inflightCommits.delete(s.userId);
    };
    if (!this.pedometerAvailable) {
      return reject('Contorul de pasi indisponibil pe acest device');
    }
    if (steps < COWALK_MIN_STEPS) {
      return reject(`Pasi insuficienti (${steps} < ${COWALK_MIN_STEPS})`);
    }
    if (
      s.rssiSamples.length < COWALK_MIN_RSSI_SAMPLES ||
      rssiStdDev < COWALK_MIN_RSSI_STDDEV_DBM
    ) {
      return reject(`Proximitate prea statica (rssi stddev ${rssiStdDev.toFixed(2)} dBm)`);
    }

    try {
      const result = await postCoWalk({
        friendUserId: s.userId,
        durationSec,
        startedAt: startedAtIso,
        stepsMe: steps,
        rssiStdDev: Number(rssiStdDev.toFixed(3)),
        squadFriendIds,
      });
      s.committed = true;
      this.committedToday.add(s.userId);
      try {
        await AsyncStorage.setItem(committedKey(this.currentDay, s.userId), '1');
      } catch {}
      this.fireEvent({
        type: 'completed',
        userId: s.userId,
        name: s.name,
        durationSec,
        result,
      });
      this.emit();
    } catch (e: any) {
      this.sessions.delete(s.userId);
      this.fireEvent({
        type: 'failed',
        userId: s.userId,
        name: s.name,
        durationSec,
        error: e?.message ?? 'co-walk post failed',
      });
    } finally {
      this.inflightCommits.delete(s.userId);
    }
  }

  // Trimite la backend lista prietenilor pe care ii vedem ACUM. Backend-ul
  // foloseste asta pentru mutual visibility check la commit co-walk: respinge
  // co-walk-ul daca peer-ul nu ne-a vazut recent. Best-effort — esecul nu
  // blocheaza nimic local, doar urmatorul heartbeat va incerca din nou.
  private async sendHeartbeat() {
    const peerIds: string[] = [];
    for (const peer of this.peers.values()) {
      if (peer.userId && peer.isFriend) peerIds.push(peer.userId);
    }
    try {
      await postPresenceHeartbeat(peerIds);
    } catch {
      // network jitter / token expirat / backend down — ignoram
    }
  }

  private async resolveUnknownTokens() {
    const unknown: string[] = [];
    for (const peer of this.peers.values()) {
      if (!peer.userId) unknown.push(peer.token);
    }
    if (unknown.length === 0) return;
    try {
      const { resolved } = await resolveBleTokens(unknown);
      for (const r of resolved) {
        const peer = this.peers.get(r.token);
        if (peer) {
          peer.userId = r.userId;
          peer.name = r.name;
          peer.level = r.level;
          peer.isFriend = r.isFriend;
        }
      }
      this.emit();
    } catch {}
  }

  private snapshot(): PresenceSnapshot {
    return {
      peers: [...this.peers.values()].sort((a, b) => a.firstSeenAt - b.firstSeenAt),
      myToken: this.myToken,
      sessions: [...this.sessions.values()].sort((a, b) => a.startedAt - b.startedAt),
      advertiseFailed: this.advertiseFailed,
      advertiseLastError: this.advertiseLastError,
      bleState: this.bleState,
      scanCounters: {
        devicesSeen: this.scanDevicesSeen,
        withServiceUuid: this.scanWithServiceUuid,
        tokenExtracted: this.scanTokenExtracted,
      },
    };
  }

  private emit() {
    const snap = this.snapshot();
    for (const fn of this.stateListeners) fn(snap);
  }

  private fireEvent(e: CoWalkEvent) {
    for (const fn of this.eventListeners) fn(e);
  }
}

export const presence = new PresenceEngine();
