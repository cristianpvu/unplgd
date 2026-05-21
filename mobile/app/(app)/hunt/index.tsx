import { useEffect, useRef, useState } from 'react';
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
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { SvgXml } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  listParksNearby,
  createSession,
  listLobbiesNearby,
  joinSession,
  devQuickHere,
  getDevEnabled,
  type HuntPark,
  type HuntLobbyNearbyItem,
} from '../../../src/api/hunt';
import { presence } from '../../../src/ble/presence';
import { colors } from '../../../src/theme/colors';

const DEV_MODE_KEY = 'hunt:devMode';

const DURATION_OPTIONS: { sec: number; label: string }[] = [
  { sec: 900, label: '15 min' },
  { sec: 1800, label: '30 min' },
  { sec: 2700, label: '45 min' },
];

export default function HuntEntry() {
  const qc = useQueryClient();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [selectedParkId, setSelectedParkId] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(1800);
  const [bleTokens, setBleTokens] = useState<string[]>([]);
  const [devMode, setDevMode] = useState(false);

  // Verific daca server-ul are HUNT_DEV_MODE=true. Daca nu, toggle-ul nu
  // apare deloc — protectie ca user obisnuit pe productie sa nu-l vada.
  const devEnabledQuery = useQuery({
    queryKey: ['hunt', 'dev-enabled'],
    queryFn: getDevEnabled,
    staleTime: 1000 * 60 * 30,
  });

  // Persist toggle local intre sesiuni.
  useEffect(() => {
    (async () => {
      const v = await AsyncStorage.getItem(DEV_MODE_KEY);
      if (v === '1') setDevMode(true);
    })();
  }, []);
  useEffect(() => {
    void AsyncStorage.setItem(DEV_MODE_KEY, devMode ? '1' : '0');
  }, [devMode]);

  // Cere permisiunea + ia GPS-ul curent. Strategie: intai last-known
  // (instant), apoi fresh in background ca sa actualizam fara sa blocam UI.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) {
          if (!cancelled) setLocError('Trebuie sa permiti accesul la locatie');
          return;
        }
        const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
        if (last && !cancelled) {
          setCoords({ lat: last.coords.latitude, lng: last.coords.longitude });
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch (e: any) {
        if (!cancelled) setLocError(e?.message ?? 'Eroare locatie');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe la BLE presence ca sa colectam token-urile vazute (host-ii din
  // jurul nostru). Fara BLE, lista lobbies va fi goala.
  useEffect(() => {
    const sub = presence.subscribe((snap) => {
      setBleTokens(snap.peers.map((p) => p.token));
    });
    if (!presence.isRunning()) {
      void presence.start();
    }
    return () => {
      sub();
    };
  }, []);

  const parksQuery = useQuery({
    queryKey: ['hunt', 'parks', coords?.lat?.toFixed(3), coords?.lng?.toFixed(3)],
    queryFn: () => listParksNearby(coords!.lat, coords!.lng),
    enabled: !!coords,
    staleTime: 5 * 60 * 1000,
  });

  const lobbiesQuery = useQuery({
    queryKey: ['hunt', 'lobbies', bleTokens.length],
    queryFn: () => listLobbiesNearby(bleTokens),
    enabled: bleTokens.length > 0,
    refetchInterval: 5_000,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createSession({
        parkId: selectedParkId!,
        durationSec: selectedDuration,
        lat: coords!.lat,
        lng: coords!.lng,
      }),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ['hunt', 'session', resp.sessionId] });
      router.push(`/(app)/hunt/${resp.sessionId}`);
    },
    onError: (err: any) => {
      Alert.alert('Hopa', err?.message ?? 'Nu am putut porni sesiunea');
    },
  });

  const joinMut = useMutation({
    mutationFn: (sessionId: string) => joinSession(sessionId),
    onSuccess: (_resp, sessionId) => {
      qc.invalidateQueries({ queryKey: ['hunt', 'session', sessionId] });
      router.push(`/(app)/hunt/${sessionId}`);
    },
    onError: (err: any) => {
      Alert.alert('Hopa', err?.message ?? 'Nu am putut intra in lobby');
    },
  });

  const devQuickMut = useMutation({
    mutationFn: () => devQuickHere(coords!.lat, coords!.lng),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ['hunt', 'session', resp.sessionId] });
      router.push(`/(app)/hunt/${resp.sessionId}`);
    },
    onError: (err: any) => {
      Alert.alert('Hopa', err?.message ?? 'Nu am putut porni sesiunea de test');
    },
  });

  const startReady = !!selectedParkId && !createMut.isPending;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        {devEnabledQuery.data?.enabled ? (
          <Pressable
            onPress={() => setDevMode((v) => !v)}
            hitSlop={8}
            style={[styles.devToggle, devMode && styles.devToggleOn]}
          >
            <Text style={[styles.devToggleText, devMode && styles.devToggleTextOn]}>DEV</Text>
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero — banner mare cu monstri plutitori + titlu jucaus */}
        <View style={styles.hero}>
          <FloatingEmoji emoji="🐲" style={styles.heroEmojiTL} delay={0} />
          <FloatingEmoji emoji="👻" style={styles.heroEmojiTR} delay={400} />
          <FloatingEmoji emoji="🌳" style={styles.heroEmojiBL} delay={800} />
          <FloatingEmoji emoji="👹" style={styles.heroEmojiBR} delay={1200} />
          <Text style={styles.heroBigEmoji}>🏆</Text>
          <Text style={styles.heroTitle}>Vanatoare in parc</Text>
          <Text style={styles.heroSub}>Prinde monstri cu prietenii!</Text>
        </View>

        {devMode && (
          <Section title="Mod test" emoji="🧪">
            {locError ? (
              <Text style={styles.error}>{locError}</Text>
            ) : !coords ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <AnimatedBigButton
                label={devQuickMut.isPending ? 'Se creeaza...' : 'Start rapid aici'}
                emoji="⚡"
                ready={!devQuickMut.isPending}
                onPress={() => devQuickMut.mutate()}
                tone="secondary"
              />
            )}
          </Section>
        )}

        <Section title="Lobby-uri din jur" emoji="📡">
          {bleTokens.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>📶</Text>
              <Text style={styles.emptyTitle}>Bluetooth scaneaza...</Text>
              <Text style={styles.emptySub}>
                Cand un prieten porneste o vanatoare langa tine, apare aici.
              </Text>
            </View>
          ) : lobbiesQuery.isPending ? (
            <ActivityIndicator color={colors.accent} />
          ) : lobbiesQuery.data && lobbiesQuery.data.lobbies.length > 0 ? (
            lobbiesQuery.data.lobbies.map((l) => (
              <LobbyCard
                key={l.sessionId}
                lobby={l}
                onJoin={() => joinMut.mutate(l.sessionId)}
                disabled={joinMut.isPending}
              />
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>Niciun lobby activ</Text>
              <Text style={styles.emptySub}>Niciun prieten n-a pornit o vanatoare in jurul tau.</Text>
            </View>
          )}
        </Section>

        <Section title="Porneste tu o vanatoare" emoji="🚀">
          {locError ? (
            <Text style={styles.error}>{locError}</Text>
          ) : !coords ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <>
              <Text style={styles.label}>🌳 Alege parcul</Text>
              {parksQuery.isPending ? (
                <ActivityIndicator color={colors.accent} />
              ) : parksQuery.data && parksQuery.data.parks.length > 0 ? (
                parksQuery.data.parks.map((p, idx) => (
                  <ParkRow
                    key={p.id}
                    park={p}
                    selected={selectedParkId === p.id}
                    onPress={() => setSelectedParkId(p.id)}
                    index={idx}
                  />
                ))
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyEmoji}>🗺️</Text>
                  <Text style={styles.emptyTitle}>Niciun parc aproape</Text>
                  <Text style={styles.emptySub}>Apropie-te de un parc (max 5km).</Text>
                </View>
              )}

              <Text style={[styles.label, { marginTop: 18 }]}>⏱️ Durata</Text>
              <View style={styles.durationRow}>
                {DURATION_OPTIONS.map((d) => (
                  <Pressable
                    key={d.sec}
                    onPress={() => setSelectedDuration(d.sec)}
                    style={({ pressed }) => [
                      styles.durationChip,
                      selectedDuration === d.sec && styles.durationChipActive,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.durationText,
                        selectedDuration === d.sec && styles.durationTextActive,
                      ]}
                    >
                      {d.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <AnimatedBigButton
                label={createMut.isPending ? 'Se porneste...' : 'Porneste vanatoarea!'}
                emoji="🎯"
                ready={startReady}
                onPress={() => createMut.mutate()}
                tone="accent"
              />
            </>
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

// Emoji care plutesc in hero — bob lent + rotatie subtila. Un offset prin
// `delay` ca sa nu se miste in sincron toate.
function FloatingEmoji({
  emoji,
  style,
  delay,
}: {
  emoji: string;
  style: any;
  delay: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 2200,
          delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] });
  return (
    <Animated.Text
      style={[style, { transform: [{ translateY }, { rotate }] }]}
      pointerEvents="none"
    >
      {emoji}
    </Animated.Text>
  );
}

// Buton mare CTA care pulseaza subtil cand e ready (scale 1→1.04, glow).
function AnimatedBigButton({
  label,
  emoji,
  ready,
  onPress,
  tone,
}: {
  label: string;
  emoji: string;
  ready: boolean;
  onPress: () => void;
  tone: 'accent' | 'secondary';
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ready) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ready, pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const bg = tone === 'accent' ? colors.accent : colors.secondary;
  return (
    <Animated.View style={{ transform: [{ scale }], marginTop: 18 }}>
      <Pressable
        onPress={onPress}
        disabled={!ready}
        style={({ pressed }) => [
          styles.bigBtn,
          { backgroundColor: bg },
          !ready && styles.bigBtnDisabled,
          pressed && styles.btnPressed,
        ]}
      >
        <Text style={styles.bigBtnEmoji}>{emoji}</Text>
        <Text style={styles.bigBtnText}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function Section({
  title,
  emoji,
  children,
}: {
  title: string;
  emoji?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {emoji ? `${emoji}  ` : ''}
        {title}
      </Text>
      {children}
    </View>
  );
}

function LobbyCard({
  lobby,
  onJoin,
  disabled,
}: {
  lobby: HuntLobbyNearbyItem;
  onJoin: () => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.lobbyCard}>
      <View style={styles.lobbyHeader}>
        <View style={styles.lobbyAvatarRing}>
          {lobby.host.avatarSvg ? (
            <SvgXml xml={lobby.host.avatarSvg} width={48} height={48} />
          ) : (
            <View style={styles.avatarFallback} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.lobbyHost} numberOfLines={1}>
            {lobby.host.name}
          </Text>
          <Text style={styles.lobbySub} numberOfLines={1}>
            🌳 {lobby.parkName}
          </Text>
          <View style={styles.lobbyMetaRow}>
            <View style={styles.lobbyPill}>
              <Text style={styles.lobbyPillText}>⏱ {Math.floor(lobby.durationSec / 60)}min</Text>
            </View>
            <View style={styles.lobbyPill}>
              <Text style={styles.lobbyPillText}>👥 {lobby.playerCount}</Text>
            </View>
          </View>
        </View>
        <Pressable
          onPress={onJoin}
          disabled={disabled || lobby.joined}
          style={({ pressed }) => [
            styles.joinBtn,
            lobby.joined && styles.joinBtnInside,
            disabled && styles.joinBtnDisabled,
            pressed && styles.btnPressed,
          ]}
        >
          <Text style={styles.joinText}>{lobby.joined ? '✓ Intrat' : 'Intra'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ParkRow({
  park,
  selected,
  onPress,
  index,
}: {
  park: HuntPark;
  selected: boolean;
  onPress: () => void;
  index: number;
}) {
  // Stagger fade-in pe parcuri — fiecare card pop-in cu offset.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 350,
      delay: index * 60,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, index]);
  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

  // Selected = scale-up subtil via spring.
  const sel = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(sel, {
      toValue: selected ? 1 : 0,
      friction: 6,
      tension: 160,
      useNativeDriver: true,
    }).start();
  }, [selected, sel]);
  const scale = sel.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });

  // Distance — afisaj prietenos.
  const distLabel =
    park.distanceM < 100
      ? 'foarte aproape!'
      : park.distanceM < 1000
        ? `${park.distanceM}m`
        : `${(park.distanceM / 1000).toFixed(1)}km`;

  return (
    <Animated.View style={{ opacity: enter, transform: [{ translateY }, { scale }] }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.parkCard,
          selected && styles.parkCardSelected,
          pressed && styles.btnPressed,
        ]}
      >
        <View style={[styles.parkIconBox, selected && styles.parkIconBoxSelected]}>
          <Text style={styles.parkIconEmoji}>🌳</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.parkName} numberOfLines={1}>
            {park.name}
          </Text>
          <View style={styles.parkPillRow}>
            <View style={styles.parkPill}>
              <Text style={styles.parkPillText}>🚶 {distLabel}</Text>
            </View>
            <View style={styles.parkPill}>
              <Text style={styles.parkPillText}>📐 {(park.areaSqm / 10_000).toFixed(1)} ha</Text>
            </View>
          </View>
        </View>
        <View style={[styles.parkCheck, selected && styles.parkCheckSelected]}>
          {selected && <Text style={styles.parkCheckMark}>✓</Text>}
        </View>
      </Pressable>
    </Animated.View>
  );
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
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  back: { color: colors.text, fontSize: 22, fontWeight: '900' },

  devToggle: {
    width: 44,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  devToggleOn: { backgroundColor: '#FF9F1C', borderColor: '#FF9F1C' },
  devToggleText: { color: colors.textMuted, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  devToggleTextOn: { color: '#FFFFFF' },

  scroll: { padding: 16, paddingBottom: 32, gap: 18 },

  // Hero banner mare cu monstri plutitori — primul impact pe ecran.
  hero: {
    backgroundColor: colors.accent,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    minHeight: 180,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  heroBigEmoji: { fontSize: 56, marginBottom: 6 },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  heroEmojiTL: { position: 'absolute', top: 14, left: 18, fontSize: 32 },
  heroEmojiTR: { position: 'absolute', top: 18, right: 22, fontSize: 28 },
  heroEmojiBL: { position: 'absolute', bottom: 12, left: 24, fontSize: 26 },
  heroEmojiBR: { position: 'absolute', bottom: 14, right: 18, fontSize: 30 },

  section: { gap: 12 },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginLeft: 4,
  },
  muted: { color: colors.textMuted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  label: { color: colors.text, fontSize: 14, fontWeight: '800', marginBottom: 4 },

  // Empty state — card cu emoji mare in loc de text plat.
  emptyCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  emptySub: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },

  // Lobby card — avatar in ring + pills cu meta.
  lobbyCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  lobbyHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lobbyAvatarRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: colors.secondary,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  lobbyHost: { color: colors.text, fontSize: 16, fontWeight: '900' },
  lobbySub: { color: colors.textMuted, fontSize: 13, marginTop: 2, fontWeight: '700' },
  lobbyMetaRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  lobbyPill: {
    backgroundColor: colors.bgAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  lobbyPillText: { color: colors.text, fontSize: 11, fontWeight: '800' },
  avatarFallback: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.border },
  joinBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  joinBtnInside: { backgroundColor: colors.success },
  joinBtnDisabled: { opacity: 0.5 },
  joinText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },

  // Park card — icon mare verde + pills cu distanta/suprafata + check.
  parkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 12,
    gap: 12,
    marginBottom: 8,
    borderWidth: 3,
    borderColor: 'transparent',
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  parkCardSelected: { borderColor: colors.accent, backgroundColor: '#FFF4EE' },
  parkIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#D4F2D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  parkIconBoxSelected: { backgroundColor: '#FFE0D2' },
  parkIconEmoji: { fontSize: 28 },
  parkName: { color: colors.text, fontSize: 16, fontWeight: '900' },
  parkPillRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  parkPill: {
    backgroundColor: colors.bgAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  parkPillText: { color: colors.text, fontSize: 11, fontWeight: '800' },
  parkCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parkCheckSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  parkCheckMark: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },

  durationRow: { flexDirection: 'row', gap: 10 },
  durationChip: {
    flex: 1,
    backgroundColor: colors.card,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  durationChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  durationText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  durationTextActive: { color: '#FFFFFF' },

  // Buton CTA mare cu emoji + text + pulse animat (cand ready).
  bigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  bigBtnDisabled: { opacity: 0.45 },
  bigBtnEmoji: { fontSize: 24 },
  bigBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  btnPressed: { transform: [{ scale: 0.98 }], opacity: 0.88 },
});
