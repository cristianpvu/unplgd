import { useEffect, useState } from 'react';
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Vanatoare in parc</Text>
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
          <Section title="Mod test">
            {locError ? (
              <Text style={styles.error}>{locError}</Text>
            ) : !coords ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Pressable
                onPress={() => devQuickMut.mutate()}
                disabled={devQuickMut.isPending}
                style={({ pressed }) => [
                  styles.startBtn,
                  devQuickMut.isPending && styles.startBtnDisabled,
                  pressed && styles.btnPressed,
                ]}
              >
                <Text style={styles.startText}>
                  {devQuickMut.isPending ? 'Se creeaza...' : 'Start test'}
                </Text>
              </Pressable>
            )}
          </Section>
        )}

        <Section title="Lobby-uri din jur">
          {bleTokens.length === 0 ? (
            <Text style={styles.muted}>
              Bluetooth-ul scaneaza... Cand un prieten porneste o vanatoare, apare aici.
            </Text>
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
            <Text style={styles.muted}>Niciun lobby activ langa tine.</Text>
          )}
        </Section>

        <Section title="Porneste tu o vanatoare">
          {locError ? (
            <Text style={styles.error}>{locError}</Text>
          ) : !coords ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <>
              <Text style={styles.label}>Alege parcul</Text>
              {parksQuery.isPending ? (
                <ActivityIndicator color={colors.accent} />
              ) : parksQuery.data && parksQuery.data.parks.length > 0 ? (
                parksQuery.data.parks.map((p) => (
                  <ParkRow
                    key={p.id}
                    park={p}
                    selected={selectedParkId === p.id}
                    onPress={() => setSelectedParkId(p.id)}
                  />
                ))
              ) : (
                <Text style={styles.muted}>Niciun parc in raza de 5km. Apropie-te de un parc.</Text>
              )}

              <Text style={[styles.label, { marginTop: 16 }]}>Durata</Text>
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

              <Pressable
                onPress={() => createMut.mutate()}
                disabled={!selectedParkId || createMut.isPending}
                style={({ pressed }) => [
                  styles.startBtn,
                  (!selectedParkId || createMut.isPending) && styles.startBtnDisabled,
                  pressed && styles.btnPressed,
                ]}
              >
                <Text style={styles.startText}>
                  {createMut.isPending ? 'Se porneste...' : 'Porneste vanatoarea'}
                </Text>
              </Pressable>
            </>
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
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
        {lobby.host.avatarSvg ? (
          <SvgXml xml={lobby.host.avatarSvg} width={42} height={42} />
        ) : (
          <View style={styles.avatarFallback} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.lobbyHost}>{lobby.host.name}</Text>
          <Text style={styles.lobbySub}>
            {lobby.parkName} · {Math.floor(lobby.durationSec / 60)} min · {lobby.playerCount}{' '}
            jucatori
          </Text>
        </View>
        <Pressable
          onPress={onJoin}
          disabled={disabled || lobby.joined}
          style={({ pressed }) => [
            styles.joinBtn,
            (disabled || lobby.joined) && styles.joinBtnDisabled,
            pressed && styles.btnPressed,
          ]}
        >
          <Text style={styles.joinText}>{lobby.joined ? 'In lobby' : 'Intra'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ParkRow({
  park,
  selected,
  onPress,
}: {
  park: HuntPark;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.parkRow,
        selected && styles.parkRowSelected,
        pressed && styles.btnPressed,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.parkName}>{park.name}</Text>
        <Text style={styles.parkMeta}>
          {park.distanceM < 100
            ? 'foarte aproape'
            : park.distanceM < 1000
              ? `${park.distanceM}m`
              : `${(park.distanceM / 1000).toFixed(1)}km`}{' '}
          · {(park.areaSqm / 10_000).toFixed(1)} ha
        </Text>
      </View>
      <View style={[styles.parkRadio, selected && styles.parkRadioSelected]}>
        {selected && <View style={styles.parkRadioDot} />}
      </View>
    </Pressable>
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
  },
  back: { color: colors.text, fontSize: 22, fontWeight: '700' },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },

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

  scroll: { padding: 16, gap: 16 },
  section: { gap: 10 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '800', letterSpacing: 0.4 },
  muted: { color: colors.textMuted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  label: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 4 },

  lobbyCard: { backgroundColor: colors.card, borderRadius: 16, padding: 12 },
  lobbyHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lobbyHost: { color: colors.text, fontSize: 16, fontWeight: '800' },
  lobbySub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.cardAlt,
  },
  joinBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  joinBtnDisabled: { opacity: 0.5 },
  joinText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  parkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  parkRowSelected: { borderColor: colors.accent },
  parkName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  parkMeta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  parkRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parkRadioSelected: { borderColor: colors.accent },
  parkRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },

  durationRow: { flexDirection: 'row', gap: 10 },
  durationChip: {
    flex: 1,
    backgroundColor: colors.card,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  durationChipActive: { borderColor: colors.accent },
  durationText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  durationTextActive: { color: colors.accent },

  startBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  startBtnDisabled: { opacity: 0.4 },
  startText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  btnPressed: { transform: [{ scale: 0.98 }], opacity: 0.85 },
});
