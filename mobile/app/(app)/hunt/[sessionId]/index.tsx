import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { SvgXml } from 'react-native-svg';
import {
  cancelSession,
  endSession,
  getSessionState,
  leaveSession,
  postHeartbeat,
  startSession,
  type HeartbeatResponse,
  type HuntSessionState,
  type Warmth,
} from '../../../../src/api/hunt';
import { colors } from '../../../../src/theme/colors';
import { Encounter } from '../../../../src/hunt/Encounter';
import { HuntMap } from '../../../../src/hunt/HuntMap';
import { useHuntSocket } from '../../../../src/hunt/useHuntSocket';

const HEARTBEAT_INTERVAL_MS = 5_000;
// Polling-ul devine fallback — socket.io face push-uri instant. Tinem un
// refetch ocazional in caz ca socket-ul cade sau pierdem update-uri.
const SESSION_POLL_INTERVAL_MS = 30_000;

const WARMTH_COLOR: Record<Warmth, string> = {
  cold: '#5C8AB5',
  cool: '#6FB1D8',
  warm: '#F2B23B',
  hot: '#F37D3B',
  very_hot: '#E74C3C',
};

const WARMTH_LABEL: Record<Warmth, string> = {
  cold: 'Rece',
  cool: 'Racoros',
  warm: 'Caldut',
  hot: 'Cald',
  very_hot: 'Fierbinte!',
};

export default function HuntSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const qc = useQueryClient();

  // Socket.io push-uri server-side pe fiecare schimbare de stare. Hook-ul
  // invalideaza query-ul automat la primire — polling-ul ramane fallback.
  useHuntSocket(sessionId);

  const sessionQuery = useQuery({
    queryKey: ['hunt', 'session', sessionId],
    queryFn: () => getSessionState(sessionId),
    enabled: !!sessionId,
    refetchInterval: SESSION_POLL_INTERVAL_MS,
  });

  if (!sessionId || sessionQuery.isPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (sessionQuery.error || !sessionQuery.data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Vanatoare" onBack={() => router.replace('/(app)/hunt')} />
        <Text style={styles.error}>Nu am putut incarca sesiunea</Text>
      </SafeAreaView>
    );
  }

  const session = sessionQuery.data;

  if (session.status === 'COMPLETED') {
    // Auto-redirect la results.
    router.replace(`/(app)/hunt/${sessionId}/results`);
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (session.status === 'CANCELLED') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Vanatoare" onBack={() => router.replace('/(app)/hunt')} />
        <Text style={styles.error}>Sesiunea a fost anulata</Text>
      </SafeAreaView>
    );
  }

  if (session.status === 'LOBBY') {
    return <LobbyView session={session} sessionId={sessionId} qc={qc} />;
  }

  return <ActiveView session={session} sessionId={sessionId} />;
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.headerRow}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
        <Text style={styles.back}>←</Text>
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 44 }} />
    </View>
  );
}

function LobbyView({
  session,
  sessionId,
  qc,
}: {
  session: Extract<HuntSessionState, { status: 'LOBBY' }>;
  sessionId: string;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const startMut = useMutation({
    mutationFn: () => startSession(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hunt', 'session', sessionId] });
    },
    onError: (err: any) => Alert.alert('Hopa', err?.message ?? 'Nu pot porni'),
  });

  const leaveMut = useMutation({
    mutationFn: () => leaveSession(sessionId),
    onSuccess: () => router.replace('/(app)/hunt'),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelSession(sessionId),
    onSuccess: () => router.replace('/(app)/hunt'),
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title={session.park.name} onBack={() => router.replace('/(app)/hunt')} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.lobbyCard}>
          <Text style={styles.lobbyHeader}>Lobby</Text>
          <Text style={styles.lobbySub}>
            {session.lobby.length} jucatori · durata {Math.floor(session.durationSec / 60)} min
          </Text>
          {session.playersNeeded > 0 && (
            <Text style={styles.warning}>
              Mai aveti nevoie de {session.playersNeeded}{' '}
              {session.playersNeeded === 1 ? 'jucator' : 'jucatori'}
            </Text>
          )}
        </View>

        {session.lobby.map((m) => (
          <View key={m.userId} style={styles.memberRow}>
            {m.avatarSvg ? (
              <SvgXml xml={m.avatarSvg} width={42} height={42} />
            ) : (
              <View style={styles.avatarFallback} />
            )}
            <Text style={styles.memberName}>{m.name}</Text>
            <Text style={styles.memberLevel}>L{m.level}</Text>
          </View>
        ))}

        {session.isHost ? (
          <>
            <Pressable
              onPress={() => startMut.mutate()}
              disabled={!session.canStart || startMut.isPending}
              style={({ pressed }) => [
                styles.startBtn,
                (!session.canStart || startMut.isPending) && styles.startBtnDisabled,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={styles.startText}>
                {startMut.isPending ? 'Pornim...' : 'Start vanatoare'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                Alert.alert('Anulezi?', 'Lobby-ul se inchide pentru toata lumea.', [
                  { text: 'Nu' },
                  {
                    text: 'Da, anuleaza',
                    style: 'destructive',
                    onPress: () => cancelMut.mutate(),
                  },
                ])
              }
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.cancelText}>Anuleaza lobby</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={() => leaveMut.mutate()}
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
          >
            <Text style={styles.cancelText}>Iesi din lobby</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActiveView({
  session,
  sessionId,
}: {
  session: Extract<HuntSessionState, { status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' }>;
  sessionId: string;
}) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [heartbeat, setHeartbeat] = useState<HeartbeatResponse | null>(null);
  const [encounterMonsterId, setEncounterMonsterId] = useState<string | null>(null);
  const [encounterReveal, setEncounterReveal] = useState<{ lat: number; lng: number } | null>(null);

  // Foreground location watch — update incremental cu min 5m si min 3s.
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 5,
          timeInterval: 3000,
        },
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
      );
    })();
    return () => {
      sub?.remove();
    };
  }, []);

  // Heartbeat la 5s cu pozitia curenta.
  const lastBeatRef = useRef(0);
  useEffect(() => {
    const id = setInterval(async () => {
      if (!coords) return;
      const now = Date.now();
      if (now - lastBeatRef.current < HEARTBEAT_INTERVAL_MS - 200) return;
      lastBeatRef.current = now;
      try {
        const resp = await postHeartbeat(sessionId, coords.lat, coords.lng);
        setHeartbeat(resp);
        if (resp.status === 'ACTIVE' && resp.revealMonster && !encounterMonsterId) {
          setEncounterMonsterId(resp.revealMonster.id);
          setEncounterReveal({ lat: resp.revealMonster.lat, lng: resp.revealMonster.lng });
        }
      } catch {
        // network jitter, retry next tick
      }
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [coords, sessionId, encounterMonsterId]);

  const myTeam = session.teams.find((t) => t.id === session.myTeamId);
  const otherTeams = session.teams.filter((t) => t.id !== session.myTeamId);

  const endMut = useMutation({
    mutationFn: () => endSession(sessionId),
    onSuccess: () => router.replace(`/(app)/hunt/${sessionId}/results`),
  });

  const warmth = heartbeat?.status === 'ACTIVE' ? heartbeat.warmth : 'cold';
  const timeRemaining = heartbeat?.status === 'ACTIVE' ? heartbeat.timeRemainingSec : 0;
  const inZone = heartbeat?.status === 'ACTIVE' ? heartbeat.inZone : true;

  if (encounterMonsterId && coords && encounterReveal) {
    return (
      <Encounter
        sessionId={sessionId}
        monsterId={encounterMonsterId}
        myCoords={coords}
        monsterCoords={encounterReveal}
        onClose={() => {
          setEncounterMonsterId(null);
          setEncounterReveal(null);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title={session.park.name} onBack={() => router.replace('/(app)/hunt')} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.mapWrap}>
          <HuntMap
            parkPolygon={session.parkPolygon}
            zonePolygon={myTeam?.zone ?? null}
            myCoords={coords}
            heartbeat={heartbeat}
          />
        </View>

        <View style={[styles.warmthStrip, { backgroundColor: WARMTH_COLOR[warmth] }]}>
          {heartbeat?.status === 'ACTIVE' && heartbeat.nearestBearing !== null && (
            <View style={styles.compassSm}>
              <View
                style={[
                  styles.compassArrowSm,
                  { transform: [{ rotate: `${heartbeat.nearestBearing}deg` }] },
                ]}
              />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.warmthLabelSm}>{WARMTH_LABEL[warmth]}</Text>
            <Text style={styles.warmthHintSm}>
              {warmth === 'very_hot'
                ? 'Foarte aproape! Atinge monstrul pentru lupta'
                : warmth === 'cold'
                  ? 'Plimba-te prin zona ta — monstrii se ascund'
                  : 'Mergi pe directia sagetii'}
            </Text>
          </View>
          <Text style={styles.timerInline}>{formatTime(timeRemaining)}</Text>
        </View>

        {!inZone && (
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>
              Esti in afara zonei echipei tale! Intoarce-te in {myTeam?.name ?? 'zona ta'}.
            </Text>
          </View>
        )}

        <View style={styles.scoreCard}>
          <Text style={styles.sectionTitle}>Scor</Text>
          {myTeam && (
            <View style={[styles.teamRow, styles.teamRowMine]}>
              <Text style={styles.teamName}>{myTeam.name} (echipa ta)</Text>
              <Text style={styles.teamScore}>{myTeam.score}</Text>
            </View>
          )}
          {otherTeams.map((t) => (
            <View key={t.id} style={styles.teamRow}>
              <Text style={styles.teamName}>{t.name}</Text>
              <Text style={styles.teamScoreMuted}>
                {compareScore(myTeam?.score ?? 0, t.score)}
              </Text>
            </View>
          ))}
        </View>

        {session.isHost && (
          <Pressable
            onPress={() =>
              Alert.alert('Opresti?', 'Sesiunea se incheie pentru toata lumea.', [
                { text: 'Nu' },
                { text: 'Da, opreste', style: 'destructive', onPress: () => endMut.mutate() },
              ])
            }
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
          >
            <Text style={styles.cancelText}>Opreste sesiunea</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Pentru fairness: nu aratam scor exact al adversarului, doar comparativ vag.
function compareScore(mine: number, theirs: number): string {
  const diff = theirs - mine;
  if (diff > 200) return 'mult in fata';
  if (diff > 50) return 'putin in fata';
  if (diff > -50) return 'aproape de tine';
  if (diff > -200) return 'putin in spate';
  return 'mult in spate';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { color: colors.text, fontSize: 22, fontWeight: '700' },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },

  scroll: { padding: 16, gap: 14 },
  error: { color: colors.danger, textAlign: 'center', marginTop: 24 },

  lobbyCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16 },
  lobbyHeader: { color: colors.text, fontSize: 18, fontWeight: '800' },
  lobbySub: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  warning: { color: colors.danger, fontSize: 13, fontWeight: '700', marginTop: 8 },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  memberName: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  memberLevel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.cardAlt,
  },

  startBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  startBtnDisabled: { opacity: 0.4 },
  startText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  cancelBtn: {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelText: { color: colors.danger, fontSize: 15, fontWeight: '700' },

  mapWrap: {
    height: 340,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },

  warmthStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  warmthLabelSm: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  warmthHintSm: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.92,
    marginTop: 2,
  },
  timerInline: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    backgroundColor: 'rgba(0,0,0,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  compassSm: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassArrowSm: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
  },

  warningCard: {
    backgroundColor: '#FFE2E8',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  warningText: { color: colors.danger, fontWeight: '700', fontSize: 14, textAlign: 'center' },

  timerCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  timerLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  timerValue: { color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 4 },

  scoreCard: { backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 8 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  teamRowMine: {
    backgroundColor: 'rgba(46,204,113,0.10)',
    borderRadius: 10,
  },
  teamName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  teamScore: { color: colors.success, fontSize: 17, fontWeight: '900' },
  teamScoreMuted: { color: colors.textMuted, fontSize: 14, fontStyle: 'italic' },

  btnPressed: { transform: [{ scale: 0.98 }], opacity: 0.85 },
});
