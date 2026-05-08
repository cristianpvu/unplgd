import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePresence } from '../../src/ble/usePresence';
import { presence } from '../../src/ble/presence';
import type { ClientSession, Peer } from '../../src/ble/presence';
import { COWALK_MIN_DURATION_MS } from '../../src/ble/constants';
import { useCowalkEnabled, setCowalkEnabled } from '../../src/ble/cowalkPref';
import { addFriend } from '../../src/api/friends';
import { ApiError } from '../../src/api/client';
import { colors } from '../../src/theme/colors';

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Nearby() {
  const qc = useQueryClient();
  // Presence engine ruleaza global (auto-start din (app)/_layout.tsx). Acest
  // ecran doar consuma snapshot-ul; nu mai pornim/oprim la mount.
  const { active, peers, sessions, error, advertiseFailed } = usePresence();
  const cowalkEnabled = useCowalkEnabled();
  const [adding, setAdding] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (sessions.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sessions.length]);

  const add = useMutation({
    mutationFn: (userId: string) => addFriend(userId, 'ble'),
    onSuccess: (_data, userId) => {
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['friends'] });
      // Marcam peer-ul local ca prieten — UI-ul (si heartbeat-ul de presence
      // catre backend) includ peer-ul instant in co-walk detection.
      presence.markPeerAsFriend(userId);
      Alert.alert('Prieten nou', 'Aveti acum un nou prieten!');
      setAdding(null);
    },
    onError: (err: any, userId) => {
      const msg =
        err instanceof ApiError && err.code === 'self_friend'
          ? 'Nu te poti adauga pe tine'
          : err?.message ?? 'Nu am putut adauga prietenul';
      Alert.alert('Hopa', msg);
      setAdding(null);
    },
  });

  function onAdd(peer: Peer) {
    if (!peer.userId) return;
    setAdding(peer.userId);
    add.mutate(peer.userId);
  }

  // Sortare: necunoscuti rezolvati intai (cei care pot fi adaugati), apoi
  // prieteni deja, apoi token-uri inca nerezolvate.
  const sorted = [...peers].sort((a, b) => {
    const score = (p: Peer) => {
      if (p.userId && !p.isFriend) return 0;
      if (p.userId && p.isFriend) return 1;
      return 2;
    };
    return score(a) - score(b);
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>Prieteni in apropiere</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.statusCard}>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusLabel}>Cauta prieteni in apropiere</Text>
            <Text style={styles.toggleHint}>
              {cowalkEnabled
                ? active
                  ? 'Bluetooth pornit · vizibil pentru prieteni'
                  : 'Se porneste...'
                : 'Dezactivat · esti invizibil si nu cauti'}
            </Text>
          </View>
          <Switch
            value={cowalkEnabled}
            onValueChange={(v) => void setCowalkEnabled(v)}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#FFFFFF"
          />
        </View>
        {cowalkEnabled && error && <Text style={styles.errorText}>{error}</Text>}
        {cowalkEnabled && active && advertiseFailed && (
          <>
            <Text style={styles.warnText}>
              Esti invizibil pentru ceilalti. Verifica daca Bluetooth-ul e pornit si daca aplicatia
              are permisiune.
            </Text>
            <Pressable
              onPress={() => Linking.openSettings()}
              style={({ pressed }) => [styles.settingsBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.settingsBtnText}>Deschide Setari</Text>
            </Pressable>
          </>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        {!cowalkEnabled ? (
          <View style={styles.emptyBox}>
            <Text style={styles.empty}>
              Activeaza optiunea de mai sus ca sa-ti detectezi prietenii din apropiere si sa
              acumulezi XP din co-walk.
            </Text>
          </View>
        ) : (
          <>
            {sessions.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Co-walk in derulare</Text>
                {sessions.map((s) => (
                  <SessionCard key={s.id} session={s} now={now} />
                ))}
              </>
            )}

            <Text style={[styles.sectionTitle, sessions.length > 0 && { marginTop: 18 }]}>
              Prieteni in raza
            </Text>
            {sorted.length === 0 ? (
              <View style={styles.emptyBox}>
                {active && <ActivityIndicator color={colors.accent} />}
                <Text style={styles.empty}>
                  {active
                    ? 'Caut prieteni in apropiere... Tine telefonul aproape de altcineva care are aplicatia deschisa.'
                    : 'Bluetooth oprit.'}
                </Text>
              </View>
            ) : (
              sorted.map((peer) => (
                <PeerRow
                  key={peer.token}
                  peer={peer}
                  isAdding={adding === peer.userId}
                  onAdd={() => onAdd(peer)}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SessionCard({ session, now }: { session: ClientSession; now: number }) {
  const me = session.members.find((m) => m.isMe);
  const others = session.members.filter((m) => !m.isMe);
  const myJoinedAt = me?.joinedAtClient ?? session.startedAtClient;
  const myAwarded = me?.awarded ?? false;
  const elapsed = Math.max(0, now - myJoinedAt);
  const ratio = Math.min(1, elapsed / COWALK_MIN_DURATION_MS);
  const remainingMs = Math.max(0, COWALK_MIN_DURATION_MS - elapsed);
  const fillColor = myAwarded ? colors.success : colors.accent;

  const headline =
    others.length === 0
      ? 'Sesiune'
      : others.length === 1
        ? others[0]!.name
        : `${others[0]!.name} + ${others.length - 1}`;

  return (
    <View style={styles.sessionCard}>
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionName} numberOfLines={1}>
          🚶 {headline}
        </Text>
        <Text style={[styles.sessionTimer, { color: fillColor }]}>
          {myAwarded ? '✓ Acordat' : `${formatDuration(elapsed)} / 10:00`}
        </Text>
      </View>
      <View style={styles.sessionTrack}>
        <View
          style={[styles.sessionFill, { width: `${ratio * 100}%`, backgroundColor: fillColor }]}
        />
      </View>
      <Text style={styles.sessionHint}>
        {myAwarded
          ? 'XP acordat azi · Co-walk reusit'
          : `Mai sunt ${formatDuration(remainingMs)} pana la XP`}
      </Text>
      {others.length > 0 && (
        <View style={styles.membersList}>
          {others.map((m) => {
            const memberElapsed = Math.max(0, now - m.joinedAtClient);
            return (
              <View key={m.userId} style={styles.memberRow}>
                <Text style={styles.memberName} numberOfLines={1}>
                  • {m.name}
                </Text>
                <Text style={styles.memberMeta}>
                  {m.awarded ? '✓ XP' : `${formatDuration(memberElapsed)}`}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function PeerRow({
  peer,
  isAdding,
  onAdd,
}: {
  peer: Peer;
  isAdding: boolean;
  onAdd: () => void;
}) {
  const resolved = !!peer.userId;
  const proximity = peer.rssi >= -65 ? 'Foarte aproape' : peer.rssi >= -75 ? 'Aproape' : 'In raza';

  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowName} numberOfLines={1}>
          {peer.name ?? 'Se identifica...'}
        </Text>
        <View style={styles.rowMeta}>
          {peer.level !== undefined && (
            <Text style={styles.metaItem}>Lvl {peer.level}</Text>
          )}
          <Text style={styles.metaItem}>{proximity}</Text>
        </View>
      </View>

      {peer.isFriend ? (
        <View style={[styles.actionBadge, { backgroundColor: colors.success }]}>
          <Text style={styles.actionBadgeText}>PRIETEN</Text>
        </View>
      ) : resolved ? (
        <Pressable
          onPress={onAdd}
          disabled={isAdding}
          style={({ pressed }) => [
            styles.addBtn,
            pressed && { opacity: 0.85 },
            isAdding && { opacity: 0.6 },
          ]}
        >
          {isAdding ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.addBtnText}>Adauga</Text>
          )}
        </Pressable>
      ) : (
        <Text style={styles.metaItem}>...</Text>
      )}
    </View>
  );
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
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { color: colors.accent, fontSize: 24, fontWeight: '700' },
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 16,
  },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: '700', marginTop: 8 },
  warnText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    lineHeight: 16,
  },
  settingsBtn: {
    marginTop: 10,
    backgroundColor: colors.accent,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  settingsBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  scrollBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 10 },
  sectionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingBottom: 6,
  },
  sessionCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.accentDim,
    gap: 8,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  sessionName: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  sessionTimer: { fontSize: 13, fontWeight: '800' },
  sessionTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 999,
    overflow: 'hidden',
  },
  sessionFill: { height: '100%', borderRadius: 999 },
  sessionHint: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  membersList: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  memberName: { color: colors.text, fontSize: 12, fontWeight: '600', flex: 1 },
  memberMeta: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  emptyBox: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  empty: { color: colors.textMuted, textAlign: 'center', paddingHorizontal: 20 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  rowLeft: { flex: 1, gap: 4 },
  rowName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowMeta: { flexDirection: 'row', gap: 12 },
  metaItem: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  addBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    minWidth: 90,
    alignItems: 'center',
  },
  addBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  actionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  actionBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
