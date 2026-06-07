import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Animated,
  type DimensionValue,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Button } from '../../src/ui/Button';
import { colors } from '../../src/theme/colors';
import { ScoutMascot } from '../../src/ui/ScoutMascot';
import { login, register } from '../../src/api/auth';
import { ApiError } from '../../src/api/client';
import { useAuth } from '../../src/lib/auth';

// Scurtaturi de DEMO/prezentare — intra instant fara formulare.
const DEMO_EMAIL = 'office@dinedroid.com';
const DEMO_PASSWORD = 'parolaparola';
const DEMO_NAMES = ['Andrei', 'Maria', 'Luca', 'Sofia', 'David', 'Ana', 'Mihai', 'Ioana'];

function randomBirthDate(): string {
  const age = 7 + Math.floor(Math.random() * 7); // 7..13, in intervalul 6-14
  const year = new Date().getFullYear() - age;
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function Welcome() {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState<null | 'login' | 'new'>(null);

  // ----- Animatii -----
  const entrance = useRef(new Animated.Value(0)).current; // 0->1 la mount
  const bob = useRef(new Animated.Value(0)).current; // loop plutire

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 750,
      easing: Easing.out(Easing.back(1.3)),
      useNativeDriver: true,
    }).start();

    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 1700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 1700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    bobLoop.start();

    return () => {
      bobLoop.stop();
    };
  }, [entrance, bob]);

  const mascotTranslate = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
  const mascotScale = entrance.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const shadowScale = bob.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] });
  const shadowOpacity = bob.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.1] });
  const riseUp = entrance.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });

  // ----- Auth demo -----
  // dest: '/(app)' pt cont existent; '/(app)/pet-intro' pt cont nou (onboarding).
  async function enter(token: string, dest: '/(app)' | '/(app)/pet-intro' = '/(app)') {
    await signIn(token);
    router.replace(dest);
  }

  async function demoLogin() {
    if (busy) return;
    setBusy('login');
    try {
      const { token } = await login({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
      await enter(token);
    } catch {
      try {
        const { token } = await register({
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
          name: 'Demo',
          birthDate: randomBirthDate(),
        });
        await enter(token, '/(app)/pet-intro');
      } catch (e) {
        Alert.alert(
          'Demo login esuat',
          e instanceof ApiError && e.code === 'email_taken'
            ? `Contul ${DEMO_EMAIL} exista cu alta parola. Schimba DEMO_PASSWORD in welcome.tsx.`
            : 'Nu am putut intra. Verifica conexiunea.',
        );
      }
    } finally {
      setBusy(null);
    }
  }

  async function demoRegister() {
    if (busy) return;
    setBusy('new');
    try {
      const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const name = DEMO_NAMES[Math.floor(Math.random() * DEMO_NAMES.length)] ?? 'Demo';
      const { token } = await register({
        email: `demo-${tag}@unplgd.test`,
        password: DEMO_PASSWORD,
        name,
        birthDate: randomBirthDate(),
      });
      await enter(token, '/(app)/pet-intro');
    } catch {
      Alert.alert('Demo cont nou esuat', 'Nu am putut crea contul. Verifica conexiunea.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Stelute care pulseaza in fundal */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <TwinkleStar left="12%" top="14%" size={26} color="#FFFFFF" delay={0} />
        <TwinkleStar left="82%" top="10%" size={20} color={colors.secondary} delay={600} />
        <TwinkleStar left="22%" top="32%" size={16} color={colors.accent} delay={1200} />
        <TwinkleStar left="86%" top="34%" size={28} color="#FFFFFF" delay={300} />
        <TwinkleStar left="8%" top="46%" size={18} color={colors.secondary} delay={900} />
        <TwinkleStar left="74%" top="50%" size={16} color={colors.accent} delay={1500} />
      </View>

      <View style={styles.container}>
        <View style={styles.hero}>
          {/* Mascota + umbra */}
          <View style={styles.mascotZone}>
            <Animated.View
              style={[styles.shadow, { opacity: shadowOpacity, transform: [{ scaleX: shadowScale }] }]}
            />
            <Animated.View
              style={{ opacity: entrance, transform: [{ translateY: mascotTranslate }, { scale: mascotScale }] }}
            >
              <ScoutMascot />
            </Animated.View>
          </View>

          <Animated.Text style={[styles.logo, { opacity: entrance, transform: [{ translateY: riseUp }] }]}>
            Unplgd
          </Animated.Text>
          <Animated.Text
            style={[styles.tagline, { opacity: entrance, transform: [{ translateY: riseUp }] }]}
          >
            Iesi afara. Fa-ti prieteni.{'\n'}Creste-ti mascota!
          </Animated.Text>
        </View>

        <Animated.View style={[styles.actions, { opacity: entrance, transform: [{ translateY: riseUp }] }]}>
          <Button label="Sa incepem!" onPress={() => router.push('/(auth)/register')} />
          <Button
            label="Am deja cont"
            variant="secondary"
            onPress={() => router.push('/(auth)/login')}
          />

          {/* Scurtaturi discrete de demo/prezentare. */}
          <View style={styles.demoRow}>
            <Pressable onPress={demoLogin} hitSlop={8} disabled={!!busy} style={styles.demoLink}>
              {busy === 'login' ? (
                <ActivityIndicator size="small" color={colors.textMuted} />
              ) : (
                <Text style={styles.demoText}>demo · intra</Text>
              )}
            </Pressable>
            <Text style={styles.demoDot}>·</Text>
            <Pressable onPress={demoRegister} hitSlop={8} disabled={!!busy} style={styles.demoLink}>
              {busy === 'new' ? (
                <ActivityIndicator size="small" color={colors.textMuted} />
              ) : (
                <Text style={styles.demoText}>demo · cont nou</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------

// Stea sclipitoare — pulseaza opacitatea + scala, in bucla, cu un delay propriu.
function TwinkleStar({
  left,
  top,
  size,
  color,
  delay,
}: {
  left: DimensionValue;
  top: DimensionValue;
  size: number;
  color: string;
  delay: number;
}) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(a, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a, delay]);

  const opacity = a.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1.15] });

  return (
    <Animated.View
      style={{ position: 'absolute', left, top, opacity, transform: [{ scale }] }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 1.5 L14 9.5 L22 12 L14 14.5 L12 22.5 L10 14.5 L2 12 L10 9.5 Z" fill={color} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 48,
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  mascotZone: { alignItems: 'center', justifyContent: 'flex-end', marginBottom: 24 },
  shadow: {
    position: 'absolute',
    bottom: -6,
    width: 150,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.text,
  },

  logo: {
    color: colors.text,
    fontSize: 58,
    fontWeight: '900',
    letterSpacing: -2,
  },
  tagline: {
    color: colors.text,
    fontSize: 18,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
    lineHeight: 26,
    opacity: 0.8,
  },
  actions: { gap: 12 },

  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
    minHeight: 20,
  },
  demoLink: { paddingVertical: 4, paddingHorizontal: 6 },
  demoText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.6,
    letterSpacing: 0.3,
  },
  demoDot: { color: colors.textMuted, opacity: 0.4 },
});
