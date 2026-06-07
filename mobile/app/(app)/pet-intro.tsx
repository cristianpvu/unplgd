import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import {
  playPetVoice,
  speakDevice,
  stopDevice,
  stopRemoteAudio,
} from '../../src/lib/speech';
import { absoluteAudioUrl, ttsSynthesize } from '../../src/api/stories';
import { ScoutMascot } from '../../src/ui/ScoutMascot';
import { colors } from '../../src/theme/colors';

// Onboarding narativ — Scout iti povesteste conceptul, pas cu pas. Fiecare pas
// are un "act" (animatie diferita a lui Scout) + o replica rostita TTS. Tap
// oriunde = mai departe. Fara buton.
type Act = 'greet' | 'scan' | 'walk' | 'grow' | 'celebrate';

type Step = {
  text: string; // rostit de Scout
  title: string;
  body: string;
  act: Act;
};

const STEPS: Step[] = [
  { act: 'greet', text: 'Salut! Eu sunt Scout, prietenul tau!', title: 'Salut! Eu sunt Scout', body: 'Companionul tau de aventuri.' },
  { act: 'scan', text: 'Antenele mele simt cand un prieten adevarat e pe-aproape.', title: 'Simt prietenii', body: 'Antenele mele detecteaza copiii din jurul tau.' },
  { act: 'walk', text: 'Iesi afara si fa-ti prieteni in lumea reala!', title: 'Iesi afara', body: 'Scaneaza bratari, joaca-te, cunoaste copii pe bune.' },
  { act: 'grow', text: 'Cu cat ne jucam mai mult cu prieteni adevarati, cu atat crestem amandoi!', title: 'Crestem impreuna', body: 'Fiecare intalnire reala ne face mai puternici.' },
  { act: 'celebrate', text: 'Acum hai sa-ti faci un avatar tare. Ne vedem la joaca!', title: 'Gata de start!', body: 'Atinge ca sa-ti faci avatarul.' },
];

export default function PetIntro() {
  const [step, setStep] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step]!;

  useEffect(() => {
    let cancelled = false;

    fade.setValue(0);
    slide.setValue(16);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    (async () => {
      try {
        const { audioUrl } = await ttsSynthesize(current.text);
        if (cancelled) return;
        await playPetVoice(current.text, absoluteAudioUrl(audioUrl));
      } catch {
        if (cancelled) return;
        speakDevice(current.text);
      }
    })();

    return () => {
      cancelled = true;
      stopDevice();
      void stopRemoteAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function advance() {
    if (isLast) {
      stopDevice();
      void stopRemoteAudio();
      router.replace('/(app)/avatar-edit?firstTime=1');
      return;
    }
    setStep((s) => s + 1);
  }

  function skip() {
    stopDevice();
    void stopRemoteAudio();
    router.replace('/(app)/avatar-edit?firstTime=1');
  }

  return (
    <Pressable style={styles.fill} onPress={advance}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <View style={styles.topRow}>
            {!isLast ? (
              <Pressable onPress={skip} hitSlop={12} style={styles.skipBtn}>
                <Text style={styles.skipText}>Sari peste</Text>
              </Pressable>
            ) : (
              <View style={{ height: 24 }} />
            )}
          </View>

          <View style={styles.stage}>
            <ScoutActor act={current.act} stepKey={step} />
          </View>

          <Animated.View style={[styles.copy, { opacity: fade, transform: [{ translateY: slide }] }]}>
            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.body}>{current.body}</Text>
          </Animated.View>

          <View style={styles.dotsRow}>
            {STEPS.map((_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
            ))}
          </View>

          <Text style={styles.tapHint}>{isLast ? 'Atinge ca sa incepi' : 'Atinge oriunde'}</Text>
        </View>
      </SafeAreaView>
    </Pressable>
  );
}

// Scout care "joaca" un act diferit per pas. Toate transformarile se aplica pe
// wrapper-ul mascotei (ScoutMascot ramane neschimbat). `stepKey` reseteaza
// driver-ul la schimbarea pasului.
function ScoutActor({ act, stepKey }: { act: Act; stepKey: number }) {
  const t = useRef(new Animated.Value(0)).current; // loop continuu 0->1
  const intro = useRef(new Animated.Value(0)).current; // 0->1 la intrarea pasului

  useEffect(() => {
    t.setValue(0);
    intro.setValue(0);

    Animated.spring(intro, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();

    const period = act === 'celebrate' ? 700 : act === 'walk' ? 1400 : act === 'grow' ? 1500 : 1800;
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);

  // Transform per act, derivat din acelasi driver `t`.
  const transform: any[] = [];
  // intro: apare cu un mic pop
  transform.push({ scale: intro.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) });

  if (act === 'greet') {
    // leganare prietenoasa (wiggle) — "salut!"
    transform.push({
      rotate: t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['0deg', '7deg', '0deg', '-7deg', '0deg'] }),
    });
    transform.push({ translateY: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -8, 0] }) });
  } else if (act === 'scan') {
    // se inclina usor, parca "asculta" — plus undele radar (overlay separat)
    transform.push({
      rotate: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-4deg', '4deg', '-4deg'] }),
    });
  } else if (act === 'walk') {
    // se misca stanga-dreapta cu hopuri — "iesi afara"
    transform.push({ translateX: t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 26, 0, -26, 0] }) });
    transform.push({ translateY: t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -12, 0, -12, 0] }) });
  } else if (act === 'grow') {
    // creste si revine — "crestem impreuna"
    transform.push({ scale: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.22, 1] }) });
  } else if (act === 'celebrate') {
    // sarituri vesele + mica rotire — "gata de start!"
    transform.push({ translateY: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -28, 0] }) });
    transform.push({ rotate: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-5deg', '5deg', '-5deg'] }) });
  }

  const shadowScale = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.8, 1] });
  const shadowOpacity = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.16, 0.09, 0.16] });

  return (
    <View style={styles.actorZone}>
      {act === 'scan' && <RadarRings />}
      {act === 'celebrate' && <Sparkles />}

      <Animated.View style={[styles.actorShadow, { opacity: shadowOpacity, transform: [{ scaleX: shadowScale }] }]} />
      <Animated.View style={{ transform }}>
        <ScoutMascot size={188} />
      </Animated.View>
    </View>
  );
}

// Inele radar care se extind din Scout — pasul "simt prietenii".
function RadarRings() {
  const rings = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const loops = rings.map((r, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 600),
          Animated.timing(r, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(r, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={styles.ringsLayer} pointerEvents="none">
      {rings.map((r, i) => {
        const scale = r.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.4] });
        const opacity = r.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.45, 0] });
        return <Animated.View key={i} style={[styles.ring, { opacity, transform: [{ scale }] }]} />;
      })}
    </View>
  );
}

// Sclipici care urca in jurul lui Scout — pasul final, sarbatoare.
function Sparkles() {
  const specs = [
    { left: 30, top: 40, size: 20, delay: 0 },
    { left: 150, top: 24, size: 26, delay: 250 },
    { left: 12, top: 120, size: 16, delay: 500 },
    { left: 168, top: 110, size: 18, delay: 150 },
    { left: 96, top: 6, size: 22, delay: 400 },
  ];
  return (
    <View style={styles.sparkLayer} pointerEvents="none">
      {specs.map((s, i) => (
        <Sparkle key={i} {...s} />
      ))}
    </View>
  );
}

function Sparkle({ left, top, size, delay }: { left: number; top: number; size: number; delay: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(a, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const opacity = a.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] });
  const scale = a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 1.1, 0.6] });
  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [6, -16] });
  const color = i_color(left);
  return (
    <Animated.View style={{ position: 'absolute', left, top, opacity, transform: [{ scale }, { translateY }] }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 1.5 L14 9.5 L22 12 L14 14.5 L12 22.5 L10 14.5 L2 12 L10 9.5 Z" fill={color} />
      </Svg>
    </Animated.View>
  );
}

function i_color(seed: number): string {
  const palette = [colors.accent, colors.secondary, '#9B7BFF'];
  return palette[seed % palette.length]!;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: 24, paddingBottom: 28, gap: 8 },

  topRow: { height: 36, alignItems: 'flex-end', justifyContent: 'center' },
  skipBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  skipText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },

  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actorZone: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center' },
  actorShadow: {
    position: 'absolute',
    bottom: 18,
    width: 140,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.text,
  },

  ringsLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
    borderColor: colors.secondary,
  },

  sparkLayer: { ...StyleSheet.absoluteFillObject },

  copy: { alignItems: 'center', gap: 8, minHeight: 92, paddingHorizontal: 8 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  body: { color: colors.textMuted, fontSize: 16, fontWeight: '600', lineHeight: 23, textAlign: 'center' },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.accent, width: 22 },

  tapHint: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    opacity: 0.6,
    letterSpacing: 0.3,
  },
});
