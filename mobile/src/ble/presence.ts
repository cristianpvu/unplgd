import AsyncStorage from '@react-native-async-storage/async-storage';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BleAdvertise: any = require('react-native-ble-advertise').default;
import Beacon, { type Beacon as DetectedBeacon } from 'react-native-beacon-kit';
import { Pedometer } from 'expo-sensors';
import {
  UNPLGD_PROXIMITY_UUID,
  UNPLGD_REGION_IDENTIFIER,
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
  // Snapshot al contorului de pasi cumulativ la deschiderea sesiunii. La commit
  // calculam delta vs contorul curent ca dovada ca userul nostru s-a miscat.
  startStepCount: number;
  // Ring-buffer cu samples RSSI pe durata sesiunii. La commit calculam stddev:
  // o valoare prea plata indica telefoane stationare lipite (ex. lasate pe masa).
  rssiSamples: number[];
};

export type CoWalkEvent =
  | { type: 'completed'; userId: string; name: string; durationSec: number; result: CoWalkResult }
  | { type: 'failed'; userId: string; name: string; durationSec: number; error: string };

export type PresenceSnapshot = {
  peers: Peer[];
  myToken: string | null;
  sessions: CoWalkSession[];
};

type StateListener = (state: PresenceSnapshot) => void;
type EventListener = (e: CoWalkEvent) => void;

function dayKeyUTC(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}
const committedKey = (day: string, userId: string) => `cowalk:committed:${day}:${userId}`;

// Token = 4 bytes hex (8 chars). Encode in major (top 2B) + minor (bottom 2B)
// pentru iBeacon advertising. Ambele iOS si Android scaneaza nativ formatul.
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

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

class PresenceEngine {
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
  private rangedSub: { remove: () => void } | null = null;
  private pedometerSub: { remove: () => void } | null = null;
  private pedometerAvailable = false;
  // Cumulativ de la subscribe-ul curent; sesiunile snapshoot-uiesc la creare
  // si calculeaza delta la commit.
  private myStepCount = 0;

  isRunning() {
    return this.running;
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
    this.running = true;

    await this.loadCommittedToday();

    // Pedometer porneste inainte de scan pentru ca prima sesiune sa aiba un
    // startStepCount sincronizat. Daca device-ul nu suporta (simulator, Android
    // sub 4.4), engine-ul scaneaza dar nu valideaza co-walks — emit failed la commit.
    this.pedometerAvailable = await Pedometer.isAvailableAsync().catch(() => false);
    this.myStepCount = 0;
    if (this.pedometerAvailable) {
      this.pedometerSub = Pedometer.watchStepCount((result) => {
        this.myStepCount = result.steps;
      });
    }

    const { token } = await getMyBleToken();
    this.myToken = token;
    const { major, minor } = tokenToMajorMinor(token);

    // Advertise iBeacon. Pe iOS company ID-ul e fortat la Apple; pe Android
    // setCompanyId nu e relevant pt formatul iBeacon (header standardizat).
    BleAdvertise.setCompanyId(0x004c);
    await BleAdvertise.broadcast(UNPLGD_PROXIMITY_UUID, major, minor);

    // Foreground service e gestionat de beacon-kit cat scanul ruleaza:
    // notification persistenta pe Android, plus PARTIAL_WAKE_LOCK pe device-uri
    // OEM agresive.
    Beacon.configure({
      scanPeriod: 1100,
      betweenScanPeriod: 0,
      foregroundService: true,
      foregroundServiceNotification: {
        title: 'Unplgd cauta prieteni in apropiere',
        text: 'Atinge ca sa deschizi sau opresti scanarea.',
      },
    });

    this.rangedSub = Beacon.onBeaconsRanged((event) => {
      const now = Date.now();
      for (const b of event.beacons) {
        this.handleBeacon(b, now);
      }
    });

    await Beacon.startRanging({
      identifier: UNPLGD_REGION_IDENTIFIER,
      uuid: UNPLGD_PROXIMITY_UUID,
    });

    this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
    this.resolveTimer = setInterval(() => void this.resolveUnknownTokens(), RESOLVE_INTERVAL_MS);
    this.emit();
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.resolveTimer) clearInterval(this.resolveTimer);
    this.tickTimer = null;
    this.resolveTimer = null;
    if (this.rangedSub) {
      this.rangedSub.remove();
      this.rangedSub = null;
    }
    try {
      await Beacon.stopRanging({
        identifier: UNPLGD_REGION_IDENTIFIER,
        uuid: UNPLGD_PROXIMITY_UUID,
      });
    } catch {}
    try {
      await BleAdvertise.stopBroadcast();
    } catch {}
    if (this.pedometerSub) {
      this.pedometerSub.remove();
      this.pedometerSub = null;
    }
    this.pedometerAvailable = false;
    this.myStepCount = 0;
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

  private handleBeacon(b: DetectedBeacon, now: number) {
    if (b.rssi < RSSI_THRESHOLD_DBM) return;
    const token = majorMinorToToken(b.major, b.minor);
    if (this.myToken && token === this.myToken) return;

    const existing = this.peers.get(token);
    if (existing) {
      existing.rssi = b.rssi;
      existing.lastSeenAt = now;
    } else {
      this.peers.set(token, {
        token,
        rssi: b.rssi,
        firstSeenAt: now,
        lastSeenAt: now,
      });
    }
  }

  private tick() {
    const now = Date.now();

    // Day rollover — reseteaza sesiunile si reincarca dedup-ul.
    const today = dayKeyUTC();
    if (today !== this.currentDay) {
      this.sessions.clear();
      void this.loadCommittedToday();
    }

    // Push state-ul peer-ilor in sesiuni: doar prieteni acceptati, neasignati azi.
    for (const peer of this.peers.values()) {
      if (!peer.userId || !peer.name || !peer.isFriend) continue;
      if (this.committedToday.has(peer.userId)) continue;
      const existing = this.sessions.get(peer.userId);
      if (existing) {
        if (peer.lastSeenAt > existing.lastSeenAt) {
          existing.lastSeenAt = peer.lastSeenAt;
          // Esantion RSSI per tick (1Hz). Daca peer-ul a re-aparut dupa un gap
          // <RESUME, acelasi peer object e reconstruit cu rssi proaspat — sample-ul
          // reflecta acel moment. Cap-ul previne crestere nelimitata pe sesiuni lungi.
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

    // Sterge sesiunile cu gap mai mare ca pragul; commit cele care au prins 10 min.
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

    // Stale-uirea peer-ilor (UI) e separata de sesiuni: peer dispare din lista
    // dupa 30s, dar sesiunea ramane vie pana la COWALK_RESUME_GAP_MS.
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

    // Squad auto-detect: alti prieteni vazuti in aceeasi fereastra cu durata
    // sustinuta (>= MIN_DURATION) si inca recent prezenti (in RESUME_GAP). Sesiunile
    // committed raman in map cat peer-ul e activ — astfel se prind si membrii care
    // au atins pragul mai devreme. Backend-ul valideaza ca toti sunt prieteni reali
    // si calculeaza multiplier-ul (1x/1.5x/2x).
    const squadFriendIds: string[] = [];
    for (const [otherId, other] of this.sessions) {
      if (otherId === s.userId) continue;
      const otherDuration = other.lastSeenAt - other.startedAt;
      const recent = now - other.lastSeenAt <= COWALK_RESUME_GAP_MS;
      if (recent && otherDuration >= COWALK_MIN_DURATION_MS) {
        squadFriendIds.push(otherId);
      }
    }

    // Anti-cheat local: dropam sesiunea inainte sa lovim backend-ul daca semnalele
    // de miscare sunt slabe. Backend-ul aplica acelasi check (defense in depth) —
    // local-ul economiseste un round-trip si ofera feedback UX imediat.
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
      // Pe esec: scoatem sesiunea sa nu loop-uim. Daca peer-ul ramane in raza,
      // urmatorul tick recreeaza sesiunea cu startedAt nou.
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
