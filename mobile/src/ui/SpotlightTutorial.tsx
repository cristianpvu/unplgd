import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Defs, Mask, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScoutMascot } from './ScoutMascot';
import { absoluteAudioUrl, ttsSynthesize } from '../api/stories';
import { playPetVoice, speakDevice, stopDevice, stopRemoteAudio } from '../lib/speech';
import { colors } from '../theme/colors';

export type Rect = { x: number; y: number; width: number; height: number };

export type SpotlightStep = {
  rect: Rect | null; // null = fara spotlight (mesaj centrat, ex. intro/final)
  title: string;
  body: string;
  shape?: 'circle' | 'rect';
};

const PAD = 10; // padding in jurul tintei
const DIM = 'rgba(20, 18, 40, 0.74)';

// Tutorial cu spotlight: un singur strat SVG intuneca tot ecranul cu o gaura
// decupata (mask) peste tinta — fara fisuri/colturi luminoase. Inelul de
// highlight foloseste exact aceleasi coordonate, deci e mereu aliniat. Scout
// vorbeste fiecare pas (TTS). Tap oriunde = pasul urmator.
export function SpotlightTutorial({
  steps,
  onDone,
}: {
  steps: SpotlightStep[];
  onDone: () => void;
}) {
  const [i, setI] = useState(0);
  const [size, setSize] = useState(() => {
    const w = Dimensions.get('window');
    return { w: w.width, h: w.height };
  });
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;

  const step = steps[i];

  // Animatie de intrare la fiecare pas.
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [i, fade]);

  // TTS: Scout rosteste pasul curent.
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    const line = `${step.title}. ${step.body}`;
    (async () => {
      try {
        const { audioUrl } = await ttsSynthesize(line);
        if (cancelled) return;
        await playPetVoice(line, absoluteAudioUrl(audioUrl));
      } catch {
        if (cancelled) return;
        speakDevice(line);
      }
    })();
    return () => {
      cancelled = true;
      stopDevice();
      void stopRemoteAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  if (!step) return null;

  function next() {
    if (i >= steps.length - 1) {
      stopDevice();
      void stopRemoteAudio();
      onDone();
      return;
    }
    setI((v) => v + 1);
  }

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  }

  const r = step.rect;
  const hole = r
    ? {
        x: Math.max(0, r.x - PAD),
        y: Math.max(0, r.y - PAD),
        width: r.width + PAD * 2,
        height: r.height + PAD * 2,
      }
    : null;
  const isCircle = step.shape === 'circle';
  // Pentru cerc: raza acopera tinta, centrata pe ea.
  const cx = hole ? hole.x + hole.width / 2 : 0;
  const cy = hole ? hole.y + hole.height / 2 : 0;
  const cr = hole ? Math.max(hole.width, hole.height) / 2 : 0;
  const rectRadius = 18;

  // Bula Scout: sub tinta daca tinta e in jumatatea de sus, altfel deasupra.
  const bubbleBelow = !hole || hole.y + hole.height < size.h * 0.5;
  const bubbleTop = hole
    ? bubbleBelow
      ? hole.y + hole.height + 18
      : Math.max(insets.top + 12, hole.y - 220)
    : size.h * 0.34;

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={next} onLayout={onLayout}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]} pointerEvents="none">
        <Svg width={size.w} height={size.h}>
          <Defs>
            <Mask id="spotlight">
              {/* alb = vizibil (dim), negru = gaura */}
              <Rect x={0} y={0} width={size.w} height={size.h} fill="#fff" />
              {hole &&
                (isCircle ? (
                  <Circle cx={cx} cy={cy} r={cr} fill="#000" />
                ) : (
                  <Rect x={hole.x} y={hole.y} width={hole.width} height={hole.height} rx={rectRadius} fill="#000" />
                ))}
            </Mask>
          </Defs>

          {/* Stratul intunecat cu gaura */}
          <Rect x={0} y={0} width={size.w} height={size.h} fill={DIM} mask="url(#spotlight)" />

          {/* Inel de highlight pe marginea gaurii (aceleasi coordonate) */}
          {hole &&
            (isCircle ? (
              <Circle cx={cx} cy={cy} r={cr} stroke={colors.accent} strokeWidth={3} fill="none" />
            ) : (
              <Rect
                x={hole.x}
                y={hole.y}
                width={hole.width}
                height={hole.height}
                rx={rectRadius}
                stroke={colors.accent}
                strokeWidth={3}
                fill="none"
              />
            ))}
        </Svg>
      </Animated.View>

      {/* Scout + bula */}
      <Animated.View style={[styles.bubbleWrap, { top: bubbleTop, opacity: fade }]} pointerEvents="none">
        <View style={styles.scoutRow}>
          <ScoutMascot size={64} />
          <View style={styles.bubble}>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Footer: progres + hint (deasupra nav bar-ului) */}
      <View style={[styles.footer, { bottom: insets.bottom + 24 }]} pointerEvents="none">
        <View style={styles.dotsRow}>
          {steps.map((_, k) => (
            <View key={k} style={[styles.dot, k === i && styles.dotActive]} />
          ))}
        </View>
        <Text style={styles.hint}>{i >= steps.length - 1 ? 'Atinge ca sa termini' : 'Atinge pentru continuare'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bubbleWrap: { position: 'absolute', left: 18, right: 18 },
  scoutRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubble: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '900' },
  body: { color: colors.textMuted, fontSize: 13.5, fontWeight: '600', lineHeight: 19 },

  footer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 10 },
  dotsRow: { flexDirection: 'row', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { backgroundColor: '#FFFFFF', width: 20 },
  hint: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
});
