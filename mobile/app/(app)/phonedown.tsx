import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useKeepAwakeSafe } from '../../src/lib/useKeepAwakeSafe';
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
import { usePhoneDownPlay, computeLiveDuration } from '../../src/phonedown/usePhoneDownPlay';
import { colors } from '../../src/theme/colors';
import {
  IconAlert,
  IconArrowLeft,
  IconBluetooth,
  IconCheck,
  IconClose,
  IconFlag,
  IconLock,
  IconPause,
  IconPlay,
  IconTrophy,
  IconUsers,
} from '../../src/ui/icons';

// Culori semantice locale pentru tema Phone Down (overlay peste tema globala).
const PD = {
  ink: '#0F1020',
  card: '#FFFFFF',
  cardBorder: 'rgba(15, 16, 32, 0.08)',
  cardMuted: 'rgba(15, 16, 32, 0.04)',
  text: '#0F1020',
  textMuted: 'rgba(15, 16, 32, 0.55)',
  accent: '#7C5CFC', // mov modern — Phone Down vibe
  accentSoft: 'rgba(124, 92, 252, 0.12)',
  success: '#1FA67A',
  danger: '#E74C5C',
  // Lock screen — OLED friendly (pur negru)
  lockBg: '#000000',
  lockSurface: 'rgba(255,255,255,0.06)',
  lockText: '#FFFFFF',
  lockTextMuted: 'rgba(255,255,255,0.55)',
  lockAccent: '#9F84FF',
};

export default function PhoneDownScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const { token } = useAuth();
  const initialSessionId = typeof params.sessionId === 'string' ? params.sessionId : undefined;

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    enabled: !!token,
  });

  const currentQuery = useQuery({
    queryKey: ['phonedown', 'current'],
    queryFn: getCurrent,
    enabled: !!token,
    refetchInterval: false,
  });

  const sessionId =
    initialSessionId ?? currentQuery.data?.session?.id ?? undefined;

  if (!token || !meQuery.data || currentQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safeLoading} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={PD.accent} />
      </SafeAreaView>
    );
  }

  if (!sessionId) {
    return <PreLobby />;
  }

  return <Session sessionId={sessionId} myUserId={meQuery.data.id} />;
}

// ---------- Pre-lobby ----------

function PreLobby() {
  const qc = useQueryClient();
  const { peers } = usePresence();
  const friendsQ = useQuery({ queryKey: ['friends'], queryFn: listFriends });
  const friends = friendsQ.data?.friends ?? [];

  const blePeerUserIds = useMemo(
    () => new Set(peers.filter((p) => p.userId && p.isFriend).map((p) => p.userId!)),
    [peers],
  );
  const inRange = friends.filter((f) => blePeerUserIds.has(f.user.id));
  const outOfRange = friends.filter((f) => !blePeerUserIds.has(f.user.id));

  const [selected, setSelected] = useState<Set<string>>(new Set());

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
      <Header title="Last Phone Standing" onBack={() => router.back()} />

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <IconLock size={28} color={PD.accent} />
        </View>
        <Text style={styles.heroTitle}>Lasa telefonul, castiga cufar</Text>
        <Text style={styles.heroSub}>
          Cine rezista mai mult fara sa atinga telefonul primeste rasplata.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        <SectionLabel>In raza acum · {inRange.length}</SectionLabel>
        {inRange.length === 0 ? (
          <EmptyHint>
            Nimeni in raza. Poti invita prieteni si vor primi notificare.
          </EmptyHint>
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
            <SectionLabel style={{ marginTop: 22 }}>Alti prieteni</SectionLabel>
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
        <PrimaryButton
          disabled={create.isPending}
          loading={create.isPending}
          onPress={() => create.mutate()}
          label={
            selected.size > 0
              ? `Creeaza lobby cu ${selected.size} ${selected.size === 1 ? 'prieten' : 'prieteni'}`
              : 'Creeaza lobby gol'
          }
        />
        <Text style={styles.footerHint}>Minim 2 jucatori pentru a porni.</Text>
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
        pressed && { opacity: 0.92 },
      ]}
    >
      <View style={[styles.avatarDot, { backgroundColor: friend.user.id.slice(-1).match(/[0-7]/) ? PD.accent : '#FFC36A' }]}>
        <Text style={styles.avatarDotText}>{friend.user.name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={styles.rowMain}>
        <Text style={styles.rowName}>{friend.user.name}</Text>
        <View style={styles.rowMetaLine}>
          <Text style={styles.rowMetaText}>Nivel {friend.user.level}</Text>
          {inRange && (
            <View style={styles.bleChip}>
              <IconBluetooth size={11} color={PD.accent} />
              <Text style={styles.bleChipText}>aproape</Text>
            </View>
          )}
        </View>
      </View>
      <View style={[styles.checkBox, checked && styles.checkBoxChecked]}>
        {checked && <IconCheck size={14} color="#FFFFFF" />}
      </View>
    </Pressable>
  );
}

// ---------- Session router ----------

function Session({ sessionId, myUserId }: { sessionId: string; myUserId: string }) {
  const qc = useQueryClient();
  // Citim status-ul din cache (poate fi inca undefined la primul mount). Cand
  // sesiunea e PLAYING activam low-power mode (polling 5s vs 1.5s) — economisim
  // baterie pe lockscreen. Socket-ul aduce oricum schimbarile importante.
  const cached = qc.getQueryData<PhoneDownSessionDto>(['phonedown', 'session', sessionId]);
  const lowPower = cached?.status === 'PLAYING';
  const play = usePhoneDownPlay({ sessionId, active: true, myUserId, lowPower });
  const session = play.session;

  useEffect(() => {
    if (session?.status === 'CANCELLED') {
      Alert.alert('Lobby anulat', 'Host-ul a parasit lobby-ul.', [
        { text: 'OK', onPress: () => router.replace('/(app)') },
      ]);
    }
  }, [session?.status]);

  if (play.sessionError && !session) {
    const err = play.sessionError;
    const status = err instanceof ApiError ? err.status : undefined;
    const code = err instanceof ApiError ? err.code : undefined;
    const message = err instanceof Error ? err.message : 'Nu pot incarca sesiunea';
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header title="Eroare" onBack={() => router.replace('/(app)')} />
        <View style={styles.errorWrap}>
          <View style={[styles.heroIcon, { backgroundColor: 'rgba(231,76,92,0.12)' }]}>
            <IconAlert size={28} color={PD.danger} />
          </View>
          <Text style={styles.errorTitle}>
            {status === 404
              ? 'Sesiunea nu exista'
              : status === 403
                ? 'Nu esti participant'
                : 'Nu pot incarca sesiunea'}
          </Text>
          <Text style={styles.errorSub}>
            {status ? `HTTP ${status}` : ''}
            {code ? ` · ${code}` : ''}
          </Text>
          <Text style={styles.errorMessage}>{message}</Text>
          <View style={{ gap: 10, alignSelf: 'stretch', marginTop: 22 }}>
            {status === 403 && (
              <PrimaryButton
                label="Intra in lobby"
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
              />
            )}
            <SecondaryButton
              label="Inapoi"
              onPress={() => {
                qc.removeQueries({ queryKey: ['phonedown', 'session', sessionId] });
                qc.invalidateQueries({ queryKey: ['phonedown', 'current'] });
                router.replace('/(app)/phonedown');
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safeLoading} edges={['top']}>
        <ActivityIndicator color={PD.accent} />
      </SafeAreaView>
    );
  }

  if (session.status === 'WAITING') {
    return <Lobby session={session} myUserId={myUserId} />;
  }
  if (session.status === 'ENDED' || session.status === 'CANCELLED') {
    return <Results session={session} myUserId={myUserId} />;
  }
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
      <Header title="Lobby" onBack={() => leaveMut.mutate()} />

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <IconUsers size={26} color={PD.accent} />
        </View>
        <Text style={styles.heroTitle}>
          {isHost ? 'Asteapta jucatorii sa intre' : 'Astepti host-ul sa porneasca'}
        </Text>
        <Text style={styles.heroSub}>
          {session.participants.length} {session.participants.length === 1 ? 'jucator' : 'jucatori'} in lobby
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        <SectionLabel>Jucatori</SectionLabel>
        {session.participants.map((p) => (
          <View key={p.id} style={styles.playerRow}>
            <View style={[styles.avatarDot, { backgroundColor: PD.accent }]}>
              <Text style={styles.avatarDotText}>{p.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={styles.rowMain}>
              <Text style={styles.rowName}>{p.name}</Text>
              <View style={styles.rowMetaLine}>
                {p.userId === session.hostId && (
                  <View style={[styles.tag, { backgroundColor: PD.accentSoft }]}>
                    <Text style={[styles.tagText, { color: PD.accent }]}>HOST</Text>
                  </View>
                )}
                {p.userId === myUserId && (
                  <View style={[styles.tag, { backgroundColor: 'rgba(31,166,122,0.12)' }]}>
                    <Text style={[styles.tagText, { color: PD.success }]}>TU</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        {!amIn ? (
          <PrimaryButton
            label="Intra in lobby"
            loading={joinMut.isPending}
            onPress={() => joinMut.mutate()}
          />
        ) : isHost ? (
          <PrimaryButton
            label={
              session.participants.length < 2
                ? 'Astept inca un jucator'
                : 'Porneste'
            }
            icon={
              session.participants.length >= 2 ? <IconPlay size={16} color="#FFFFFF" /> : null
            }
            disabled={startMut.isPending || session.participants.length < 2}
            loading={startMut.isPending}
            onPress={() => startMut.mutate()}
          />
        ) : (
          <View style={styles.waitingBox}>
            <ActivityIndicator color={PD.accent} />
            <Text style={styles.waitingText}>Astept host-ul...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ---------- Playing — LOCKSCREEN STYLE ----------

function Playing({
  play,
  session,
  myUserId,
}: {
  play: ReturnType<typeof usePhoneDownPlay>;
  session: PhoneDownSessionDto;
  myUserId: string;
}) {
  useKeepAwakeSafe('phonedown-play');
  const me = session.participants.find((p) => p.userId === myUserId);

  // Dimming mode — pe OLED, tot negru = lumini stinse → consum aproape zero.
  // Tap pe ecran trece intre full UI <-> doar timer dimmed. Default: full.
  const [dimmed, setDimmed] = useState(false);
  // Auto-dimming dupa 8s fara interactiune.
  useEffect(() => {
    if (dimmed) return;
    const id = setTimeout(() => setDimmed(true), 8000);
    return () => clearTimeout(id);
  }, [dimmed]);

  // Block hardware back complet — ecranul de blocare nu trebuie sa permita iesire
  // accidentala. User-ul foloseste butonul "Renunt" cu confirmare.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  if (play.phase === 'surrendered') {
    return <SurrenderedView session={session} myUserId={myUserId} />;
  }

  // Calcul live al duratelor — fara polling. Folosim serverNow ca anchor
  // pentru snapshot-ul curent, apoi extrapolam local la fiecare tick.
  const serverNowMs = new Date(session.serverNow).getTime();
  const sortedRaw = [...session.participants].sort(
    (a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0),
  );

  // Timer-ul ne il calculam local din phoneDownAt — nu mai pollam REST pentru asta.
  // Re-render izolat la 1s pe LiveTimer (nu pe tot ecranul) ca sa nu re-randam
  // si leaderboard-ul.
  const phoneDownAtMs = me?.phoneDownAt ? new Date(me.phoneDownAt).getTime() : null;

  return (
    <Pressable
      onPress={() => setDimmed((d) => !d)}
      style={styles.lockWrap}
    >
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <StatusBar hidden />
      <SafeAreaView style={styles.lockSafe} edges={['top', 'bottom']}>
        <View style={styles.lockTopRow}>
          <View style={styles.lockChip}>
            <IconLock size={12} color={PD.lockTextMuted} />
            <Text style={styles.lockChipText}>BLOCAT</Text>
          </View>
          {play.isInCall && (
            <View style={[styles.lockChip, { marginLeft: 8 }]}>
              <View style={styles.lockMeDot} />
              <Text style={styles.lockChipText}>IN APEL</Text>
            </View>
          )}
        </View>

        <View style={styles.lockCenter}>
          <LiveTimer
            phoneDownAtMs={phoneDownAtMs}
            fallbackMs={play.myDurationMs}
            dimmed={dimmed}
          />
          {!dimmed && (
            <>
              <Text style={styles.lockHint}>Nu deschide app-ul si nu deblochea telefonul</Text>
              {me && (
                <View style={styles.lockMeRow}>
                  <View style={styles.lockMeDot} />
                  <Text style={styles.lockMeText}>
                    {me.rank ? `Locul ${me.rank}` : 'Activ'}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {!dimmed && (
          <LiveLeaderboard
            participants={sortedRaw}
            serverNowMs={serverNowMs}
            myUserId={myUserId}
          />
        )}

        {dimmed && <View style={{ flex: 1 }} />}

        <View style={styles.lockFooter}>
          {!dimmed && (
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
              style={({ pressed }) => [styles.lockGiveUp, pressed && { opacity: 0.5 }]}
            >
              <IconFlag size={14} color={PD.lockTextMuted} />
              <Text style={styles.lockGiveUpText}>Renunt</Text>
            </Pressable>
          )}
          {dimmed && (
            <Text style={styles.lockDimHint}>Apasa pe ecran pentru a-l reactiva</Text>
          )}
        </View>
      </SafeAreaView>
    </Pressable>
  );
}

// Leaderboard izolat — re-render la 1s din clock local, fara polling REST.
// Durations live ale celorlalti participanti se calculeaza din serverNow +
// status-ul lor (ACTIVE → cresc, PAUSED/SURRENDERED → freeze).
function LiveLeaderboard({
  participants,
  serverNowMs,
  myUserId,
}: {
  participants: PhoneDownParticipantDto[];
  serverNowMs: number;
  myUserId: string;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const nowMs = Date.now();
  const enriched = participants
    .map((p) => ({
      p,
      live: computeLiveDuration(p, serverNowMs, nowMs),
    }))
    .sort((a, b) => b.live - a.live);

  return (
    <View style={styles.lockLeaderboard}>
      {enriched.slice(0, 4).map(({ p, live }, idx) => (
        <LockLeaderboardRow
          key={p.id}
          participant={p}
          liveDurationMs={live}
          index={idx}
          isMe={p.userId === myUserId}
        />
      ))}
      {enriched.length > 4 && (
        <Text style={styles.lockMoreText}>+ {enriched.length - 4} jucatori</Text>
      )}
    </View>
  );
}

// Timer izolat — singurul componenta care re-randa la 1s. Restul ecranului
// nu se atinge → minim de munca pentru GPU. In modul dimmed, refresh-ul scade
// la 5s (suficient pentru valoarea aproximativa, fara consum vizual).
function LiveTimer({
  phoneDownAtMs,
  fallbackMs,
  dimmed,
}: {
  phoneDownAtMs: number | null;
  fallbackMs: number;
  dimmed?: boolean;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!phoneDownAtMs) return;
    const id = setInterval(() => setTick((t) => t + 1), dimmed ? 5000 : 1000);
    return () => clearInterval(id);
  }, [phoneDownAtMs, dimmed]);
  const ms = phoneDownAtMs
    ? Math.max(0, Date.now() - phoneDownAtMs)
    : fallbackMs;
  return (
    <Text
      style={[styles.lockTimer, dimmed && { color: 'rgba(255,255,255,0.35)' }]}
    >
      {formatDuration(ms)}
    </Text>
  );
}

function LockLeaderboardRow({
  participant,
  liveDurationMs,
  index,
  isMe,
}: {
  participant: PhoneDownParticipantDto;
  liveDurationMs: number;
  index: number;
  isMe: boolean;
}) {
  return (
    <View style={[styles.lockLbRow, isMe && styles.lockLbRowMe]}>
      <Text style={[styles.lockLbIndex, isMe && { color: PD.lockAccent }]}>
        {String(index + 1).padStart(2, '0')}
      </Text>
      <Text style={[styles.lockLbName, isMe && { color: '#FFFFFF' }]} numberOfLines={1}>
        {participant.name}
        {isMe ? ' · tu' : ''}
      </Text>
      <Text style={[styles.lockLbDur, isMe && { color: '#FFFFFF' }]}>
        {formatDuration(liveDurationMs)}
      </Text>
      {participant.status === 'PAUSED' && (
        <IconPause size={12} color={PD.lockTextMuted} />
      )}
      {participant.status === 'SURRENDERED' && (
        <IconClose size={12} color={PD.lockTextMuted} />
      )}
    </View>
  );
}

function SurrenderedView({
  session,
  myUserId,
}: {
  session: PhoneDownSessionDto;
  myUserId: string;
}) {
  const isEnded = session.status === 'ENDED';
  if (isEnded) {
    return <Results session={session} myUserId={myUserId} />;
  }
  const me = session.participants.find((p) => p.userId === myUserId);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.surrenderWrap}>
        <View style={[styles.heroIcon, { backgroundColor: 'rgba(15,16,32,0.06)' }]}>
          <IconFlag size={26} color={PD.text} />
        </View>
        <Text style={styles.heroTitle}>Ai iesit din concurs</Text>
        <Text style={styles.bigTimer}>{formatDuration(me?.durationMs ?? 0)}</Text>
        <Text style={styles.heroSub}>
          Astept sa termine ceilalti ca sa-ti dau cufarul.
        </Text>
        <SecondaryButton
          label="Asteapta in fundal"
          onPress={() => router.replace('/(app)')}
          style={{ marginTop: 22 }}
        />
      </View>
    </SafeAreaView>
  );
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
  const winner = me?.status === 'WINNER';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header title="Rezultate" onBack={() => router.replace('/(app)')} closeStyle />

      <View style={styles.hero}>
        <View
          style={[
            styles.heroIcon,
            winner ? { backgroundColor: 'rgba(255,195,106,0.18)' } : null,
          ]}
        >
          <IconTrophy size={28} color={winner ? '#E89A2C' : PD.accent} />
        </View>
        <Text style={styles.heroTitle}>
          {winner ? 'Ai castigat!' : `Locul ${me?.rank ?? '?'}`}
        </Text>
        <Text style={styles.bigTimer}>{formatDuration(me?.durationMs ?? 0)}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollBody}>
        <SectionLabel>Clasament</SectionLabel>
        {ranked.map((p) => (
          <View
            key={p.id}
            style={[
              styles.resultRow,
              p.userId === myUserId && styles.resultRowMe,
            ]}
          >
            <View style={styles.rankBadge}>
              <Text style={styles.rankBadgeText}>{p.rank}</Text>
            </View>
            <View style={styles.rowMain}>
              <Text style={styles.rowName}>{p.name}</Text>
              <Text style={styles.rowMetaText}>{formatDuration(p.durationMs ?? 0)}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label="Vezi cufar"
          onPress={() => router.replace('/(app)/chests')}
        />
      </View>
    </SafeAreaView>
  );
}

// ---------- Shared components ----------

function Header({
  title,
  onBack,
  closeStyle,
}: {
  title: string;
  onBack: () => void;
  closeStyle?: boolean;
}) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.iconButton}>
        {closeStyle ? (
          <IconClose size={22} color={PD.text} />
        ) : (
          <IconArrowLeft size={22} color={PD.text} />
        )}
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 44 }} />
    </View>
  );
}

function SectionLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return <Text style={[styles.sectionLabel, style]}>{children}</Text>;
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <Text style={styles.emptyHint}>{children}</Text>;
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryBtn,
        (disabled || loading) && { opacity: 0.55 },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <View style={styles.primaryBtnContent}>
          {icon}
          <Text style={styles.primaryBtnText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryBtn,
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      <Text style={styles.secondaryBtnText}>{label}</Text>
    </Pressable>
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

// ---------- Styles ----------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  safeLoading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  headerTitle: { color: PD.text, fontSize: 16, fontWeight: '800' },

  hero: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 24,
    gap: 8,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: PD.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  heroTitle: {
    color: PD.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  heroSub: {
    color: PD.textMuted,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  bigTimer: {
    color: PD.text,
    fontSize: 44,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    marginTop: 8,
  },

  scrollBody: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 8 },
  sectionLabel: {
    color: PD.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  emptyHint: {
    color: PD.textMuted,
    fontSize: 13,
    fontWeight: '500',
    padding: 16,
    textAlign: 'center',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PD.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: PD.cardBorder,
    gap: 12,
  },
  rowChecked: {
    borderColor: PD.accent,
    backgroundColor: PD.accentSoft,
  },
  rowMain: { flex: 1, gap: 3 },
  rowName: { color: PD.text, fontSize: 15, fontWeight: '700' },
  rowMetaLine: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  rowMetaText: { color: PD.textMuted, fontSize: 12, fontWeight: '600' },

  avatarDot: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarDotText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },

  bleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PD.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  bleChipText: { color: PD.accent, fontSize: 11, fontWeight: '700' },

  checkBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: PD.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxChecked: { backgroundColor: PD.accent, borderColor: PD.accent },

  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PD.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: PD.cardBorder,
    gap: 12,
  },

  footer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: PD.accent,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },

  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PD.cardBorder,
    backgroundColor: 'transparent',
  },
  secondaryBtnText: { color: PD.text, fontSize: 14, fontWeight: '700' },

  footerHint: { color: PD.textMuted, fontSize: 11, textAlign: 'center' },

  waitingBox: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  waitingText: { color: PD.textMuted, fontSize: 14, fontWeight: '700' },

  // Lock screen
  lockWrap: { flex: 1, backgroundColor: PD.lockBg },
  lockSafe: { flex: 1, paddingHorizontal: 20 },
  lockTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  lockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: PD.lockSurface,
  },
  lockChipText: {
    color: PD.lockTextMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  lockCenter: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  lockTimer: {
    color: PD.lockText,
    fontSize: 72,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -2,
  },
  lockHint: {
    color: PD.lockTextMuted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  lockMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  lockMeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PD.lockAccent,
  },
  lockMeText: { color: PD.lockAccent, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  lockLeaderboard: {
    flex: 1,
    paddingTop: 8,
    gap: 4,
  },
  lockLbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  lockLbRowMe: { backgroundColor: 'rgba(159,132,255,0.12)' },
  lockLbIndex: {
    color: PD.lockTextMuted,
    fontSize: 12,
    fontWeight: '800',
    minWidth: 22,
    fontVariant: ['tabular-nums'],
  },
  lockLbName: { color: PD.lockTextMuted, fontSize: 14, fontWeight: '700', flex: 1 },
  lockLbDur: {
    color: PD.lockTextMuted,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  lockMoreText: {
    color: PD.lockTextMuted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    paddingTop: 8,
    opacity: 0.6,
  },

  lockFooter: { paddingBottom: 8, alignItems: 'center' },
  lockGiveUp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
  },
  lockGiveUpText: { color: PD.lockTextMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  lockDimHint: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Error
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 6,
  },
  errorTitle: {
    color: PD.text,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 12,
    textAlign: 'center',
  },
  errorSub: { color: PD.textMuted, fontSize: 12, fontWeight: '700' },
  errorMessage: {
    color: PD.textMuted,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },

  // Surrender
  surrenderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 6,
  },

  // Results
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PD.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: PD.cardBorder,
    gap: 14,
  },
  resultRowMe: { borderColor: PD.accent, backgroundColor: PD.accentSoft },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PD.cardMuted,
  },
  rankBadgeText: {
    color: PD.text,
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
});
