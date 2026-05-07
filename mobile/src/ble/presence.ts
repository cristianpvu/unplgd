import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BleAdvertise: any = require('react-native-ble-advertise').default;
import { BleManager, type Device, type State, type Subscription } from 'react-native-ble-plx';
import { iosBeaconScanner } from './iosBeaconScanner';
import { Pedometer } from 'expo-sensors';
import { Buffer } from 'buffer';
import {
  UNPLGD_PROXIMITY_UUID,
  RSSI_THRESHOLD_DBM,
  STALE_AFTER_MS,
  RESOLVE_INTERVAL_MS,
  TICK_INTERVAL_MS,
  COWALK_MIN_DURATION_MS,
  COWALK_RESUME_GAP_MS,
  COWALK_MIN_STEPS,
  COWALK_MIN_RSSI_STDDEV_DBM,
  COWALK_MIN_RSSI_SAMPLES,
  RSSI_SAMPLES_CAP,
} from './constants';
import { getMyBleToken, resolveBleTokens, postCoWalk, type CoWalkResult } from '../api/ble';

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
  // Pe iOS advertising-ul iBeacon poate sa pice (BT off, permisiune refuzata,
  // race CBPeripheralManager). Scan-ul continua, dar UI-ul anunta user-ul.
  advertiseFailed: boolean;
  bleState: string;
};

type StateListener = (state: PresenceSnapshot) => void;
type EventListener = (e: CoWalkEvent) => void;

function dayKeyUTC(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}
const committedKey = (day: string, userId: string) => `cowalk:committed:${day}:${userId}`;

function tokenToMajorMinor(tokenHex: string): { major: number; minor: number } {
  if (!/^[0-9a-fA-F]{8}$/.test(tokenHex)) {
    throw new Error(`Token BLE invalid (asteptat 8 hex chars, primit ${tokenHex.length})`);
  }
  const major = parseInt(tokenHex.slice(0, 4), 16);
  const minor = parseInt(tokenHex.slice(4, 8), 16);
  return { major, minor };
}

function majorMinorToToken(major: number, minor: number): string {
  const m = (major & 0xffff).toString(16).padStart(4, '0');
  const n = (minor & 0xffff).toString(16).padStart(4, '0');
  return `${m}${n}`;
}

// Parseaza un manufacturerData base64 ca iBeacon. Format standard:
// bytes 0..1: company ID (Apple = 0x004c, little-endian → "4c 00")
// byte  2:    type (0x02 pt iBeacon)
// byte  3:    length (0x15)
// bytes 4..19: proximity UUID (16 bytes, big-endian)
// bytes 20..21: major (big-endian)
// bytes 22..23: minor (big-endian)
// byte  24:   txPower (signed)
function parseIBeacon(
  manufacturerDataB64: string,
): { uuid: string; major: number; minor: number } | null {
  let buf: Buffer;
  try {
    buf = Buffer.from(manufacturerDataB64, 'base64');
  } catch {
    return null;
  }
  if (buf.length < 25) return null;
  // Apple company ID
  if (buf[0] !== 0x4c || buf[1] !== 0x00) return null;
  // iBeacon header
  if (buf[2] !== 0x02 || buf[3] !== 0x15) return null;
  const uuidBytes = buf.subarray(4, 20).toString('hex');
  const uuid = `${uuidBytes.substring(0, 8)}-${uuidBytes.substring(8, 12)}-${uuidBytes.substring(
    12,
    16,
  )}-${uuidBytes.substring(16, 20)}-${uuidBytes.substring(20, 32)}`.toUpperCase();
  const major = buf.readUInt16BE(20);
  const minor = buf.readUInt16BE(22);
  return { uuid, major, minor };
}

async function broadcastWithRetry(
  uuid: string,
  major: number,
  minor: number,
): Promise<void> {
  const delaysMs = [0, 300, 600, 1000];
  let lastErr: any = null;
  for (const wait of delaysMs) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try {
      await BleAdvertise.broadcast(uuid, major, minor);
      return;
    } catch (e: any) {
      lastErr = e;
      const code = e?.code ?? e?.message ?? '';
      if (!String(code).includes('BLE_NOT_POWERED_ON')) throw e;
    }
  }
  throw lastErr ?? new Error('Bluetooth nu raspunde. Verifica daca e pornit.');
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
  private pedometerSub: { remove: () => void } | null = null;
  private pedometerAvailable = false;
  private myStepCount = 0;
  private advertiseFailed = false;
  private bleState: State | 'Unknown' = 'Unknown';
  private stateSub: Subscription | null = null;
  // Pe iOS scanam cu CLLocationManager (modul nativ local) — vezi
  // iosBeaconScanner.ts. Pe Android scanam cu ble-plx central mode.
  private iosScannerSub: { remove: () => void } | null = null;

  isRunning() {
    return this.running;
  }

  getBleState() {
    return this.bleState;
  }

  // Lazy singleton — instantiat la primul start. BleManager e greu (deschide
  // CBCentralManager pe iOS); il pastram pe toata viata app-ului dupa creare.
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
    const { major, minor } = tokenToMajorMinor(token);

    BleAdvertise.setCompanyId(0x004c);
    this.advertiseFailed = false;
    try {
      await broadcastWithRetry(UNPLGD_PROXIMITY_UUID, major, minor);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn('[presence] advertise failed, continuing scan-only:', e?.message ?? e);
      this.advertiseFailed = true;
    }

    // Asteapta starea PoweredOn — startDeviceScan / startRanging pe iOS arunca
    // daca radio-ul n-a primit inca didUpdateState. Up la 5s.
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

    if (Platform.OS === 'ios') {
      // iOS: CLLocationManager.startRangingBeacons via modulul nativ local.
      // Apple ascunde iBeacon advertising din scanul generic, dar Core Location
      // Ranging API ni-l da decoded (uuid + major + minor + rssi).
      try {
        await iosBeaconScanner.startRanging(UNPLGD_PROXIMITY_UUID);
        this.iosScannerSub = iosBeaconScanner.onBeaconsRanged((event) => {
          for (const b of event.beacons) {
            this.handleRangedBeacon(b.uuid, b.major, b.minor, b.rssi);
          }
        });
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.warn('[presence] iosBeaconScanner.startRanging failed:', e);
        this.pedometerSub?.remove();
        this.pedometerSub = null;
        try {
          await BleAdvertise.stopBroadcast();
        } catch {}
        throw new Error(`Scanare iBeacon iOS: ${e?.message ?? e}`);
      }
    } else {
      // Android: ble-plx central scan + parsing iBeacon din manufacturerData.
      // allowDuplicates=true ca sa primim updateuri RSSI continue.
      try {
        manager.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
          if (error) {
            // eslint-disable-next-line no-console
            console.warn('[presence] scan error:', error.message ?? error);
            return;
          }
          if (!device) return;
          this.handleDevice(device);
        });
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.warn('[presence] startDeviceScan failed:', e);
        this.pedometerSub?.remove();
        this.pedometerSub = null;
        try {
          await BleAdvertise.stopBroadcast();
        } catch {}
        throw new Error(`Scanare BLE: ${e?.message ?? e}`);
      }
    }

    this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
    this.resolveTimer = setInterval(() => void this.resolveUnknownTokens(), RESOLVE_INTERVAL_MS);
    this.running = true;
    this.emit();
  }

  async stop() {
    this.running = false;
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.resolveTimer) clearInterval(this.resolveTimer);
    this.tickTimer = null;
    this.resolveTimer = null;
    try {
      this.manager?.stopDeviceScan();
    } catch {}
    if (this.iosScannerSub) {
      this.iosScannerSub.remove();
      this.iosScannerSub = null;
    }
    if (Platform.OS === 'ios') {
      try {
        await iosBeaconScanner.stopAll();
      } catch {}
    }
    try {
      await BleAdvertise.stopBroadcast();
    } catch {}
    if (this.pedometerSub) {
      this.pedometerSub.remove();
      this.pedometerSub = null;
    }
    this.pedometerAvailable = false;
    this.myStepCount = 0;
    this.advertiseFailed = false;
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
    } catch {
      // best-effort: backend-ul are oricum unique XpTransaction
    }
  }

  // Path iOS: Core Location ne da deja UUID + major + minor decoded.
  private handleRangedBeacon(uuid: string, major: number, minor: number, rssi: number) {
    // CLBeacon.rssi == 0 inseamna "rssi neraportat" — sarim peste, nu il
    // luam ca semnal real (altfel am polua RSSI samples).
    if (rssi === 0) return;
    if (rssi < RSSI_THRESHOLD_DBM) return;
    if (uuid.toUpperCase() !== UNPLGD_PROXIMITY_UUID.toUpperCase()) return;

    const token = majorMinorToToken(major, minor);
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

  // Path Android: scan-ul ne da raw advertising packet → parsam iBeacon manual.
  private handleDevice(device: Device) {
    const md = device.manufacturerData;
    const rssi = device.rssi;
    if (!md || rssi == null) return;
    if (rssi < RSSI_THRESHOLD_DBM) return;

    const beacon = parseIBeacon(md);
    if (!beacon) return;
    if (beacon.uuid.toUpperCase() !== UNPLGD_PROXIMITY_UUID.toUpperCase()) return;

    const token = majorMinorToToken(beacon.major, beacon.minor);
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
    } catch {
      // network jitter — vom retry la urmatorul interval
    }
  }

  private snapshot(): PresenceSnapshot {
    return {
      peers: [...this.peers.values()].sort((a, b) => a.firstSeenAt - b.firstSeenAt),
      myToken: this.myToken,
      sessions: [...this.sessions.values()].sort((a, b) => a.startedAt - b.startedAt),
      advertiseFailed: this.advertiseFailed,
      bleState: this.bleState,
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
