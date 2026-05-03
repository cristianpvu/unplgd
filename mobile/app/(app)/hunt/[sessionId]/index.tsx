import { useEffect, useMemo, useRef, useState } from 'react';
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
} from '../../../../src/api/hunt';
import { colors } from '../../../../src/theme/colors';
import { Encounter } from '../../../../src/hunt/Encounter';
import { HuntMap } from '../../../../src/hunt/HuntMap';
import { useHuntSocket } from '../../../../src/hunt/useHuntSocket';
import { distanceMeters, warmthForDistance } from '../../../../src/hunt/geo';

// Heartbeat-ul HTTP serveste pt validari fizice si revelare monstri noi.
// Wedge-ul + warmth ruleaza in realtime client-side din nearestPosition + GPS,
// asa ca 3s e suficient ca sursa de adevar de la server.
const HEARTBEAT_INTERVAL_MS = 3_000;
// Polling-ul devine fallback — socket.io face push-uri instant. Tinem un
// refetch ocazional in caz ca socket-ul cade sau pierdem update-uri.
const SESSION_POLL_INTERVAL_MS = 30_000;

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

  // Modelul "team-leader-only-phone": doar liderul echipei (random la Start)
  // vede AR + harta + lupta. Restul sunt fizic langa el si vad un ecran simplu
  // (timer + clasament). Liderul nu e neaparat host-ul global al sesiunii.
  if (!session.iAmTeamLeader) {
    return <MemberWaitingView session={session} />;
  }

  return <ActiveView session={session} sessionId={sessionId} />;
}

function MemberWaitingView({
  session,
}: {
  session: Extract<HuntSessionState, { status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' }>;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const myTeam = session.teams.find((t) => t.id === session.myTeamId);
  const rankedTeams = useMemo(
    () => [...session.teams].sort((a, b) => b.score - a.score),
    [session.teams],
  );
  const timeRemaining = session.endsAt
    ? Math.max(0, Math.floor((new Date(session.endsAt).getTime() - now) / 1000))
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title={session.park.name} onBack={() => router.replace('/(app)/hunt')} />
      <ScrollView contentContainerStyle={styles.memberScroll}>
        <View style={styles.memberHero}>
          <Text style={styles.memberHeroEmoji}>👀</Text>
          <Text style={styles.memberHeroTitle}>
            Stai langa {session.myTeamLeader?.name ?? 'liderul echipei'}!
          </Text>
          <Text style={styles.memberHeroSub}>
            Vanatoarea se joaca pe telefonul lui. Ajutati-l sa raspunda la
            intrebari — discutati impreuna ce varianta alege.
          </Text>
          <View style={styles.memberTimerPill}>
            <Text style={styles.memberTimerLabel}>Timp ramas</Text>
            <Text style={styles.memberTimerText}>{formatTime(timeRemaining)}</Text>
          </View>
        </View>

        <View style={styles.memberLeaderCard}>
          <Text style={styles.leaderTitle}>Clasament</Text>
          {rankedTeams.map((t, idx) => {
            const mine = t.id === myTeam?.id;
            return (
              <View
                key={t.id}
                style={[styles.leaderRow, mine && styles.leaderRowMine]}
              >
                <Text style={[styles.leaderRank, mine && styles.leaderRankMine]}>
                  #{idx + 1}
                </Text>
                <Text
                  style={[styles.leaderName, mine && styles.leaderNameMine]}
                  numberOfLines={1}
                >
                  {t.name}
                  {mine ? ' (echipa ta)' : ''}
                </Text>
                <Text style={[styles.leaderScore, mine && styles.leaderScoreMine]}>
                  {t.score}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
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
  const [heading, setHeading] = useState<number | null>(null);
  const [heartbeat, setHeartbeat] = useState<HeartbeatResponse | null>(null);
  const [encounterMonsterId, setEncounterMonsterId] = useState<string | null>(null);
  const [encounterReveal, setEncounterReveal] = useState<{ lat: number; lng: number } | null>(null);
  const [now, setNow] = useState(Date.now());

  // Tick local de 1s pentru ca timer-ul sa coboare smooth, nu in salturi de
  // 5s la fiecare heartbeat. Sursa de adevar ramane session.endsAt.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Foreground location watch — update agresiv (1m, 1s) ca wedge-ul si
  // warmth-ul recalculate client-side sa fie smooth pe miscare.
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 1,
          timeInterval: 1000,
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

  // Phone heading — orientarea telefonului (busola). Map-ul roteste sa fie
  // heading-up ca turn-by-turn nav. trueHeading e calibrat cu nordul real;
  // pe fallback magnetic adaugam declinatia daca dispozitivul o expune.
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      sub = await Location.watchHeadingAsync((h) => {
        const v = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        if (typeof v === 'number' && v >= 0) setHeading(v);
      });
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
      const tNow = Date.now();
      if (tNow - lastBeatRef.current < HEARTBEAT_INTERVAL_MS - 200) return;
      lastBeatRef.current = tNow;
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
  const rankedTeams = useMemo(
    () => [...session.teams].sort((a, b) => b.score - a.score),
    [session.teams],
  );

  const endMut = useMutation({
    mutationFn: () => endSession(sessionId),
    onSuccess: () => router.replace(`/(app)/hunt/${sessionId}/results`),
  });

  const inZone = heartbeat?.status === 'ACTIVE' ? heartbeat.inZone : true;

  // Recalcul real-time client-side: nearestPosition vine de la server (3s),
  // dar coords se updateaza la 1s — haloul reactioneaza la miscare instant.
  // Daca server nu a expus pozitia (cold), folosim warmth direct din heartbeat.
  const nearestPosition =
    heartbeat?.status === 'ACTIVE' ? heartbeat.nearestPosition : null;
  const localWarmth = useMemo(() => {
    if (!coords || !nearestPosition) {
      return heartbeat?.status === 'ACTIVE' ? heartbeat.warmth : 'cold';
    }
    return warmthForDistance(distanceMeters(coords, nearestPosition));
  }, [coords, nearestPosition, heartbeat]);

  // Calcul local: timpul ramas vine din session.endsAt + tick 1s. Cand
  // heartbeat-ul mai vechi spunea altceva, prioritizam ce calculam local.
  const timeRemaining = session.endsAt
    ? Math.max(0, Math.floor((new Date(session.endsAt).getTime() - now) / 1000))
    : 0;

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
    <View style={styles.fullscreen}>
      <HuntMap
        parkPolygon={session.parkPolygon}
        zonePolygon={myTeam?.zone ?? null}
        myCoords={coords}
        heartbeat={heartbeat}
        warmth={localWarmth}
        heading={heading}
      />

      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <Pressable
            onPress={() => router.replace('/(app)/hunt')}
            hitSlop={12}
            style={styles.iconBtn}
          >
            <Text style={styles.iconBtnText}>←</Text>
          </Pressable>
          <View style={styles.parkPill} pointerEvents="none">
            <Text style={styles.parkPillText} numberOfLines={1}>
              {session.park.name}
            </Text>
          </View>
          <View style={styles.timerPill} pointerEvents="none">
            <Text style={styles.timerPillText}>{formatTime(timeRemaining)}</Text>
          </View>
        </View>

        {!inZone && (
          <View style={styles.zoneBanner} pointerEvents="none">
            <Text style={styles.zoneBannerText}>
              Iesi din zona {myTeam?.name ?? 'ta'} — intoarce-te
            </Text>
          </View>
        )}
      </SafeAreaView>

      <SafeAreaView style={styles.bottomOverlay} edges={['bottom']} pointerEvents="box-none">
        <View style={styles.leaderCard}>
          <Text style={styles.leaderTitle}>Clasament</Text>
          {rankedTeams.map((t, idx) => {
            const mine = t.id === myTeam?.id;
            return (
              <View
                key={t.id}
                style={[styles.leaderRow, mine && styles.leaderRowMine]}
              >
                <Text style={[styles.leaderRank, mine && styles.leaderRankMine]}>
                  #{idx + 1}
                </Text>
                <Text
                  style={[styles.leaderName, mine && styles.leaderNameMine]}
                  numberOfLines={1}
                >
                  {t.name}
                  {mine ? ' (tu)' : ''}
                </Text>
                <Text style={[styles.leaderScore, mine && styles.leaderScoreMine]}>
                  {t.score}
                </Text>
              </View>
            );
          })}
        </View>

        {session.isHost && (
          <Pressable
            onPress={() =>
              Alert.alert('Opresti?', 'Sesiunea se incheie pentru toata lumea.', [
                { text: 'Nu' },
                { text: 'Da, opreste', style: 'destructive', onPress: () => endMut.mutate() },
              ])
            }
            style={({ pressed }) => [styles.endBtn, pressed && styles.btnPressed]}
          >
            <Text style={styles.endBtnText}>Opreste sesiunea</Text>
          </Pressable>
        )}
      </SafeAreaView>
    </View>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  fullscreen: { flex: 1, backgroundColor: '#000000' },

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

  // Active view — overlays peste harta fullscreen.
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15,15,18,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  iconBtnText: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  parkPill: {
    flex: 1,
    backgroundColor: 'rgba(15,15,18,0.85)',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  parkPillText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  timerPill: {
    backgroundColor: 'rgba(15,15,18,0.92)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 78,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  timerPillText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },

  zoneBanner: {
    marginTop: 10,
    marginHorizontal: 14,
    backgroundColor: 'rgba(231,76,60,0.95)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  zoneBannerText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },

  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 8,
  },
  leaderCard: {
    backgroundColor: 'rgba(15,15,18,0.92)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  leaderTitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 10,
    borderRadius: 10,
  },
  leaderRowMine: { backgroundColor: 'rgba(46,204,113,0.18)' },
  leaderRank: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '900',
    width: 26,
  },
  leaderRankMine: { color: '#7DCEA0' },
  leaderName: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', flex: 1 },
  leaderNameMine: { color: '#FFFFFF' },
  leaderScore: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  leaderScoreMine: { color: '#7DCEA0' },

  // Member waiting view — telefonul kid-ului care e langa team-leader.
  memberScroll: { padding: 16, gap: 16 },
  memberHero: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    gap: 8,
  },
  memberHeroEmoji: { fontSize: 48 },
  memberHeroTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  memberHeroSub: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 4,
  },
  memberTimerPill: {
    marginTop: 14,
    backgroundColor: colors.cardAlt,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  memberTimerLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  memberTimerText: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  memberLeaderCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },

  endBtn: {
    backgroundColor: 'rgba(231,76,60,0.95)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  endBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },

  btnPressed: { transform: [{ scale: 0.98 }], opacity: 0.85 },
});
