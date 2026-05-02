import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { usePresence } from '../../src/ble/usePresence';
import type { CoWalkSession, Peer } from '../../src/ble/presence';
import { COWALK_MIN_DURATION_MS } from '../../src/ble/constants';
import { colors } from '../../src/theme/colors';

export default function BleDebug() {
  const { active, peers, sessions, myToken, error, start, stop } = usePresence();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  // Alerta de co-walk completed e gestionata global in (app)/_layout.tsx ca
  // sa apara si daca user-ul nu e pe debug screen.

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Inapoi</Text>
        </Pressable>
        <Text style={styles.title}>BLE Debug</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Stare</Text>
        <Text style={[styles.statusValue, { color: active ? colors.accent : colors.textMuted }]}>
          {active ? 'ACTIV' : 'OPRIT'}
        </Text>
        {myToken && (
          <>
            <Text style={[styles.statusLabel, { marginTop: 8 }]}>Token-ul meu</Text>
            <Text style={styles.tokenText}>{myToken}</Text>
          </>
        )}
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <Pressable
        onPress={() => (active ? stop() : start())}
        style={({ pressed }) => [
          styles.toggle,
          { backgroundColor: active ? colors.danger : colors.accent },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.toggleText}>{active ? 'Opreste' : 'Porneste scanare'}</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        <Text style={styles.sectionTitle}>
          Co-walk in derulare ({sessions.length})
        </Text>
        {sessions.length === 0 ? (
          <Text style={styles.empty}>
            {active ? 'Niciun prieten in fereastra de co-walk.' : 'Porneste scanarea ca sa detectezi.'}
          </Text>
        ) : (
          sessions.map((s) => <SessionRow key={s.userId} session={s} now={now} />)
        )}

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
          Useri detectati ({peers.length})
        </Text>
        {peers.length === 0 ? (
          <Text style={styles.empty}>
            {active ? 'Caut prieteni in apropiere...' : 'Apasa Start ca sa pornesti scanarea.'}
          </Text>
        ) : (
          peers.map((p) => <PeerRow key={p.token} peer={p} now={now} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
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
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  statusLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statusValue: { fontSize: 18, fontWeight: '800' },
  tokenText: { color: colors.text, fontFamily: 'Courier', fontSize: 14, letterSpacing: 1 },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '600', marginTop: 8 },

  toggle: {
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  toggleText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  scrollBody: { paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    paddingTop: 20,
    paddingBottom: 8,
  },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 24 },

  row: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  sessionRow: {
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
