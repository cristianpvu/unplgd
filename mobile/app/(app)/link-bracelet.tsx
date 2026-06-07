import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Svg, { Path, Rect, Circle, Ellipse } from 'react-native-svg';
import { provisionBracelet } from '../../src/api/bracelet';
import { ApiError } from '../../src/api/client';
import { cancelTagRead, isNfcAvailable, readTagUid } from '../../src/lib/nfc';
import { Button } from '../../src/ui/Button';
import { colors } from '../../src/theme/colors';

export default function LinkBracelet() {
  const qc = useQueryClient();
  const { firstTime } = useLocalSearchParams<{ firstTime?: string }>();
  const isFirstTime = firstTime === '1';
  const [scanning, setScanning] = useState(false);
  const [nfcAvailable, setNfcAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    isNfcAvailable().then(setNfcAvailable);
    return () => {
      cancelTagRead();
    };
  }, []);

  const provision = useMutation({
    mutationFn: (uid: string) => provisionBracelet(uid),
    onSuccess: (b) => {
      qc.setQueryData(['bracelet'], b);
      if (isFirstTime) router.replace('/(app)');
      else router.back();
    },
    onError: (err: any) => {
      const msg =
        err instanceof ApiError && err.code === 'bracelet_taken'
          ? 'Bratara aceasta e deja legata de alt cont'
          : err?.message ?? 'Nu am putut salva bratara';
      Alert.alert('Eroare', msg);
    },
  });

  async function startScan() {
    setScanning(true);
    try {
      const uid = await readTagUid({ alertMessage: 'Apropie bratara de iPhone' });
      provision.mutate(uid);
    } catch (e: any) {
      if (e?.message && !/cancel/i.test(e.message)) {
        Alert.alert('Scanare esuata', 'Tine bratara aproape de spatele telefonului si reincearca.');
      }
    } finally {
      setScanning(false);
    }
  }

  function skip() {
    router.replace('/(app)');
  }

  if (nfcAvailable === null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const active = scanning || provision.isPending;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {!isFirstTime && (
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path d="M15 5l-7 7 7 7" stroke={colors.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          </View>
        )}

        {/* Ilustratie animata de scanare NFC */}
        <View style={styles.stage}>
          <ScanAnimation active={active} enabled={!!nfcAvailable} />
        </View>

        <Text style={styles.title}>Scaneaza bratara</Text>
        <Text style={styles.subtitle}>
          {nfcAvailable
            ? active
              ? 'Apropie bratara de spatele telefonului...'
              : 'Apropie bratara de spatele telefonului.'
            : Platform.OS === 'ios'
              ? 'NFC indisponibil pe iOS acum. Sari peste si revino de pe Android.'
              : 'NFC indisponibil pe acest telefon. Verifica setarile sau sari peste.'}
        </Text>

        <View style={styles.actions}>
          <Button
            label={
              provision.isPending ? 'Se salveaza…' : scanning ? 'Anuleaza' : 'Scaneaza'
            }
            onPress={() => {
              if (scanning) {
                cancelTagRead();
                setScanning(false);
              } else {
                startScan();
              }
            }}
            disabled={!nfcAvailable || provision.isPending}
          />
          {isFirstTime && (
            <Button
              label="Mai tarziu"
              variant="secondary"
              onPress={skip}
              disabled={provision.isPending}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

// Animatie scanare: telefonul (stanga) aluneca spre dreapta catre bratara
// (dreapta). Cand ajunge aproape, ies unde NFC ")))" intre ele. Cand `active`,
// merge mai repede. Cand NFC e indisponibil, ramane static estompat.
function ScanAnimation({ active, enabled }: { active: boolean; enabled: boolean }) {
  // approach: 0 = telefon departe (stanga), 1 = aproape de bratara (dreapta).
  const approach = useRef(new Animated.Value(0)).current;
  const waves = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    if (!enabled) {
      approach.setValue(0.5);
      return;
    }
    const move = active ? 560 : 850;
    const hold = active ? 420 : 650;

    const phoneLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(approach, { toValue: 1, duration: move, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(hold),
        Animated.timing(approach, { toValue: 0, duration: move, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(active ? 200 : 500),
      ]),
    );
    phoneLoop.start();

    const wavePeriod = active ? 900 : 1400;
    const waveLoops = waves.map((w, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * (wavePeriod / 3)),
          Animated.timing(w, { toValue: 1, duration: wavePeriod, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(w, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    waveLoops.forEach((l) => l.start());

    return () => {
      phoneLoop.stop();
      waveLoops.forEach((l) => l.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, enabled]);

  // Telefonul aluneca ~46px spre dreapta (catre bratara).
  const phoneX = approach.interpolate({ inputRange: [0, 1], outputRange: [-46, 0] });
  // Undele apar doar cand telefonul e aproape (contact).
  const contact = approach.interpolate({ inputRange: [0, 0.65, 1], outputRange: [0, 0, 1] });

  return (
    <View style={styles.scanWrap}>
      {/* Telefon care aluneca spre dreapta */}
      <Animated.View style={[styles.phoneLayer, { transform: [{ translateX: phoneX }] }]} pointerEvents="none">
        <Phone enabled={enabled} />
      </Animated.View>

      {/* Unde NFC ")))" intre telefon si bratara, gated de contact */}
      {enabled &&
        waves.map((w, i) => {
          const translateX = w.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
          const opacity = Animated.multiply(
            w.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.7, 0] }),
            contact,
          );
          return (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[styles.waveArc, { left: 150 + i * 12, opacity, transform: [{ translateX }] }]}
            >
              <Svg width={26} height={70} viewBox="0 0 26 70">
                {/* arc ")" deschis spre stanga (telefon) */}
                <Path d="M6 8 Q22 35 6 62" stroke={colors.accent} strokeWidth={4} strokeLinecap="round" fill="none" />
              </Svg>
            </Animated.View>
          );
        })}

      {/* Bratara (dreapta, statica) */}
      <View style={styles.braceletLayer} pointerEvents="none">
        <Bracelet enabled={enabled} />
      </View>
    </View>
  );
}

// Telefon curat vazut din fata (ecran simplu, fara linii pe el).
function Phone({ enabled }: { enabled: boolean }) {
  return (
    <Svg width={104} height={168} viewBox="0 0 104 168">
      <Rect x={8} y={6} width={88} height={156} rx={20} fill={colors.card} stroke={colors.text} strokeWidth={3} />
      {/* ecran */}
      <Rect x={18} y={20} width={68} height={128} rx={10} fill={enabled ? '#F4EFFF' : colors.cardAlt} />
      {/* notch / difuzor */}
      <Rect x={42} y={12} width={20} height={4} rx={2} fill={colors.text} opacity={0.4} />
    </Svg>
  );
}

// Bratara reala: bangla (inel gros vertical, ca o bratara vazuta din lateral)
// cu un charm NFC pe partea dinspre telefon (stanga).
function Bracelet({ enabled }: { enabled: boolean }) {
  const band = enabled ? colors.secondary : colors.border;
  const charm = enabled ? colors.accent : colors.cardAlt;
  return (
    <Svg width={96} height={150} viewBox="0 0 96 150">
      {/* banda bratarii — inel vertical gros */}
      <Ellipse cx={54} cy={75} rx={28} ry={56} fill="none" stroke={band} strokeWidth={20} />
      {/* highlight subtil */}
      <Ellipse cx={54} cy={75} rx={28} ry={56} fill="none" stroke="#FFFFFF" strokeWidth={3} opacity={0.25} />
      {/* charm NFC pe marginea stanga (catre telefon) */}
      <Rect x={10} y={60} width={30} height={30} rx={9} fill={charm} stroke="#FFFFFF" strokeWidth={3} />
      <Circle cx={25} cy={75} r={5} fill="#FFFFFF" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: 24, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { marginBottom: 8 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },

  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Scena orizontala: telefon stanga -> unde -> bratara dreapta.
  scanWrap: { width: 280, height: 220, alignItems: 'center', justifyContent: 'center' },
  phoneLayer: { position: 'absolute', left: 34, top: 26 },
  braceletLayer: { position: 'absolute', right: 42, top: 36 },
  // Cele 3 arce ")))" intre telefon si bratara (decalate orizontal).
  waveArc: { position: 'absolute', left: 138, top: 76 },

  title: { color: colors.text, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  actions: { gap: 12, marginTop: 4 },
});
