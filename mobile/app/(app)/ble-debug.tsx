import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { presence, type CoWalkSession, type Peer, type PresenceSnapshot } from '../../src/ble/presence';
import { COWALK_MIN_DURATION_MS } from '../../src/ble/constants';
import { colors } from '../../src/theme/colors';

type LogLevel = 'info' | 'ok' | 'warn' | 'err';
type LogEntry = { id: number; ts: number; level: LogLevel; text: string };

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error(`timeout ${ms}ms: ${label}`));
    }, ms);
    p.then(
      (v) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export default function BleDebug() {
  const [active, setActive] = useState(presence.isRunning());
  const [snapshot, setSnapshot] = useState<PresenceSnapshot>({
    peers: [],
    sessions: [],
    myToken: null,
    advertiseFailed: false,
    advertiseLastError: null,
    bleState: 'Unknown',
    scanCounters: {
      devicesSeen: 0,
      withServiceUuid: 0,
      tokenExtracted: 0,
    },
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const logIdRef = useRef(0);

  function log(level: LogLevel, text: string) {
    setLogs((prev) => [
      ...prev,
      { id: ++logIdRef.current, ts: Date.now(), level, text },
    ]);
  }

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const unsub = presence.subscribe((snap) => {
      setSnapshot(snap);
      setActive(presence.isRunning());
    });
    return unsub;
  }, []);

  useEffect(() => {
    const origWarn = console.warn;
    const origErr = console.error;
    console.warn = (...args: unknown[]) => {
      const text = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ');
      if (text.includes('[presence]') || text.includes('[ble') || text.includes('BLE')) {
        setLogs((prev) => [
          ...prev,
          { id: ++logIdRef.current, ts: Date.now(), level: 'warn', text: `console.warn: ${text}` },
        ]);
      }
      origWarn(...(args as []));
    };
    console.error = (...args: unknown[]) => {
      const text = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ');
      setLogs((prev) => [
        ...prev,
        { id: ++logIdRef.current, ts: Date.now(), level: 'err', text: `console.error: ${text}` },
      ]);
      origErr(...(args as []));
    };
    return () => {
      console.warn = origWarn;
      console.error = origErr;
    };
  }, []);

  async function handleStart() {
    log('info', '=== PRESSED Porneste ===');
    if (busy) {
      log('warn', 'Ignor — start deja in derulare');
      return;
    }
    if (presence.isRunning()) {
      log('warn', 'Engine ruleaza deja');
      return;
    }
    setBusy(true);
    try {
      log('info', `BLE state initial: ${snapshot.bleState}`);

      try {
        const before = await withTimeout(
          Location.getForegroundPermissionsAsync(),
          3000,
          'getForegroundPermissionsAsync',
        );
        log('info', `Location status: ${before.status} (canAskAgain=${before.canAskAgain})`);
        if (before.status !== 'granted') {
          log('info', 'Cer permisiune Location...');
          const after = await withTimeout(
            Location.requestForegroundPermissionsAsync(),
            15000,
            'requestForegroundPermissionsAsync',
          );
          log(
            after.status === 'granted' ? 'ok' : 'err',
            `Location dupa request: ${after.status}`,
          );
        }
      } catch (e: any) {
        log('warn', `Location: ${e?.message ?? e}`);
      }

      log('info', 'Apel presence.start() (timeout 30s)...');
      try {
        await withTimeout(presence.start(), 30000, 'presence.start');
        log('ok', `presence.start() OK. running=${presence.isRunning()}`);
      } catch (e: any) {
        log('err', `presence.start: ${e?.message ?? e}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    log('info', '=== PRESSED Opreste ===');
    setBusy(true);
    try {
      await withTimeout(presence.stop(), 5000, 'presence.stop');
      log('ok', 'presence.stop() OK');
    } catch (e: any) {
      log('err', `stop: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    log('info', '=== PRESSED Reset ===');
    setBusy(true);
    try {
      await withTimeout(presence.stop(), 5000, 'presence.stop');
      log('ok', 'state curatat (token, peers, sessions sterse)');
    } catch (e: any) {
      log('warn', `reset: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  function clearLogs() {
    setLogs([]);
  }

  const {
    peers,
    sessions,
    myToken,
    bleState,
    advertiseFailed,
    advertiseLastError,
    scanCounters,
  } = snapshot;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Inapoi</Text>
        </Pressable>
        <Text style={styles.title}>BLE Debug</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        <View style={styles.statusCard}>
          <Text style={styles.sectionTitle}>Hardware</Text>
          <View style={styles.kv}>
            <Text style={styles.kvK}>BLE state</Text>
            <Text
              style={[
                styles.kvV,
                { color: bleState === 'PoweredOn' ? colors.success : colors.danger },
              ]}
            >
              {bleState}
            </Text>
          </View>
          {advertiseFailed && (
            <View style={{ gap: 4, marginTop: 6 }}>
              <Text style={styles.errorText}>
                Advertise a esuat — esti invizibil pentru ceilalti.
              </Text>
              {advertiseLastError && (
                <Text style={[styles.errorText, { fontWeight: '500' }]}>
                  {advertiseLastError}
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.sectionTitle}>Engine state</Text>
          <View style={styles.kv}>
            <Text style={styles.kvK}>running</Text>
            <Text style={[styles.kvV, { color: active ? colors.success : colors.textMuted }]}>
              {active ? 'ACTIV' : 'OPRIT'}
            </Text>
          </View>
          <View style={styles.kv}>
            <Text style={styles.kvK}>busy</Text>
            <Text style={styles.kvV}>{busy ? 'da' : 'nu'}</Text>
          </View>
          {myToken && (
            <View style={styles.kv}>
              <Text style={styles.kvK}>my token</Text>
              <Text style={styles.tokenText}>{myToken}</Text>
            </View>
          )}
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.sectionTitle}>Scan counters</Text>
          <View style={styles.kv}>
            <Text style={styles.kvK}>devices Unplgd vazute</Text>
            <Text style={styles.kvV}>{scanCounters.devicesSeen}</Text>
          </View>
          <View style={styles.kv}>
            <Text style={styles.kvK}>cu service UUID match</Text>
            <Text style={styles.kvV}>{scanCounters.withServiceUuid}</Text>
          </View>
          <View style={styles.kv}>
            <Text style={styles.kvK}>token extras corect</Text>
            <Text
              style={[
                styles.kvV,
                { color: scanCounters.tokenExtracted > 0 ? colors.success : colors.textMuted },
              ]}
            >
              {scanCounters.tokenExtracted}
            </Text>
          </View>
        </View>

        <View style={styles.toggleRow}>
          <Pressable
            onPress={handleStart}
            disabled={busy || active}
            style={({ pressed }) => [
              styles.toggle,
              { backgroundColor: colors.accent },
              (pressed || busy || active) && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.toggleText}>Porneste scanare</Text>
          </Pressable>
          <Pressable
            onPress={handleStop}
            disabled={busy || !active}
            style={({ pressed }) => [
              styles.toggle,
              { backgroundColor: colors.danger },
              (pressed || busy || !active) && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.toggleText}>Opreste</Text>
          </Pressable>
        </View>
        <View style={styles.toggleRow}>
          <Pressable
            onPress={handleReset}
            disabled={busy}
            style={({ pressed }) => [
              styles.toggle,
              { backgroundColor: colors.textMuted },
              (pressed || busy) && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.toggleText}>Reset state</Text>
          </Pressable>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.logHeader}>
            <Text style={styles.sectionTitle}>Log ({logs.length})</Text>
            <Pressable onPress={clearLogs} hitSlop={8}>
              <Text style={styles.clearText}>clear</Text>
            </Pressable>
          </View>
          {logs.length === 0 ? (
            <Text style={styles.empty}>
              Apasa "Porneste scanare" — fiecare pas apare aici, chiar daca terminalul Metro nu primeste log-uri.
            </Text>
          ) : (
            logs.slice(-100).map((entry) => (
              <View key={entry.id} style={styles.logRow}>
                <Text style={styles.logTime}>
                  {new Date(entry.ts).toLocaleTimeString('en-GB')}
                </Text>
                <Text style={[styles.logText, logColor(entry.level)]}>
                  {entry.text}
                </Text>
              </View>
            ))
          )}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 16, paddingHorizontal: 20 }]}>
          Co-walk in derulare ({sessions.length})
        </Text>
        {sessions.length === 0 ? (
          <Text style={[styles.empty, { paddingHorizontal: 20 }]}>
            {active ? 'Niciun prieten in fereastra de co-walk.' : 'Porneste scanarea ca sa detectezi.'}
          </Text>
        ) : (
          sessions.map((s) => <SessionRow key={s.userId} session={s} now={now} />)
        )}

        <Text style={[styles.sectionTitle, { marginTop: 16, paddingHorizontal: 20 }]}>
          Useri detectati ({peers.length})
        </Text>
        {peers.length === 0 ? (
          <Text style={[styles.empty, { paddingHorizontal: 20 }]}>
            {active ? 'Caut prieteni in apropiere...' : 'Apasa Porneste ca sa pornesti scanarea.'}
          </Text>
        ) : (
          peers.map((p) => <PeerRow key={p.token} peer={p} now={now} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function logColor(level: LogLevel) {
  switch (level) {
    case 'ok':
      return { color: colors.success };
    case 'warn':
      return { color: '#d18800' };
    case 'err':
      return { color: colors.danger };
    default:
      return { color: colors.text };
  }
}

function SessionRow({ session, now }: { session: CoWalkSession; now: number }) {
  const elapsed = session.lastSeenAt - session.startedAt;
  const ratio = Math.min(1, elapsed / COWALK_MIN_DURATION_MS);
  const remainingMs = Math.max(0, COWALK_MIN_DURATION_MS - elapsed);
  const staleSec = Math.floor((now - session.lastSeenAt) / 1000);
  return (
    <View style={styles.sessionRow}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowName}>{session.name}</Text>
        <Text style={[styles.rowLevel, session.committed && { color: colors.success }]}>
          {session.committed ? 'Acordat ✓' : `${formatDuration(elapsed)} / 10:00`}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${ratio * 100}%`, backgroundColor: session.committed ? colors.success : colors.accent },
          ]}
        />
      </View>
      <View style={styles.rowMeta}>
        <Text style={styles.metaItem}>
          {session.committed
            ? 'XP acordat azi'
            : `mai sunt ${formatDuration(remainingMs)}`}
        </Text>
        <Text style={styles.metaItem}>vazut acum {staleSec}s</Text>
      </View>
    </View>
  );
}

function PeerRow({ peer, now }: { peer: Peer; now: number }) {
  const durationSec = Math.floor((now - peer.firstSeenAt) / 1000);
  const staleSec = Math.floor((now - peer.lastSeenAt) / 1000);
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowName}>{peer.name ?? 'Necunoscut'}</Text>
        <View style={styles.badgeGroup}>
          {peer.isFriend && (
            <Text style={[styles.badge, { backgroundColor: colors.success }]}>FRIEND</Text>
          )}
          {peer.level !== undefined && <Text style={styles.rowLevel}>Lvl {peer.level}</Text>}
        </View>
      </View>
      <Text style={styles.rowToken}>{peer.token}</Text>
      <View style={styles.rowMeta}>
        <Text style={styles.metaItem}>RSSI {peer.rssi} dBm</Text>
        <Text style={styles.metaItem}>{durationSec}s impreuna</Text>
        <Text style={styles.metaItem}>vazut acum {staleSec}s</Text>
      </View>
    </View>
  );
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  back: { color: colors.accent, fontSize: 16, fontWeight: '700', width: 60 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },

  statusCard: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kvK: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  kvV: { color: colors.text, fontSize: 13, fontWeight: '700' },
  tokenText: { color: colors.text, fontFamily: 'Courier', fontSize: 13, letterSpacing: 1 },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '600' },

  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 12,
  },
  toggle: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  toggleText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },

  scrollBody: { paddingBottom: 24 },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    paddingBottom: 4,
  },
  empty: { color: colors.textMuted, paddingVertical: 12 },

  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clearText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  logRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  logTime: { color: colors.textMuted, fontFamily: 'Courier', fontSize: 11, width: 70 },
  logText: { flex: 1, fontFamily: 'Courier', fontSize: 11, lineHeight: 14 },

  row: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  sessionRow: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: colors.cardAlt,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.accentDim,
    gap: 6,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowLevel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  rowToken: { color: colors.textMuted, fontFamily: 'Courier', fontSize: 11 },
  rowMeta: { flexDirection: 'row', gap: 12, marginTop: 4, flexWrap: 'wrap' },
  metaItem: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  badgeGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999 },
});
