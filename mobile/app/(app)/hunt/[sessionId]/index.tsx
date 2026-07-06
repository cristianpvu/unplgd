import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  joinSessionBracelet,
  leaveSession,
  postHeartbeat,
  setTeamName,
  startSession,
  type HeartbeatResponse,
  type HuntSessionState,
} from '../../../../src/api/hunt';
import { ApiError } from '../../../../src/api/client';
import { cancelTagRead, isNfcAvailable, readTagUid } from '../../../../src/lib/nfc';
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

  const myTeam = session.teams.find((t) => t.id === session.myTeamId);

  // Modelul "team-leader-only-phone": doar liderul echipei (random la Start)
  // vede AR + harta + lupta. Restul sunt fizic langa el si vad un ecran simplu
  // (timer + clasament). Liderul nu e neaparat host-ul global al sesiunii.
  if (!session.iAmTeamLeader) {
    return <MemberWaitingView session={session} />;
  }

  // Liderul: inainte sa joace, alege/confirma numele echipei. Pana atunci
  // membrii vad "asteptam pe lider sa numeasca echipa".
  if (myTeam && !myTeam.nameSet) {
    return (
      <TeamNamingView
        session={session}
        sessionId={sessionId}
        team={myTeam}
        qc={qc}
      />
    );
  }

  return <ActiveView session={session} sessionId={sessionId} />;
}

type ActiveSessionState = Extract<
  HuntSessionState,
  { status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' }
>;
type ActiveTeam = ActiveSessionState['teams'][number];

function TeamNamingView({
  session,
  sessionId,
  team,
  qc,
}: {
  session: ActiveSessionState;
  sessionId: string;
  team: ActiveTeam;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [draft, setDraft] = useState<string>(team.name ?? '');
  const mut = useMutation({
    mutationFn: (name: string) => setTeamName(sessionId, team.id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hunt', 'session', sessionId] });
    },
    onError: (err: any) => Alert.alert('Hopa', err?.message ?? 'Nu pot salva numele'),
  });

  const trimmed = draft.trim();
  const canSubmit = trimmed.length >= 1 && trimmed.length <= 30 && !mut.isPending;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Header title={session.park.name} onBack={() => router.replace('/(app)/hunt')} />
      <ScrollView contentContainerStyle={styles.namingScroll}>
        <View style={styles.namingHeader}>
          <Text style={styles.namingTag}>LIDER</Text>
          <Text style={styles.namingTitle}>Numeste echipa ta</Text>
          <Text style={styles.namingSub}>
            Restul copiilor stau langa tine si raspundeti impreuna pe telefonul tau.
          </Text>
        </View>

        <View style={styles.namingInputWrap}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="ex. Vulturii"
            placeholderTextColor={colors.textMuted}
            maxLength={30}
            autoFocus
            style={styles.namingInput}
          />
          <Text style={styles.namingCount}>{trimmed.length}/30</Text>
        </View>

        <Pressable
          onPress={() => canSubmit && mut.mutate(trimmed)}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.primaryBtn,
            !canSubmit && styles.primaryBtnDisabled,
            pressed && styles.btnPressed,
          ]}
        >
          <Text style={styles.primaryBtnText}>
            {mut.isPending ? 'Salvez...' : 'Confirma si porneste'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Header title={session.park.name} onBack={() => router.replace('/(app)/hunt')} />
      <ScrollView contentContainerStyle={styles.memberScroll}>
        {/* Timer mare in centru — atentia principala */}
        <View style={styles.memberTimerWrap}>
          <Text style={styles.memberTimerNum}>{formatTime(timeRemaining)}</Text>
          <Text style={styles.memberTimerLabel}>timp ramas</Text>
        </View>

        {/* Leader compact */}
        <View style={styles.memberLeaderRow}>
          <View style={styles.memberLeaderLabel}>
            <Text style={styles.memberLeaderLabelText}>LIDER</Text>
          </View>
          <Text style={styles.memberLeaderName}>
            {session.myTeamLeader?.name ?? 'echipa ta'}
          </Text>
        </View>

        <Text style={styles.memberInstruction}>
          {myTeam && !myTeam.nameSet
            ? 'Asteapta langa lider sa numeasca echipa voastra.'
            : 'Stai langa lider. Discutati impreuna raspunsurile.'}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Clasament</Text>
          {rankedTeams.map((t, idx) => {
            const mine = t.id === myTeam?.id;
            return (
              <View
                key={t.id}
                style={[styles.memberLeaderRowItem, mine && styles.memberLeaderRowMine]}
              >
                <Text style={styles.memberLeaderRowRank}>{idx + 1}</Text>
                <Text style={styles.memberLeaderRowName} numberOfLines={1}>
                  {t.name}
                </Text>
                <Text style={styles.memberLeaderRowScore}>{t.score}</Text>
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

  const canStart = session.canStart && !startMut.isPending;
  const ready = session.playersNeeded === 0;

  // Inrolare cu bratara NFC — pt copiii veniti in parc FARA telefon. Oricine
  // din lobby le scaneaza bratara si intra pe contul lor (viaBracelet: nu pot
  // fi lideri, dar participa si primesc XP normal).
  const [scanningBracelet, setScanningBracelet] = useState(false);
  const [nfcAvailable, setNfcAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    isNfcAvailable().then(setNfcAvailable);
    return () => {
      cancelTagRead();
    };
  }, []);

  const braceletMut = useMutation({
    mutationFn: (uid: string) => joinSessionBracelet(sessionId, uid),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['hunt', 'session', sessionId] });
      Alert.alert(
        r.alreadyIn ? 'E deja aici' : 'A intrat!',
        r.alreadyIn
          ? `${r.user.name} e deja in lobby.`
          : `${r.user.name} s-a alaturat vanatorii cu bratara.`,
      );
    },
    onError: (err: any) => {
      const msg =
        err instanceof ApiError && err.code === 'bracelet_unknown'
          ? 'Bratara nu e inregistrata pe niciun cont.'
          : err instanceof ApiError && err.code === 'not_friends'
            ? err.message
            : err?.message ?? 'Nu am putut adauga jucatorul';
      Alert.alert('Hopa', msg);
    },
  });

  async function scanBracelet() {
    if (nfcAvailable === false) {
      Alert.alert('NFC indisponibil', 'Telefonul tau nu poate citi bratari NFC.');
      return;
    }
    setScanningBracelet(true);
    try {
      const uid = await readTagUid({ alertMessage: 'Apropie bratara prietenului de telefon' });
      braceletMut.mutate(uid);
    } catch (e: any) {
      if (e?.message && !/cancel/i.test(e.message)) {
        Alert.alert('Scanare esuata', 'Tine bratara aproape de spatele telefonului si reincearca.');
      }
    } finally {
      setScanningBracelet(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Header title={session.park.name} onBack={() => router.replace('/(app)/hunt')} />

      <ScrollView contentContainerStyle={styles.lobbyScroll}>
        {/* Hero compact — numar mare + status pe linie */}
        <View style={styles.lobbyHeroCompact}>
          <View>
            <Text style={styles.lobbyHeroNum}>{session.lobby.length}</Text>
            <Text style={styles.lobbyHeroNumLabel}>
              {session.lobby.length === 1 ? 'jucator' : 'jucatori'}
            </Text>
          </View>
          <View style={styles.lobbyHeroDivider} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={styles.lobbyStatusRow}>
              <View style={[styles.statusDot, { backgroundColor: ready ? colors.success : colors.accent }]} />
              <Text style={styles.lobbyStatusText}>
                {ready ? 'Gata de start' : `Mai trebuie ${session.playersNeeded}`}
              </Text>
            </View>
            <Text style={styles.lobbyHeroSub}>
              {Math.floor(session.durationSec / 60)} minute
            </Text>
          </View>
        </View>

        {/* Lista jucatori — compacta, fara cards individuale colorate */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>In lobby</Text>
          <View style={styles.playerList}>
            {session.lobby.map((m, idx) => (
              <PlayerRow key={m.userId} member={m} index={idx} />
            ))}
            {Array.from({ length: session.playersNeeded }).map((_, i) => (
              <PendingRow key={`pending-${i}`} delay={i * 200} />
            ))}
          </View>
          {/* Un prieten fara telefon la el? Ii scanezi bratara si intra si el. */}
          <Pressable
            onPress={() => {
              if (scanningBracelet) {
                cancelTagRead();
                setScanningBracelet(false);
              } else {
                void scanBracelet();
              }
            }}
            disabled={braceletMut.isPending}
            style={({ pressed }) => [
              styles.braceletBtn,
              pressed && styles.btnPressed,
              braceletMut.isPending && { opacity: 0.5 },
            ]}
          >
            {scanningBracelet || braceletMut.isPending ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <Text style={styles.braceletBtnIcon}>⌚</Text>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.braceletBtnLabel}>
                {scanningBracelet ? 'Apropie bratara... (apasa pt anulare)' : 'Adauga cu bratara'}
              </Text>
              <Text style={styles.braceletBtnSub}>
                Pentru prietenii veniti fara telefon
              </Text>
            </View>
          </Pressable>
        </View>

        {session.isHost ? (
          <View style={styles.bottomActions}>
            <LobbyStartButton
              ready={canStart}
              loading={startMut.isPending}
              fullReady={ready}
              onPress={() => startMut.mutate()}
            />
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
          </View>
        ) : (
          <View style={styles.bottomActions}>
            <View style={styles.waitingRow}>
              <WaitingDots />
              <Text style={styles.waitingText}>Asteptam liderul sa porneasca</Text>
            </View>
            <Pressable
              onPress={() => leaveMut.mutate()}
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.cancelText}>Iesi din lobby</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Rand jucator — avatar mic + nume + level pe dreapta. Stagger fade-in.
function PlayerRow({
  member,
  index,
}: {
  member: {
    userId: string;
    name: string;
    level: number;
    avatarSvg: string | null;
    viaBracelet?: boolean;
  };
  index: number;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 260,
      delay: index * 60,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, index]);
  const translateX = enter.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] });
  return (
    <Animated.View style={[styles.playerRow, { opacity: enter, transform: [{ translateX }] }]}>
      <View style={styles.playerAvatar}>
        {member.avatarSvg ? (
          <SvgXml xml={member.avatarSvg} width={36} height={36} />
        ) : (
          <View style={styles.avatarFallback} />
        )}
      </View>
      <Text style={styles.playerName} numberOfLines={1}>
        {member.name}
      </Text>
      {member.viaBracelet && (
        <View style={styles.braceletBadge}>
          <Text style={styles.braceletBadgeText}>⌚ bratara</Text>
        </View>
      )}
      <Text style={styles.playerLevel}>L{member.level}</Text>
    </Animated.View>
  );
}

// Slot gol — placeholder pulsing pt jucator inca nevenit.
function PendingRow({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 1000,
          delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });
  return (
    <Animated.View style={[styles.pendingRow, { opacity }]}>
      <View style={styles.pendingAvatar} />
      <Text style={styles.pendingLabel}>asteptam jucator</Text>
    </Animated.View>
  );
}

// Buton START — primary cu pulse subtil cand toata lumea e aici.
function LobbyStartButton({
  ready,
  fullReady,
  loading,
  onPress,
}: {
  ready: boolean;
  fullReady: boolean;
  loading: boolean;
  onPress: () => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!fullReady || !ready) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ready, fullReady, pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={!ready}
        style={({ pressed }) => [
          styles.primaryBtn,
          !ready && styles.primaryBtnDisabled,
          pressed && styles.btnPressed,
        ]}
      >
        <Text style={styles.primaryBtnText}>
          {loading ? 'Pornim...' : ready ? 'Porneste vanatoarea' : 'Asteptam jucatori'}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// 3 puncte care pulseaza in valuri.
function WaitingDots() {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(a, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  const dotOpacity = (offset: number) =>
    a.interpolate({
      inputRange: [0, 0.33, 0.66, 1],
      outputRange:
        offset === 0
          ? [0.3, 1, 0.5, 0.3]
          : offset === 1
            ? [0.3, 0.5, 1, 0.3]
            : [0.3, 0.5, 0.5, 1],
    });
  return (
    <View style={styles.waitingDotsRow}>
      {[0, 1, 2].map((i) => (
        <Animated.View key={i} style={[styles.waitingDot, { opacity: dotOpacity(i) }]} />
      ))}
    </View>
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

  // Foreground location — pipeline in 3 etape pt latenta minima:
  //   1. getLastKnownPositionAsync (instant, din cache OS) — dot-ul apare ACUM
  //   2. getCurrentPositionAsync Balanced (fix rapid ~1-2s, network-assisted)
  //   3. watchPositionAsync BestForNavigation (live update pt warmth/wedge)
  // Skip-uim etapa 2 daca cache-ul a returnat ceva valid.
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;

      // 1. Last known — instant. In practica intotdeauna exista o pozitie
      // cachuita de OS (orice app care a folosit GPS recent updateaza cache-ul).
      let haveRecentFix = false;
      try {
        const last = await Location.getLastKnownPositionAsync({
          maxAge: 60_000,
          requiredAccuracy: 200,
        });
        if (last && !cancelled) {
          setCoords({ lat: last.coords.latitude, lng: last.coords.longitude });
          haveRecentFix = true;
        }
      } catch {
        // ignore — cadem la pasul 2
      }
      if (cancelled) return;

      // 2. Fresh fix Balanced — doar daca cache n-a returnat nimic util.
      if (!haveRecentFix) {
        try {
          const fix = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (!cancelled) {
            setCoords({ lat: fix.coords.latitude, lng: fix.coords.longitude });
          }
        } catch {
          // fallback la watch
        }
      }
      if (cancelled) return;

      // 3. Live watch — high-accuracy pt warmth + halo recalculation.
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
      cancelled = true;
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

  lobbyScroll: { padding: 16, gap: 18, paddingBottom: 32 },

  section: { gap: 8 },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // Hero compact — un singur rand: numar mare + status + durata
  lobbyHeroCompact: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  lobbyHeroNum: {
    color: colors.text,
    fontSize: 52,
    fontWeight: '900',
    lineHeight: 56,
  },
  lobbyHeroNumLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  lobbyHeroDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  lobbyStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  lobbyStatusText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  lobbyHeroSub: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  // Player rows — compact, inline
  playerList: { gap: 4 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  playerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardAlt,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerName: { color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 },
  playerLevel: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },

  // Buton "Adauga cu bratara" — sub lista de jucatori, stil dashed ca sa se
  // citeasca drept slot de adaugare, nu jucator existent.
  braceletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
  },
  braceletBtnIcon: { fontSize: 20 },
  braceletBtnLabel: { color: colors.text, fontSize: 14, fontWeight: '800' },
  braceletBtnSub: { color: colors.textMuted, fontSize: 11, fontWeight: '600', marginTop: 1 },
  braceletBadge: {
    backgroundColor: colors.cardAlt,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
  },
  braceletBadgeText: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },

  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  pendingAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardAlt,
  },
  pendingLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },

  // Buton primary universal (folosit in lobby + naming + altele)
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },

  bottomActions: { gap: 10, marginTop: 4 },

  // Waiting (non-host)
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  waitingDotsRow: { flexDirection: 'row', gap: 6 },
  waitingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  waitingText: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },

  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.border,
  },

  // Team naming — minimalist, fara hero card
  namingScroll: { padding: 16, gap: 18, paddingBottom: 32 },
  namingHeader: { gap: 6, marginTop: 8 },
  namingTag: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  namingTitle: { color: colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.3 },
  namingSub: { color: colors.textMuted, fontSize: 14, lineHeight: 20, fontWeight: '600' },

  namingInputWrap: {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  namingInput: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    paddingVertical: 8,
  },
  namingCount: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textAlign: 'right' },

  // Member waiting — timer mare in centru
  memberScroll: { padding: 16, gap: 18, paddingBottom: 32 },
  memberTimerWrap: {
    alignItems: 'center',
    paddingVertical: 28,
    backgroundColor: colors.card,
    borderRadius: 18,
  },
  memberTimerNum: {
    color: colors.text,
    fontSize: 56,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  memberTimerLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 2,
  },
  memberLeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  memberLeaderLabel: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  memberLeaderLabelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  memberLeaderName: { color: colors.text, fontSize: 16, fontWeight: '800', flex: 1 },
  memberInstruction: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  memberLeaderRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 4,
  },
  memberLeaderRowMine: {
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  memberLeaderRowRank: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '900',
    width: 18,
  },
  memberLeaderRowName: { color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 },
  memberLeaderRowScore: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },

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
