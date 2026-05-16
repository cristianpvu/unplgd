import {
  BleManager,
  ScanMode,
  ScanCallbackType,
  type Device,
  type State,
  type Subscription,
} from 'react-native-ble-plx';
import { Pedometer } from 'expo-sensors';
import type { Socket } from 'socket.io-client';
import { blePresence } from 'ble-presence';
import {
  UNPLGD_PROXIMITY_UUID,
  RSSI_THRESHOLD_DBM,
  STALE_AFTER_MS,
  RESOLVE_INTERVAL_MS,
  HEARTBEAT_INTERVAL_MS,
  TICK_INTERVAL_MS,
} from './constants';
import {
  getMyBleToken,
  resolveBleTokens,
  postPresenceHeartbeat,
  getCurrentCoWalk,
  pauseCoWalk,
  type ServerSession,
} from '../api/ble';
import { getMe } from '../api/me';
import { getSocket } from '../lib/socket';

const REPORT_INTERVAL_MS = 30_000;

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

// Sesiune asa cum o vede UI-ul. Sursa de adevar e backend-ul (prin socket);
// timestamp-urile sunt deja convertite la ceasul local pentru render direct.
export type ClientSession = {
  id: string;
  startedAtClient: number;
  // Pasi facuti de mine de la inceputul sesiunii (myStepCount - startStepCount).
  // Folosit pentru afisare "147 / 200 pasi" in UI; reflecta count-ul local in
  // timp real, nu valoarea sincronizata cu backend (care vine la 30s).
  mySteps: number;
  // Toti membrii (inclusiv eu). Fiecare cu joinedAt convertit la ceasul local.
  members: Array<{
    userId: string;
    name: string;
    level: number;
    joinedAtClient: number;
    awarded: boolean;
    isMe: boolean;
    avatarSvg: string | null;
    petImageUrl: string | null;
  }>;
};

export type CoWalkEvent =
  | {
      type: 'completed';
      userId: string;
      name: string;
      durationSec: number;
      squadSize: number;
      isMe: boolean;
    }
  | {
      type: 'failed';
      reason: 'steps' | 'rssi_static' | 'rssi_samples';
      steps: number;
      stepsRequired: number;
    };

export type PresenceSnapshot = {
  peers: Peer[];
  myUserId: string | null;
  myToken: string | null;
  sessions: ClientSession[];
  paused: boolean;
  pausedAt: number | null;
  advertiseFailed: boolean;
  advertiseLastError: string | null;
  bleState: string;
  socketConnected: boolean;
  scanCounters: {
    devicesSeen: number;
    withServiceUuid: number;
    tokenExtracted: number;
  };
};

type StateListener = (state: PresenceSnapshot) => void;
type EventListener = (e: CoWalkEvent) => void;

// Decodeaza ASCII text dintr-un buffer base64. Token-ul e 8 chars hex ASCII.
function base64AsciiDecode(b64: string): string | null {
  try {
    return globalThis.atob(b64);
  } catch {
    return null;
  }
}

function isValidToken(s: string | null | undefined): s is string {
  return !!s && /^[0-9a-fA-F]{8}$/.test(s);
}

// State server-side per sesiune, cum il tinem local. RSSI samples si
// startStepCount sunt acumulatori pentru `cowalk:report` periodic.
type ServerSideSession = {
  id: string;
  startedAt: number;
  serverClockOffset: number;
  members: Map<
    string,
    {
      userId: string;
      name: string;
      level: number;
      joinedAt: number;
      awarded: boolean;
      avatarSvg: string | null;
      petImageUrl: string | null;
    }
  >;
  startStepCount: number;
  rssiBufferUnreported: number[];
};

class PresenceEngine {
  private manager: BleManager | null = null;
  private myToken: string | null = null;
  private myUserId: string | null = null;
  private peers = new Map<string, Peer>();
  private serverSessions = new Map<string, ServerSideSession>();
  private stateListeners = new Set<StateListener>();
  private eventListeners = new Set<EventListener>();
  private running = false;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private resolveTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reportTimer: ReturnType<typeof setInterval> | null = null;
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
  private socket: Socket | null = null;
  private socketHandlersAttached = false;
  private scanOnlyMode = false;
  // Pauza manuala: scan/advertise raman pornite (peer-ii vizibili in UI nearby),
  // dar nu raportam mutual visibility la backend (heartbeat trimite lista goala)
  // si curatam local sesiunile. Pe resume backend-ul reia sesiunea cu progres
  // pastrat daca ghostul nu a expirat (3 min singular / 5 min cumulat).
  private paused = false;
  // Timestamp local cand a inceput pauza curenta — UI-ul afiseaza un countdown
  // pana la expirare. Null cand nu suntem pe pauza.
  private pausedAt: number | null = null;

  isRunning() {
    return this.running;
  }

  isPaused() {
    return this.paused;
  }

  getBleState() {
    return this.bleState;
  }

  // Marcheaza local un peer ca prieten — folosit dupa ce user-ul apasa
  // "Adauga" in UI. resolveUnknownTokens NU re-rezolva peer-i care au deja
  // userId, deci fara asta peer-ul ar ramane isFriend=false pana la stop/start
  // si n-ar intra in heartbeat-ul de presence (deci si in co-walk).
  markPeerAsFriend(userId: string) {
    let changed = false;
    for (const peer of this.peers.values()) {
      if (peer.userId === userId && !peer.isFriend) {
        peer.isFriend = true;
        changed = true;
      }
    }
    if (changed) {
      // Trimitem un heartbeat imediat ca backend-ul sa-l includa in
      // mutual visibility ASAP (altfel astepti pana la 25s pana la urmatorul).
      void this.sendHeartbeat();
      this.emit();
    }
  }

  // Pune sesiunea pe pauza fara s-o distruga server-side. Apel /cowalk/pause
  // → backend muta user-ul in pausedParticipants (pastreaza joinedAt, steps,
  // RSSI), emite cowalk:left la peer-i. Cat e paused, heartbeat-ul nu raporteaza
  // mutual visibility → backend nu re-creeaza sesiunea pana la resume.
  // Reluarea reia de unde a ramas daca pauza singulara < 3min si total < 5min.
  async pause() {
    if (this.paused) return;
    this.paused = true;
    this.pausedAt = Date.now();
    this.serverSessions.clear();
    this.emit();
    try {
      await pauseCoWalk();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[presence] pause failed:', e);
    }
  }

  // Iesim din pauza: urmatorul heartbeat raporteaza peer-ii vazuti si backend-ul
  // re-introduce user-ul in sesiune (continua progresul daca ghostul nu a expirat,
  // altfel handshake nou). Trimitem imediat un heartbeat ca sa nu astepte 25s.
  async resume() {
    if (!this.paused) return;
    this.paused = false;
    this.pausedAt = null;
    this.emit();
    void this.sendHeartbeat();
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

  // mode='full': advertise + scan + heartbeat + cowalk events. Default cand
  // co-walk-ul e ENABLED in preferinte (porneste din _layout.tsx).
  // mode='scan-only': doar scan + resolve, NU advertise si NU heartbeat. Folosit
  // de add-friend cand user-ul are co-walk-ul OFF — vrea sa caute prieteni
  // dar nu vrea sa fie vizibil pentru altii si nu vrea sa intre in sesiuni
  // co-walk fara sa-si dea seama. Daca am pornit advertise + heartbeat in
  // background-ul ecranului de "Adauga prieten", iPhone-ul aparea pe Android-ul
  // unui prieten si backend-ul cream sesiune fantoma chiar daca user-ul iPhone
  // se vedea ca "invizibil".
  async start(opts?: { mode?: 'full' | 'scan-only' }) {
    if (this.running) return;
    const mode = opts?.mode ?? 'full';
    this.scanOnlyMode = mode === 'scan-only';

    const manager = this.getManager();

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

    // Aflam propriul userId — folosit ca sa filtram event-urile cowalk:completed
    // (sa stim daca XP-ul a venit la noi sau la alt membru).
    try {
      const me = await getMe();
      this.myUserId = me.id;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[presence] getMe failed:', e);
    }

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
    // Skip in scan-only — user-ul a optat "invizibil" deci NU emitem.
    this.advertiseFailed = false;
    this.advertiseLastError = null;
    if (!this.scanOnlyMode) {
      try {
        await blePresence.startAdvertising(UNPLGD_PROXIMITY_UUID, token);
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
    }

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

    // Conectam socket-ul + subscriem la event-urile co-walk DOAR in mod full.
    // Scan-only nu participa la co-walk; nu vrem sa primim cowalk:* events si
    // sa apara sesiuni in UI cand user-ul a optat sa fie invizibil.
    if (!this.scanOnlyMode) {
      try {
        await this.connectSocketAndSubscribe();
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.warn('[presence] socket connect failed:', e?.message ?? e);
      }
    }

    this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
    this.resolveTimer = setInterval(() => void this.resolveUnknownTokens(), RESOLVE_INTERVAL_MS);
    if (!this.scanOnlyMode) {
      this.heartbeatTimer = setInterval(() => void this.sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
      this.reportTimer = setInterval(() => void this.sendCoWalkReports(), REPORT_INTERVAL_MS);
      void this.sendHeartbeat();
    }
    this.running = true;
    this.emit();
  }

  async stop() {
    this.running = false;
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.resolveTimer) clearInterval(this.resolveTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.reportTimer) clearInterval(this.reportTimer);
    this.tickTimer = null;
    this.resolveTimer = null;
    this.heartbeatTimer = null;
    this.reportTimer = null;
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
    this.detachSocketHandlers();
    this.pedometerAvailable = false;
    this.myStepCount = 0;
    this.advertiseFailed = false;
    this.scanDevicesSeen = 0;
    this.scanWithServiceUuid = 0;
    this.scanTokenExtracted = 0;
    this.peers.clear();
    this.serverSessions.clear();
    this.myToken = null;
    this.scanOnlyMode = false;
    this.paused = false;
    this.pausedAt = null;
    this.emit();
  }

  private async connectSocketAndSubscribe() {
    const s = await getSocket();
    this.socket = s;
    if (this.socketHandlersAttached) return;
    this.socketHandlersAttached = true;

    s.on('cowalk:started', (p: any) => this.onStarted(p));
    s.on('cowalk:joined', (p: any) => this.onJoined(p));
    s.on('cowalk:left', (p: any) => this.onLeft(p));
    s.on('cowalk:ended', (p: any) => this.onEnded(p));
    s.on('cowalk:completed', (p: any) => this.onCompleted(p));
    s.on('cowalk:failed', (p: any) => this.onFailed(p));

    // La fiecare connect (initial sau reconnect), re-sincronizam state-ul
    // server-driven. Daca am pierdut event-uri cat am fost offline, acum le
    // recuperam din /presence/cowalk/current.
    s.on('connect', () => {
      void this.refetchCurrentSession();
      this.emit();
    });
    s.on('disconnect', () => this.emit());

    if (s.connected) {
      await this.refetchCurrentSession();
    }
  }

  private detachSocketHandlers() {
    if (!this.socket || !this.socketHandlersAttached) return;
    this.socket.off('cowalk:started');
    this.socket.off('cowalk:joined');
    this.socket.off('cowalk:left');
    this.socket.off('cowalk:ended');
    this.socket.off('cowalk:completed');
    this.socket.off('cowalk:failed');
    this.socket.off('connect');
    this.socket.off('disconnect');
    this.socketHandlersAttached = false;
  }

  private async refetchCurrentSession() {
    try {
      const { serverNow, session } = await getCurrentCoWalk();
      const offset = Date.now() - serverNow;
      if (!session) {
        this.serverSessions.clear();
      } else {
        this.applyServerSession(session, offset);
        // Daca nu mai avem alte sesiuni, le ignoram (model curent: max 1 sesiune
        // per user pe backend).
        for (const id of [...this.serverSessions.keys()]) {
          if (id !== session.id) this.serverSessions.delete(id);
        }
      }
      this.emit();
    } catch (e) {
      // best-effort
    }
  }

  // Aplica un snapshot complet de sesiune server-side (start/refetch).
  private applyServerSession(s: ServerSession, offset: number) {
    const existing = this.serverSessions.get(s.id);
    const startStepCount = existing?.startStepCount ?? this.myStepCount;
    const rssiBufferUnreported = existing?.rssiBufferUnreported ?? [];
    const members: ServerSideSession['members'] = new Map();
    for (const p of s.participants) {
      members.set(p.userId, {
        userId: p.userId,
        name: p.name,
        level: p.level,
        joinedAt: p.joinedAt,
        awarded: p.awarded,
        avatarSvg: p.avatarSvg,
        petImageUrl: p.pet?.imageUrl ?? null,
      });
    }
    this.serverSessions.set(s.id, {
      id: s.id,
      startedAt: s.startedAt,
      serverClockOffset: offset,
      members,
      startStepCount,
      rssiBufferUnreported,
    });
  }

  private onStarted(p: {
    sessionId: string;
    startedAt: number;
    serverNow: number;
    participants: ServerSession['participants'];
  }) {
    const offset = Date.now() - p.serverNow;
    const members: ServerSideSession['members'] = new Map();
    for (const m of p.participants) {
      members.set(m.userId, {
        userId: m.userId,
        name: m.name,
        level: m.level,
        joinedAt: m.joinedAt,
        awarded: false,
        avatarSvg: m.avatarSvg,
        petImageUrl: m.pet?.imageUrl ?? null,
      });
    }
    this.serverSessions.set(p.sessionId, {
      id: p.sessionId,
      startedAt: p.startedAt,
      serverClockOffset: offset,
      members,
      startStepCount: this.myStepCount,
      rssiBufferUnreported: [],
    });
    this.emit();
  }

  private onJoined(p: {
    sessionId: string;
    serverNow: number;
    participant: ServerSession['participants'][number];
    participants: ServerSession['participants'];
  }) {
    let session = this.serverSessions.get(p.sessionId);
    const offset = Date.now() - p.serverNow;
    if (!session) {
      // Eu sunt cel care intra in session-ul altora — initializam ca un started.
      this.onStarted({
        sessionId: p.sessionId,
        startedAt: p.participants[0]?.joinedAt ?? Date.now(),
        serverNow: p.serverNow,
        participants: p.participants,
      });
      return;
    }
    session.serverClockOffset = offset;
    for (const m of p.participants) {
      const existing = session.members.get(m.userId);
      session.members.set(m.userId, {
        userId: m.userId,
        name: m.name,
        level: m.level,
        joinedAt: m.joinedAt,
        awarded: existing?.awarded ?? false,
        avatarSvg: m.avatarSvg,
        petImageUrl: m.pet?.imageUrl ?? null,
      });
    }
    this.emit();
  }

  private onLeft(p: {
    sessionId: string;
    userId: string;
    remaining: ServerSession['participants'];
  }) {
    const session = this.serverSessions.get(p.sessionId);
    if (!session) return;
    if (this.myUserId && p.userId === this.myUserId) {
      // Eu am iesit din sesiune (timeout BLE / app suspendat) → curat local.
      this.serverSessions.delete(p.sessionId);
      this.emit();
      return;
    }
    session.members.delete(p.userId);
    // Scoate peer-ul si din BLE local cache. Altfel ramane in `peers` pana
    // la STALE_AFTER_MS si heartbeat-urile noastre ar continua sa-l raporteze
    // ca prieten vazut → backend l-ar prinde intr-o sesiune noua daca celalalt
    // user inca il vede pe noi (race window 90s din TTL presence:seen).
    this.dropPeerByUserId(p.userId);
    this.emit();
  }

  private onEnded(p: { sessionId: string }) {
    this.serverSessions.delete(p.sessionId);
    this.emit();
  }

  private dropPeerByUserId(userId: string) {
    for (const [token, peer] of this.peers) {
      if (peer.userId === userId) this.peers.delete(token);
    }
  }

  // Backend a stabilit ca am depasit pragul de 10min+grace fara sa indeplinim
  // anti-cheat (pasi/RSSI). Curatam sesiunea local (a venit si un cowalk:left
  // separat, dar evenimentul `failed` ne lasa sa emitem alerta cu motivul).
  private onFailed(p: {
    sessionId: string;
    userId: string;
    reason: 'steps' | 'rssi_static' | 'rssi_samples';
    steps: number;
    stepsRequired: number;
    rssiSamples: number;
    rssiStdDev: number;
  }) {
    // Backend trimite cowalk:failed numai catre user-ul afectat, dar verificam
    // suplimentar (defense in depth).
    if (!this.myUserId || p.userId !== this.myUserId) return;
    this.serverSessions.delete(p.sessionId);
    this.fireEvent({
      type: 'failed',
      reason: p.reason,
      steps: p.steps,
      stepsRequired: p.stepsRequired,
    });
    this.emit();
  }

  private onCompleted(p: {
    sessionId: string;
    userId: string;
    durationSec: number;
    squadSize: number;
  }) {
    const session = this.serverSessions.get(p.sessionId);
    if (session) {
      const m = session.members.get(p.userId);
      if (m) m.awarded = true;
    }
    const isMe = !!this.myUserId && p.userId === this.myUserId;
    const name = session?.members.get(p.userId)?.name ?? 'Prieten';
    this.fireEvent({
      type: 'completed',
      userId: p.userId,
      name,
      durationSec: p.durationSec,
      squadSize: p.squadSize,
      isMe,
    });
    this.emit();
  }

  private async sendCoWalkReports() {
    const s = this.socket;
    if (!s || !s.connected) return;
    for (const session of this.serverSessions.values()) {
      const stepsTotal = Math.max(0, this.myStepCount - session.startStepCount);
      const samples = session.rssiBufferUnreported.slice();
      session.rssiBufferUnreported = [];
      // emit fire-and-forget; ack-ul nu blocheaza nimic.
      s.emit('cowalk:report', {
        sessionId: session.id,
        steps: stepsTotal,
        rssiSamples: samples,
      });
    }
  }

  // Scan callback: peer Unplgd vazut. Token-ul vine fie in localName (iOS-emis)
  // fie in serviceData[SERVICE_UUID] (Android-emis).
  private handleDevice(device: Device) {
    this.scanDevicesSeen++;
    const rssi = device.rssi;
    if (rssi == null) return;
    if (rssi < RSSI_THRESHOLD_DBM) return;
    this.scanWithServiceUuid++;

    let token: string | null = null;

    if (isValidToken(device.localName)) {
      token = device.localName.toLowerCase();
    }
    if (!token && device.serviceData) {
      const lowerUuid = UNPLGD_PROXIMITY_UUID.toLowerCase();
      const b64 = device.serviceData[lowerUuid] ?? device.serviceData[UNPLGD_PROXIMITY_UUID];
      if (b64) {
        const ascii = base64AsciiDecode(b64);
        if (isValidToken(ascii)) token = ascii.toLowerCase();
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
      this.collectRssiForSessions(existing.userId, rssi);
    } else {
      this.peers.set(token, {
        token,
        rssi,
        firstSeenAt: now,
        lastSeenAt: now,
      });
    }
  }

  // Daca peer-ul e in vreuna din sesiunile mele, acumulez RSSI in buffer-ul
  // de raportat. Backend-ul foloseste stddev-ul ca anti-cheat — semnal ca
  // exista miscare relativa intre telefoane.
  private collectRssiForSessions(userId: string | undefined, rssi: number) {
    if (!userId) return;
    for (const session of this.serverSessions.values()) {
      if (session.members.has(userId)) {
        session.rssiBufferUnreported.push(rssi);
      }
    }
  }

  private tick() {
    const now = Date.now();
    for (const [token, peer] of this.peers) {
      if (now - peer.lastSeenAt > STALE_AFTER_MS) {
        this.peers.delete(token);
      }
    }
    this.emit();
  }

  // Trimite la backend lista prietenilor pe care ii vedem ACUM. Backend-ul
  // foloseste asta pentru: (1) mutual visibility la commit co-walk; (2)
  // tick-ul de session co-walk care creeaza/extinde sesiunile prin socket.
  private async sendHeartbeat() {
    // Cand sesiunea e pe pauza manuala, raportam ca nu vedem pe nimeni.
    // Asa mutual visibility cade pe backend si nu se recreeaza sesiunea
    // pana cand user-ul apasa "Reia".
    const peerIds: string[] = [];
    if (!this.paused) {
      for (const peer of this.peers.values()) {
        if (peer.userId && peer.isFriend) peerIds.push(peer.userId);
      }
    }
    try {
      await postPresenceHeartbeat(peerIds);
    } catch {
      // network jitter / token expirat / backend down — ignoram
    }
    // Daca socket-ul nu e conectat (initial connect a esuat sau reconnect-ul
    // automat al socket.io n-a reusit inca), incercam aici. La urmatorul
    // succes ne reatasam ascultatorii si re-fetch-uim sesiunea curenta.
    if (!this.socket?.connected) {
      void this.connectSocketAndSubscribe().catch(() => {});
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

  private buildClientSessions(): ClientSession[] {
    const out: ClientSession[] = [];
    for (const s of this.serverSessions.values()) {
      const startedAtClient = s.startedAt + s.serverClockOffset;
      const members = [...s.members.values()].map((m) => ({
        userId: m.userId,
        name: m.name,
        level: m.level,
        joinedAtClient: m.joinedAt + s.serverClockOffset,
        awarded: m.awarded,
        isMe: !!this.myUserId && m.userId === this.myUserId,
        avatarSvg: m.avatarSvg,
        petImageUrl: m.petImageUrl,
      }));
      // Sortam: eu primul, apoi dupa joinedAt ascendent ca participantii noi
      // sa apara mai jos in lista.
      members.sort((a, b) => {
        if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
        return a.joinedAtClient - b.joinedAtClient;
      });
      const mySteps = Math.max(0, this.myStepCount - s.startStepCount);
      out.push({ id: s.id, startedAtClient, mySteps, members });
    }
    return out.sort((a, b) => a.startedAtClient - b.startedAtClient);
  }

  private snapshot(): PresenceSnapshot {
    return {
      peers: [...this.peers.values()].sort((a, b) => a.firstSeenAt - b.firstSeenAt),
      myUserId: this.myUserId,
      myToken: this.myToken,
      sessions: this.buildClientSessions(),
      paused: this.paused,
      pausedAt: this.pausedAt,
      advertiseFailed: this.advertiseFailed,
      advertiseLastError: this.advertiseLastError,
      bleState: this.bleState,
      socketConnected: !!this.socket?.connected,
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
