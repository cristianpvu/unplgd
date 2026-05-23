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
  const hasNearby = (lobbiesQuery.data?.lobbies.length ?? 0) > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Vanatoare</Text>
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
        {devMode && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Mod test</Text>
            {locError ? (
              <Text style={styles.error}>{locError}</Text>
            ) : !coords ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <PulseButton
                label={devQuickMut.isPending ? 'Se creeaza...' : 'Start rapid aici'}
                ready={!devQuickMut.isPending}
                onPress={() => devQuickMut.mutate()}
                variant="ghost"
              />
            )}
          </View>
        )}

        {/* Lobby-uri — afisate doar daca avem ceva sa aratam */}
        {(bleTokens.length > 0 || hasNearby) && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>In jurul tau</Text>
            {lobbiesQuery.isPending ? (
              <ActivityIndicator color={colors.accent} />
            ) : hasNearby ? (
              lobbiesQuery.data!.lobbies.map((l) => (
                <LobbyCard
                  key={l.sessionId}
                  lobby={l}
                  onJoin={() => joinMut.mutate(l.sessionId)}
                  disabled={joinMut.isPending}
                />
              ))
            ) : (
              <Text style={styles.muted}>Nimeni n-a pornit inca o vanatoare.</Text>
            )}
          </View>
        )}

        {/* Creeaza tu — sectiunea principala */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Porneste tu</Text>
          {locError ? (
            <Text style={styles.error}>{locError}</Text>
          ) : !coords ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <>
              {parksQuery.isPending ? (
                <ActivityIndicator color={colors.accent} />
              ) : parksQuery.data && parksQuery.data.parks.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.parkScroll}
                  decelerationRate="fast"
                  snapToInterval={132}
                  snapToAlignment="start"
                >
                  {parksQuery.data.parks.map((p, idx) => (
                    <ParkCard
                      key={p.id}
                      park={p}
                      selected={selectedParkId === p.id}
                      onPress={() => setSelectedParkId(p.id)}
                      index={idx}
                    />
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.muted}>Niciun parc in raza de 5km.</Text>
              )}

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

              <PulseButton
                label={createMut.isPending ? 'Se porneste...' : 'Porneste vanatoarea'}
                ready={startReady}
                onPress={() => createMut.mutate()}
                variant="primary"
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Buton primary cu pulse subtil cand e ready (scale 1→1.025). Variant ghost
// fara fill — pt actiuni secundare (test mode).
function PulseButton({
  label,
  ready,
  onPress,
  variant,
}: {
  label: string;
  ready: boolean;
  onPress: () => void;
  variant: 'primary' | 'ghost';
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ready || variant !== 'primary') {
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
  }, [ready, pulse, variant]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });
  return (
    <Animated.View style={{ transform: [{ scale }], marginTop: 12 }}>
      <Pressable
        onPress={onPress}
        disabled={!ready}
        style={({ pressed }) => [
          variant === 'primary' ? styles.primaryBtn : styles.ghostBtn,
          !ready && styles.btnDisabled,
          pressed && styles.btnPressed,
        ]}
      >
        <Text style={variant === 'primary' ? styles.primaryBtnText : styles.ghostBtnText}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
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
      <View style={styles.lobbyAvatarRing}>
        {lobby.host.avatarSvg ? (
          <SvgXml xml={lobby.host.avatarSvg} width={40} height={40} />
        ) : (
          <View style={styles.avatarFallback} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.lobbyHost} numberOfLines={1}>
          {lobby.host.name}
        </Text>
        <Text style={styles.lobbySub} numberOfLines={1}>
          {lobby.parkName} · {Math.floor(lobby.durationSec / 60)}min · {lobby.playerCount} jucatori
        </Text>
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
        <Text style={[styles.joinText, lobby.joined && { color: colors.success }]}>
          {lobby.joined ? 'Intrat' : 'Intra'}
        </Text>
      </Pressable>
    </View>
  );
}

// Park card pt scroll orizontal — distanta MARE in top (kids respond to scale),
// nume + suprafata jos. Silueta abstracta din 3 "munti" SVG ca decor — nu emoji,
// nu generic icon. Selected: border accent + lift subtil + accent bg tint.
function ParkCard({
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
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 280,
      delay: index * 40,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, index]);
  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  // Selected = scale spring + lift
  const sel = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(sel, {
      toValue: selected ? 1 : 0,
      friction: 6,
      tension: 180,
      useNativeDriver: true,
    }).start();
  }, [selected, sel]);
  const scale = sel.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  // Distanta — afisaj kid-friendly: numar mare + unitate mica
  const isClose = park.distanceM < 100;
  const distNum = isClose
    ? '<100'
    : park.distanceM < 1000
      ? `${park.distanceM}`
      : `${(park.distanceM / 1000).toFixed(1)}`;
  const distUnit = park.distanceM < 1000 ? 'm' : 'km';

  // Silueta abstracta — 3 munti/copaci stilizati. Forma generata o data, nu
  // randomizata per park (consistent visual).
  const decorationSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40">
    <path d="M0 40 L20 12 L34 28 L52 4 L72 24 L90 14 L108 30 L120 18 L120 40 Z"
      fill="${selected ? '#FFFFFF' : colors.bgAlt}" opacity="${selected ? '0.35' : '1'}"/>
    <circle cx="100" cy="10" r="3.5" fill="${selected ? '#FFFFFF' : colors.accent}" opacity="${selected ? '0.5' : '0.4'}"/>
  </svg>`;

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [{ translateY }, { scale }],
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.parkCard,
          selected && styles.parkCardSelected,
          pressed && styles.btnPressed,
        ]}
      >
        <View style={styles.parkDistRow}>
          <Text style={[styles.parkDistNum, selected && styles.parkDistNumSelected]}>
            {distNum}
          </Text>
          <Text style={[styles.parkDistUnit, selected && styles.parkDistUnitSelected]}>
            {distUnit}
          </Text>
        </View>
        <Text
          style={[styles.parkName, selected && styles.parkNameSelected]}
          numberOfLines={2}
        >
          {park.name}
        </Text>
        <Text style={[styles.parkArea, selected && styles.parkAreaSelected]}>
          {(park.areaSqm / 10_000).toFixed(1)} ha
        </Text>
        {/* Decor in bottom — silueta abstracta */}
        <View style={styles.parkDecor} pointerEvents="none">
          <SvgXml xml={decorationSvg} width={120} height={40} />
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
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { color: colors.text, fontSize: 22, fontWeight: '900' },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },

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

  scroll: { padding: 16, paddingBottom: 32, gap: 22 },

  section: { gap: 10 },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  muted: { color: colors.textMuted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 14 },

  // Lobby card — minimalist, fara meta colorate
  lobbyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  lobbyAvatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  lobbyHost: { color: colors.text, fontSize: 15, fontWeight: '800' },
  lobbySub: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  avatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.border },
  joinBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  joinBtnInside: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.success },
  joinBtnDisabled: { opacity: 0.5 },
  joinText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },

  // Park scroll — orizontal, snappable, fiecare card 124px wide
  parkScroll: { gap: 10, paddingRight: 4, paddingBottom: 4 },
  parkCard: {
    width: 124,
    height: 132,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 0,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  parkCardSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  parkDistRow: { flexDirection: 'row', alignItems: 'baseline' },
  parkDistNum: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 34,
  },
  parkDistNumSelected: { color: '#FFFFFF' },
  parkDistUnit: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 2,
    letterSpacing: 0.5,
  },
  parkDistUnitSelected: { color: '#FFFFFF', opacity: 0.85 },
  parkName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
    marginTop: 4,
    minHeight: 32,
  },
  parkNameSelected: { color: '#FFFFFF' },
  parkArea: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  parkAreaSelected: { color: 'rgba(255,255,255,0.8)' },
  parkDecor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },

  durationRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  durationChip: {
    flex: 1,
    backgroundColor: colors.card,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  durationChipActive: { backgroundColor: colors.accent },
  durationText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  durationTextActive: { color: '#FFFFFF' },

  // CTA primary — un singur dreptunghi solid, fara umbra agresiva
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  // CTA ghost — fara fill, doar border (pt actiuni secundare)
  ghostBtn: {
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ghostBtnText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  btnDisabled: { opacity: 0.4 },
  btnPressed: { transform: [{ scale: 0.99 }], opacity: 0.88 },
});
