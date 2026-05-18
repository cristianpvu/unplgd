import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useKeepAwake } from 'expo-keep-awake';
import { useAuth } from '../../src/lib/auth';
import { ApiError } from '../../src/api/client';
import { getMe } from '../../src/api/me';
import { listFriends, type Friend } from '../../src/api/friends';
import {
  createLobby,
  getCurrent,
  joinSession,
  leaveSession,
  startSession,
  type PhoneDownParticipantDto,
  type PhoneDownSessionDto,
} from '../../src/api/phonedown';
import { usePresence } from '../../src/ble/usePresence';
import { usePhoneDownPlay } from '../../src/phonedown/usePhoneDownPlay';
import { PHONE_DOWN_COUNTDOWN_MS } from '../../src/phonedown/constants';
import { colors } from '../../src/theme/colors';

// Ecran central Phone Down. Faze: pre-lobby (alegere prieteni BLE), lobby
// (asteptam joins), countdown, play (face-down), pauza apel, rezultate.
//
// State machine-ul live e in usePhoneDownPlay; ecranul doar selecteaza
// componenta de afisat. Detectia face-down + apelurile sunt orchestrate de
// hook, nu de UI.

export default function PhoneDownScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const { token } = useAuth();
  const initialSessionId = typeof params.sessionId === 'string' ? params.sessionId : undefined;

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    enabled: !!token,
  });

  // Daca exista deja o sesiune activa pentru user, intram in ea.
  const currentQuery = useQuery({
    queryKey: ['phonedown', 'current'],
    queryFn: getCurrent,
    enabled: !!token,
    refetchInterval: false,
  });

  // Sesiunea curenta = cea din URL > sesiunea activa pe server.
  const sessionId =
    initialSessionId ?? currentQuery.data?.session?.id ?? undefined;

  if (!token || !meQuery.data || currentQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safeLoading} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (!sessionId) {
    return <PreLobby />;
  }

  return <Session sessionId={sessionId} myUserId={meQuery.data.id} />;
}

// ---------- Pre-lobby: alege prieteni si creeaza sesiunea ----------

function PreLobby() {
  const qc = useQueryClient();
  const { peers } = usePresence();
  const friendsQ = useQuery({ queryKey: ['friends'], queryFn: listFriends });
  const friends = friendsQ.data?.friends ?? [];

  // Prietenii din raza BLE — facem cross-reference cu friendsQ pentru name +
  // avatar + level (presence-ul are doar name brut).
  const blePeerUserIds = useMemo(
    () => new Set(peers.filter((p) => p.userId && p.isFriend).map((p) => p.userId!)),
    [peers],
  );
  const inRange = friends.filter((f) => blePeerUserIds.has(f.user.id));
  const outOfRange = friends.filter((f) => !blePeerUserIds.has(f.user.id));

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Pre-bifam toti prietenii in raza la mount — flow optim este "porneste
  // jocul cu cei vizibili". User-ul poate sa debifeze sau sa adauge alti
  // prieteni (chiar daca nu sunt in raza — pot intra dupa, daca au app-ul).
  useEffect(() => {
    if (inRange.length > 0 && selected.size === 0) {
      setSelected(new Set(inRange.map((f) => f.user.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inRange.length]);

  const create = useMutation({
    mutationFn: () => createLobby(Array.from(selected)),
    onSuccess: (session) => {
      qc.setQueryData(['phonedown', 'session', session.id], session);
      qc.invalidateQueries({ queryKey: ['phonedown', 'current'] });
      router.replace({ pathname: '/(app)/phonedown', params: { sessionId: session.id } });
    },
    onError: (e: any) => Alert.alert('Eroare', e?.message ?? 'Nu am putut crea sesiunea'),
  });

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>Phone Down</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroEmoji}>📵</Text>
        <Text style={styles.heroTitle}>Cine sta cel mai mult fara telefon?</Text>
        <Text style={styles.heroSub}>
          Pune telefonul cu fata in jos. Cel care rezista mai mult castiga un cufar mai bun.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        <Text style={styles.sectionTitle}>In raza BLE ({inRange.length})</Text>
        {inRange.length === 0 ? (
          <Text style={styles.emptyHint}>
            Nimeni in raza acum. Poti sa inviti oricum prietenii si vor primi notificare.
          </Text>
        ) : (
          inRange.map((f) => (
            <FriendRow
              key={f.user.id}
              friend={f}
              inRange
              checked={selected.has(f.user.id)}
              onToggle={() => toggle(f.user.id)}
            />
          ))
        )}

        {outOfRange.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
              Alti prieteni
            </Text>
            {outOfRange.map((f) => (
              <FriendRow
                key={f.user.id}
                friend={f}
                inRange={false}
                checked={selected.has(f.user.id)}
                onToggle={() => toggle(f.user.id)}
              />
            ))}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={create.isPending}
          onPress={() => create.mutate()}
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && { opacity: 0.85 },
            create.isPending && { opacity: 0.6 },
          ]}
        >
          {create.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {selected.size > 0
                ? `Creeaza lobby cu ${selected.size} ${selected.size === 1 ? 'prieten' : 'prieteni'}`
                : 'Creeaza lobby gol'}
            </Text>
          )}
        </Pressable>
        <Text style={styles.footerHint}>
          Min. 2 jucatori pentru a porni. Maxim — fara limita.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function FriendRow({
  friend,
  inRange,
  checked,
  onToggle,
}: {
  friend: Friend;
  inRange: boolean;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.row,
        checked && styles.rowChecked,
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={styles.rowLeft}>
        <Text style={styles.rowName}>{friend.user.name}</Text>
        <View style={styles.rowMeta}>
          <Text style={styles.metaItem}>Lvl {friend.user.level}</Text>
          {inRange && (
            <View style={styles.bleBadge}>
              <Text style={styles.bleBadgeText}>BLE</Text>
            </View>
          )}
        </View>
      </View>
      <View style={[styles.checkBox, checked && styles.checkBoxChecked]}>
        {checked && <Text style={styles.checkMark}>✓</Text>}
      </View>
    </Pressable>
  );
}

// ---------- Session: lobby + countdown + play + result ----------

function Session({ sessionId, myUserId }: { sessionId: string; myUserId: string }) {
  const qc = useQueryClient();
  const play = usePhoneDownPlay({ sessionId, active: true, myUserId });
  const session = play.session;

  // Daca sesiunea s-a anulat (CANCELLED inainte de start), iesim.
  useEffect(() => {
    if (session?.status === 'CANCELLED') {
      Alert.alert('Lobby anulat', 'Host-ul a parasit lobby-ul.', [
        { text: 'OK', onPress: () => router.replace('/(app)') },
      ]);
    }
  }, [session?.status]);

  // Daca getSession a esuat (404/403/etc), aratam un ecran de eroare cu
  // detalii in loc sa redirectionam tacut — ne ajuta sa diagnosticam.
  if (play.sessionError && !session) {
    const err = play.sessionError;
    const status = err instanceof ApiError ? err.status : undefined;
    const code = err instanceof ApiError ? err.code : undefined;
    const message =
      err instanceof Error ? err.message : 'Nu pot incarca sesiunea';
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <Pressable
            onPress={() => router.replace('/(app)')}
            hitSlop={12}
            style={styles.backBtn}
          >
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.title}>Eroare sesiune</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={[styles.fullCenter, { backgroundColor: colors.bg }]}>
          <Text style={styles.bigEmoji}>⚠️</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {status === 404
              ? 'Sesiunea nu exista'
              : status === 403
                ? 'Nu esti participant la sesiune'
                : 'Nu pot incarca sesiunea'}
          </Text>
          <Text style={[styles.heroSub, { color: colors.textMuted }]}>
            {status ? `HTTP ${status}` : ''}
            {code ? ` · ${code}` : ''}
          </Text>
          <Text style={[styles.heroSub, { color: colors.textMuted, marginTop: 8 }]}>
            {message}
          </Text>
          {status === 403 && (
            <Pressable
              onPress={async () => {
                try {
                  const s = await joinSession(sessionId);
                  qc.setQueryData(['phonedown', 'session', s.id], s);
                  qc.invalidateQueries({ queryKey: ['phonedown', 'current'] });
                } catch (e) {
                  const m =
                    e instanceof ApiError
                      ? e.code === 'lobby_closed'
                        ? 'Lobby-ul nu mai e disponibil.'
                        : e.message
                      : 'Nu pot intra acum.';
                  Alert.alert('Nu pot intra', m);
                }
              }}
              style={({ pressed }) => [
                styles.primaryBtn,
                { marginTop: 20, paddingHorizontal: 32 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.primaryBtnText}>Intra in lobby</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => {
              qc.removeQueries({ queryKey: ['phonedown', 'session', sessionId] });
              qc.invalidateQueries({ queryKey: ['phonedown', 'current'] });
              router.replace('/(app)/phonedown');
            }}
            style={({ pressed }) => [
              status === 403 ? styles.secondaryBtnLight : styles.primaryBtn,
              { marginTop: status === 403 ? 12 : 20, paddingHorizontal: 32 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text
              style={
                status === 403 ? styles.secondaryBtnTextLight : styles.primaryBtnText
              }
            >
              Inapoi la pre-lobby
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safeLoading} edges={['top']}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (session.status === 'WAITING') {
    return <Lobby session={session} myUserId={myUserId} />;
  }
  if (session.status === 'ENDED' || session.status === 'CANCELLED') {
    return <Results session={session} myUserId={myUserId} />;
  }
  // PLAYING — joc activ.
  return <Playing play={play} session={session} myUserId={myUserId} />;
}

// ---------- Lobby ----------

function Lobby({
  session,
  myUserId,
}: {
  session: PhoneDownSessionDto;
  myUserId: string;
}) {
  const qc = useQueryClient();
  const isHost = session.hostId === myUserId;
  // socket join se face deja in usePhoneDownPlay (montat in Session).

  const startMut = useMutation({
    mutationFn: () => startSession(session.id),
    onSuccess: (s) => qc.setQueryData(['phonedown', 'session', s.id], s),
    onError: (e: any) => Alert.alert('Eroare', e?.message ?? 'Nu am putut porni'),
  });
  const leaveMut = useMutation({
    mutationFn: () => leaveSession(session.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['phonedown', 'current'] });
      router.replace('/(app)');
    },
  });
  const joinMut = useMutation({
    mutationFn: () => joinSession(session.id),
    onSuccess: (s) => qc.setQueryData(['phonedown', 'session', s.id], s),
  });

  const amIn = session.participants.some((p) => p.userId === myUserId);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => leaveMut.mutate()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>Lobby</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.lobbyHero}>
        <Text style={styles.heroEmoji}>📵</Text>
        <Text style={styles.heroTitle}>
          {isHost ? 'Tu esti host' : 'Astepti host-ul sa porneasca'}
        </Text>
        <Text style={styles.heroSub}>
          {session.participants.length} {session.participants.length === 1 ? 'jucator' : 'jucatori'} in lobby
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        <Text style={styles.sectionTitle}>Jucatori</Text>
        {session.participants.map((p) => (
          <View key={p.id} style={styles.playerRow}>
            <View style={styles.playerLeft}>
              <Text style={styles.playerName}>{p.name}</Text>
              {p.userId === session.hostId && (
                <View style={styles.hostBadge}>
                  <Text style={styles.hostBadgeText}>HOST</Text>
                </View>
              )}
              {p.userId === myUserId && (
                <View style={[styles.hostBadge, { backgroundColor: colors.secondary }]}>
                  <Text style={styles.hostBadgeText}>TU</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        {!amIn ? (
          <Pressable
            disabled={joinMut.isPending}
            onPress={() => joinMut.mutate()}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.primaryBtnText}>Intra in lobby</Text>
          </Pressable>
        ) : isHost ? (
          <Pressable
            disabled={startMut.isPending || session.participants.length < 2}
            onPress={() => startMut.mutate()}
            style={({ pressed }) => [
              styles.primaryBtn,
              session.participants.length < 2 && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
          >
            {startMut.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {session.participants.length < 2
                  ? 'Astept inca un jucator'
                  : 'Porneste runda'}
              </Text>
            )}
          </Pressable>
        ) : (
          <View style={styles.waitingBox}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.waitingText}>Astept host-ul...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ---------- Playing ----------

function Playing({
  play,
  session,
  myUserId,
}: {
  play: ReturnType<typeof usePhoneDownPlay>;
  session: PhoneDownSessionDto;
  myUserId: string;
}) {
  useKeepAwake('phonedown-play');
  const me = session.participants.find((p) => p.userId === myUserId);

  const sorted = [...session.participants].sort(
    (a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0),
  );

  // Countdown vizual cand server-ul a dat startedAt dar phoneDownAt-ul e
  // in viitor. Calculam din me.phoneDownAt sa fim sincronizati cu serverul.
  const phoneDownAt = me?.phoneDownAt ? new Date(me.phoneDownAt).getTime() : null;
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const countdownSec = phoneDownAt
    ? Math.max(0, Math.ceil((phoneDownAt - nowMs) / 1000))
    : null;

  // Ecran de countdown — instructiune mare cu numarator pana la 0.
  if (play.phase === 'countdown' && countdownSec !== null) {
    return <CountdownView seconds={countdownSec} />;
  }

  // Telefonul ridicat dupa start → server-ul ne-a deja inregistrat surrender.
  if (play.phase === 'surrendered') {
    return <PostSurrenderView session={session} myUserId={myUserId} />;
  }

  // Telefonul in pauza pentru apel.
  if (play.phase === 'paused') {
    return <PausedView duration={play.myDurationMs} />;
  }

  // Asteptam ca user-ul sa intoarca telefonul cu fata in jos.
  if (play.phase === 'waitingDown') {
    return <WaitingDownView />;
  }

  // Joc activ — face-down, ceasul curge. Afisam timer mare + clasament live.
  return (
    <View style={styles.playWrap}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <SafeAreaView style={styles.playSafe} edges={['top', 'bottom']}>
        <View style={styles.playHeader}>
          <View style={styles.lockBadge}>
            <Text style={styles.lockBadgeText}>📵 TELEFON JOS</Text>
          </View>
        </View>

        <View style={styles.playCenter}>
          <Text style={styles.playTimer}>{formatDuration(play.myDurationMs)}</Text>
          <Text style={styles.playHint}>
            Tine-l cu fata in jos. Cand il ridici, iesi din concurs.
          </Text>
        </View>

        <View style={styles.leaderboard}>
          <Text style={styles.leaderboardTitle}>Clasament live</Text>
          {sorted.map((p, idx) => (
            <LeaderboardRow
              key={p.id}
              participant={p}
              index={idx}
              isMe={p.userId === myUserId}
            />
          ))}
        </View>

        <View style={styles.playFooter}>
          <Pressable
            onPress={() =>
              Alert.alert(
                'Renunti?',
                'Iesi din concurs. Vei primi cufar in functie de cat ai rezistat.',
                [
                  { text: 'Inapoi', style: 'cancel' },
                  {
                    text: 'Renunt',
                    style: 'destructive',
                    onPress: () => void play.surrender(),
                  },
                ],
              )
            }
            style={({ pressed }) => [styles.giveUpBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.giveUpText}>Renunt</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function CountdownView({ seconds }: { seconds: number }) {
  const scale = useState(new Animated.Value(1))[0];
  useEffect(() => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.4,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [seconds, scale]);

  return (
    <View style={styles.fullCenter}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <Text style={styles.countdownHint}>Pregatiti-va sa puneti telefonul jos</Text>
      <Animated.Text style={[styles.countdownNumber, { transform: [{ scale }] }]}>
        {seconds}
      </Animated.Text>
      <Text style={styles.countdownSub}>
        Cand ajunge la 0, intoarce-l cu fata pe masa
      </Text>
    </View>
  );
}

function WaitingDownView() {
  return (
    <View style={styles.fullCenter}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <Text style={styles.bigEmoji}>📲</Text>
      <Text style={styles.waitingDownTitle}>Pune telefonul jos</Text>
      <Text style={styles.waitingDownSub}>
        Intoarce-l cu fata pe masa ca sa pornim ceasul. Daca dureaza prea mult, iesi din concurs.
      </Text>
    </View>
  );
}

function PausedView({ duration }: { duration: number }) {
  return (
    <View style={[styles.fullCenter, { backgroundColor: '#2D2A4A' }]}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <Text style={styles.bigEmoji}>📞</Text>
      <Text style={[styles.pausedTitle]}>Pauza apel</Text>
      <Text style={styles.pausedTimer}>{formatDuration(duration)}</Text>
      <Text style={styles.pausedSub}>
        Ceasul s-a oprit. Va reporni automat cand termini apelul.
      </Text>
    </View>
  );
}

function PostSurrenderView({
  session,
  myUserId,
}: {
  session: PhoneDownSessionDto;
  myUserId: string;
}) {
  // Dupa ce am facut surrender astept ca toata sesiunea sa se incheie pentru
  // a vedea cufarul. Daca sesiunea nu e ENDED inca, afisez "astepti finalul".
  const isEnded = session.status === 'ENDED';
  if (!isEnded) {
    const me = session.participants.find((p) => p.userId === myUserId);
    return (
      <View style={[styles.fullCenter, { backgroundColor: '#2D2A4A' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.bigEmoji}>⏳</Text>
        <Text style={styles.pausedTitle}>Ai iesit din concurs</Text>
        <Text style={styles.pausedTimer}>{formatDuration(me?.durationMs ?? 0)}</Text>
        <Text style={styles.pausedSub}>
          Astept sa termine ceilalti ca sa-ti dau cufarul.
        </Text>
        <Pressable
          onPress={() => router.replace('/(app)')}
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.secondaryBtnText}>Asteapta in fundal</Text>
        </Pressable>
      </View>
    );
  }
  return <Results session={session} myUserId={myUserId} />;
}

// ---------- Results ----------

function Results({
  session,
  myUserId,
}: {
  session: PhoneDownSessionDto;
  myUserId: string;
}) {
  const me = session.participants.find((p) => p.userId === myUserId);
  const ranked = [...session.participants]
    .filter((p) => p.rank !== null)
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/(app)')} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>×</Text>
        </Pressable>
        <Text style={styles.title}>Rezultate</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroEmoji}>{me?.status === 'WINNER' ? '🏆' : '📵'}</Text>
        <Text style={styles.heroTitle}>
          {me?.status === 'WINNER' ? 'Ai castigat!' : `Locul ${me?.rank ?? '?'}`}
        </Text>
        <Text style={styles.heroSub}>
          Ai stat {formatDuration(me?.durationMs ?? 0)} fara telefon
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        <Text style={styles.sectionTitle}>Clasament</Text>
        {ranked.map((p) => (
          <View
            key={p.id}
            style={[
              styles.resultRow,
              p.userId === myUserId && styles.resultRowMe,
            ]}
          >
            <Text style={styles.resultRank}>
              {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`}
            </Text>
            <View style={styles.rowLeft}>
              <Text style={styles.rowName}>{p.name}</Text>
              <Text style={styles.metaItem}>{formatDuration(p.durationMs ?? 0)}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => router.replace('/(app)/chests')}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.primaryBtnText}>Vezi cufar</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ---------- Helpers ----------

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function LeaderboardRow({
  participant,
  index,
  isMe,
}: {
  participant: PhoneDownParticipantDto;
  index: number;
  isMe: boolean;
}) {
  const status = participant.status;
  return (
    <View style={[styles.lbRow, isMe && styles.lbRowMe]}>
      <Text style={styles.lbIndex}>{index + 1}.</Text>
      <Text style={styles.lbName} numberOfLines={1}>
        {participant.name}
        {isMe && ' (tu)'}
      </Text>
      <Text style={styles.lbDuration}>{formatDuration(participant.durationMs ?? 0)}</Text>
      {status === 'PAUSED' && <Text style={styles.lbStatus}>⏸</Text>}
      {status === 'SURRENDERED' && <Text style={styles.lbStatus}>✗</Text>}
    </View>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  safeLoading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

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

  heroCard: {
    marginHorizontal: 20,
    padding: 20,
    backgroundColor: colors.card,
    borderRadius: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroEmoji: { fontSize: 48 },
  heroTitle: { color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  heroSub: { color: colors.textMuted, fontSize: 13, fontWeight: '600', textAlign: 'center' },

  lobbyHero: {
    marginHorizontal: 20,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },

  scrollBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 10 },
  sectionTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingBottom: 6,
  },
  emptyHint: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    padding: 16,
    textAlign: 'center',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  rowChecked: { borderColor: colors.accent, backgroundColor: '#FFF4EE' },
  rowLeft: { flex: 1, gap: 4 },
  rowName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowMeta: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  metaItem: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  bleBadge: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  bleBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  checkBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  playerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  playerName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  hostBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  hostBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  footer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 999,
    borderColor: 'rgba(255,255,255,0.4)',
    borderWidth: 1,
  },
  secondaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  secondaryBtnLight: {
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  secondaryBtnTextLight: { color: colors.text, fontSize: 15, fontWeight: '700' },
  footerHint: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
  waitingBox: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  waitingText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },

  // Playing
  playWrap: { flex: 1, backgroundColor: '#1A1730' },
  playSafe: { flex: 1, paddingHorizontal: 20 },
  playHeader: { alignItems: 'center', paddingTop: 8 },
  lockBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  lockBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  playCenter: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  playTimer: {
    color: '#FFFFFF',
    fontSize: 64,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  playHint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  leaderboard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  leaderboardTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  lbRowMe: { backgroundColor: 'rgba(255,122,89,0.18)' },
  lbIndex: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '700', minWidth: 24 },
  lbName: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', flex: 1 },
  lbDuration: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  lbStatus: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginLeft: 4 },
  playFooter: { paddingBottom: 12, alignItems: 'center' },
  giveUpBtn: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
    borderColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
  },
  giveUpText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700' },

  // Full-screen states
  fullCenter: {
    flex: 1,
    backgroundColor: '#1A1730',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  bigEmoji: { fontSize: 64 },
  countdownHint: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '700' },
  countdownNumber: { color: '#FFFFFF', fontSize: 128, fontWeight: '900', lineHeight: 140 },
  countdownSub: { color: 'rgba(255,255,255,0.55)', fontSize: 13, textAlign: 'center' },

  waitingDownTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  waitingDownSub: { color: 'rgba(255,255,255,0.65)', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  pausedTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  pausedTimer: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  pausedSub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center' },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  resultRowMe: { borderColor: colors.accent },
  resultRank: { fontSize: 22, minWidth: 36 },
});

// PHONE_DOWN_COUNTDOWN_MS importat doar pentru consistenta de constanta cu
// hook-ul de play. Daca devine necesar la randare (ex. ASCII bar), aici e.
void PHONE_DOWN_COUNTDOWN_MS;
