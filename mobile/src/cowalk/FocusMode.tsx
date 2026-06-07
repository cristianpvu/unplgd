import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  type AppStateStatus,
  BackHandler,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useKeepAwakeSafe } from '../lib/useKeepAwakeSafe';
import Svg, { Circle } from 'react-native-svg';
import { COWALK_MIN_DURATION_MS } from '../ble/constants';
import type { ClientSession } from '../ble/presence';
import { colors } from '../theme/colors';

// Mod concentrat: overlay full-screen care:
//  - tine ecranul aprins (useKeepAwake)
//  - absoarbe TOATE tap-urile pe ariile non-interactive (nu poti apasa pe
//    nimic din UI-ul de jos prin buzunar)
//  - singura iesire e un buton "tine apasat 3s" (anti-deblocare accidentala)
//  - daca app-ul intra in background, sesiunea se considera pierduta:
//    parintele primeste onSessionLost si pune co-walk-ul pe pauza
//
// NU putem bloca complet gesturile de sistem (home swipe, control center) din
// JS. Acelea cer Guided Access (iOS) / Screen Pinning (Android) — feature OS
// activate manual de utilizator. Penalizam plecarea cu pierderea sesiunii
// pentru a descuraja "exit-uri prin trucuri".

const UNLOCK_HOLD_MS = 3000;

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function FocusMode({
  session,
  now,
  onExit,
  onSessionLost,
}: {
  session: ClientSession | null;
  now: number;
  onExit: () => void;
  onSessionLost: () => void;
}) {
  useKeepAwakeSafe('focus-mode');

  const me = session?.members.find((m) => m.isMe) ?? null;
  const others = session?.members.filter((m) => !m.isMe) ?? [];
  const myJoinedAt = me?.joinedAtClient ?? null;
  const elapsed = myJoinedAt ? Math.max(0, now - myJoinedAt) : 0;
  const ratio = Math.min(1, elapsed / COWALK_MIN_DURATION_MS);
  const remainingMs = Math.max(0, COWALK_MIN_DURATION_MS - elapsed);
  const myAwarded = me?.awarded ?? false;

  // Detectie background: cand user-ul iese (apasa home, swipe sus, primeste un
  // apel), AppState trece prin 'inactive' inainte de 'background'. Trigerul
  // strict pe 'background' acopera home-out fara false-positive la dropdown
  // de notificari sau alerte de sistem.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background') {
        onSessionLost();
      }
    });
    return () => sub.remove();
  }, [onSessionLost]);

  // Blocam butonul hardware Back pe Android — singura iesire e long-press-ul
  // de 3s. `return true` din handler anuleaza propagarea catre stack-ul de
  // navigare. iOS swipe-back e dezactivat separat via Stack.Screen mai jos.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // La intoarcerea in app (daca cumva onSessionLost a tras pauza), informam
  // user-ul. Detectia se face in parinte; aici doar afisam un alert daca
  // ne reactiveaza si nu mai exista sesiune.
  return (
    <View style={styles.overlay}>
      {/* Dezactiveaza iOS swipe-back si headerBackButton cat overlay-ul e
          montat. Cand componenta se demonteaza, optiunile revin la default. */}
      <Stack.Screen
        options={{ gestureEnabled: false, headerBackVisible: false }}
      />
      <View style={styles.scrim} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.lockBadge}>
            <Text style={styles.lockBadgeText}>🔒 MOD CONCENTRAT</Text>
          </View>
          <Text style={styles.subTitle}>
            Ecranul ramane aprins. Atingerile sunt blocate.
          </Text>
        </View>

        <View style={styles.center}>
          {session && me ? (
            <>
              <Text style={styles.bigTimer}>
                {myAwarded ? '✓' : formatDuration(elapsed)}
              </Text>
              <Text style={styles.hint}>
                {myAwarded
                  ? 'XP primit. Poti iesi din modul concentrat.'
                  : `inca ${formatDuration(remainingMs)} pana la XP`}
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${ratio * 100}%`,
                      backgroundColor: myAwarded ? colors.success : colors.accent,
                    },
                  ]}
                />
              </View>
              {others.length > 0 && (
                <Text style={styles.peers}>
                  cu {others.map((o) => o.name).join(', ')}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.bigTimer}>--:--</Text>
              <Text style={styles.hint}>
                Astept sa apara un prieten in raza...
              </Text>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <UnlockButton onUnlock={onExit} />
          <Text style={styles.footerHint}>
            Daca iesi din aplicatie, sesiunea de co-walk se opreste.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

// Buton "Tine apasat 3s pentru a iesi". Animatie de cerc care se umple cat
// e apasat; daca user-ul ridica degetul inainte de 3s, anuleaza. Anti-tap
// in buzunar (nu se ies cu un singur touch).
function UnlockButton({ onUnlock }: { onUnlock: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);

  function startHold() {
    setHolding(true);
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: UNLOCK_HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    timerRef.current = setTimeout(() => {
      onUnlock();
    }, UNLOCK_HOLD_MS);
  }

  function cancelHold() {
    setHolding(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Cerc SVG cu stroke-dashoffset animat. Raza 38, circumferinta = 2πr.
  const R = 38;
  const C = 2 * Math.PI * R;
  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [C, 0],
  });
  const AnimatedCircle = Animated.createAnimatedComponent(Circle);

  return (
    <Pressable
      onPressIn={startHold}
      onPressOut={cancelHold}
      style={({ pressed }) => [styles.unlockBtn, pressed && { opacity: 0.95 }]}
    >
      <Svg width={96} height={96} style={StyleSheet.absoluteFill}>
        <Circle
          cx={48}
          cy={48}
          r={R}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={5}
          fill="none"
        />
        <AnimatedCircle
          cx={48}
          cy={48}
          r={R}
          stroke={colors.accent}
          strokeWidth={5}
          fill="none"
          strokeDasharray={`${C} ${C}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
        />
      </Svg>
      <Text style={styles.unlockBtnText}>
        {holding ? 'Tine...' : 'Tine 3s'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  // Stratul opac de fundal — atinge ariile inferioare si le inchide; tap-urile
  // pe el sunt absorbite (default pointerEvents auto pe un View fara handler).
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 18, 40, 0.96)',
  },
  safe: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
  },
  lockBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  lockBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  subTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  bigTimer: {
    color: '#FFFFFF',
    fontSize: 72,
    fontWeight: '900',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  peers: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  footer: {
    alignItems: 'center',
    gap: 14,
    paddingBottom: 16,
  },
  unlockBtn: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  unlockBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  footerHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 16,
  },
});
