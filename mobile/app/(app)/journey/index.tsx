// Journey — un singur drum infinit, side-scroller cu pet animat, LANDSCAPE.
// Toata estetica vine din WorldPack-ul mapat per pet species slug; daca pet-ul
// nu are config dedicat, fallback la DEFAULT_WORLD.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Svg, { Rect } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { getMyPet, petImageUrl } from '../../../src/api/pets';
import { colors } from '../../../src/theme/colors';
import { Scene } from '../../../src/journey/Scene';
import { MOCK_QUESTIONS, type JourneyObstacle } from '../../../src/journey/mock';
import { getWorldForPet } from '../../../src/journey/worlds';
import { computeBiomeTransition } from '../../../src/journey/worlds/util';

type Phase = 'walking' | 'arriving' | 'asking' | 'feedback';

const MIN_WALK_MS = 14000;
const MAX_WALK_MS = 18000;
const DISTANCE_TICK_MS = 90;
const BIOME_EVERY = 500;

const STACK_OPTIONS = {
  orientation: 'landscape' as const,
  statusBarHidden: true,
  navigationBarHidden: true,
  autoHideHomeIndicator: true,
};

export default function JourneyScreen() {
  const petQuery = useQuery({ queryKey: ['my-pet'], queryFn: getMyPet });
  const pet = petQuery.data?.pet ?? null;
  const petImg = petImageUrl(pet?.species.imagePath ?? null);

  // World pack = sursa de adevar pentru toata estetica scenei.
  const world = useMemo(() => getWorldForPet(pet?.species.slug), [pet?.species.slug]);

  const [phase, setPhase] = useState<Phase>('walking');
  const [obstacle, setObstacle] = useState<JourneyObstacle | null>(null);
  const [obstacleSeq, setObstacleSeq] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [distance, setDistance] = useState(0);

  // Tranzitie biome cu interpolare smooth pe ultimii 20% din segment + info
  // pt crossfade celestial (soare/luna).
  const transition = useMemo(
    () => computeBiomeTransition(world, distance, BIOME_EVERY),
    [world, distance],
  );
  const biome = transition.effective;

  useEffect(() => {
    if (phase !== 'walking') return;
    const id = setInterval(() => {
      setDistance((d) => d + 1);
    }, DISTANCE_TICK_MS);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'walking') return;
    const delay = MIN_WALK_MS + Math.random() * (MAX_WALK_MS - MIN_WALK_MS);
    const id = setTimeout(() => {
      // Compunem obstacolul: shape random din WorldPack + intrebare random
      // din pool-ul mock. La Faza 2 intrebarile vin din cache AI.
      const shape = world.obstacles[Math.floor(Math.random() * world.obstacles.length)];
      const question = MOCK_QUESTIONS[Math.floor(Math.random() * MOCK_QUESTIONS.length)];
      const next: JourneyObstacle = {
        id: `obs-${Date.now()}-${obstacleSeq}`,
        shapeKey: shape.key,
        question,
      };
      setObstacle(next);
      setPhase('arriving');
    }, delay);
    return () => clearTimeout(id);
  }, [phase, obstacleSeq, world]);

  const handleArrive = useCallback(() => {
    setPhase((p) => (p === 'arriving' ? 'asking' : p));
  }, []);

  const handleAnswer = useCallback(
    (idx: number) => {
      if (phase !== 'asking' || !obstacle) return;
      const correct = idx === obstacle.question.correctIndex;
      setFeedback(correct ? 'correct' : 'wrong');
      setPhase('feedback');
      setTimeout(() => {
        setObstacle(null);
        setFeedback(null);
        setObstacleSeq((s) => s + 1);
        setPhase('walking');
      }, 1500);
    },
    [phase, obstacle],
  );

  if (petQuery.isPending) {
    return (
      <>
        <Stack.Screen options={STACK_OPTIONS} />
        <StatusBar hidden />
        <View style={[styles.fullScreen, styles.center]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </>
    );
  }

  if (!pet) {
    return (
      <>
        <Stack.Screen options={STACK_OPTIONS} />
        <StatusBar hidden />
        <View style={[styles.fullScreen, styles.center, { gap: 16 }]}>
          <Text style={styles.errorText}>Nu am gasit pet-ul echipat.</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtnInline}>
            <Text style={styles.backInlineText}>Inapoi</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={STACK_OPTIONS} />
      <StatusBar hidden />
      <View style={styles.fullScreen}>
        <Scene
          world={world}
          transition={transition}
          petImageUrl={petImg}
          obstacle={obstacle}
          walking={phase === 'walking' || phase === 'arriving'}
          onArrive={handleArrive}
        />

        <View style={styles.topBar} pointerEvents="box-none">
          <Pressable onPress={() => router.back()} hitSlop={16} style={styles.pauseBtn}>
            <PauseIcon />
          </Pressable>
          <View style={styles.topPill}>
            <Text style={styles.biomeText}>{biome.name}</Text>
            <Text style={styles.distanceText}>{distance} m</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.bottomArea} pointerEvents="box-none">
          {phase === 'asking' && obstacle && (
            <AskingPanel
              petName={pet.name}
              obstacle={obstacle}
              onAnswer={handleAnswer}
              accentColor={biome.accent}
            />
          )}
          {phase === 'feedback' && obstacle && feedback && (
            <FeedbackPanel
              feedback={feedback}
              line={
                feedback === 'correct'
                  ? obstacle.question.successLine
                  : obstacle.question.failLine
              }
            />
          )}
          {(phase === 'walking' || phase === 'arriving') && (
            <WalkingHint approaching={phase === 'arriving'} petName={pet.name} />
          )}
        </View>
      </View>
    </>
  );
}

// =====================================================================

function AskingPanel({
  petName,
  obstacle,
  onAnswer,
  accentColor,
}: {
  petName: string;
  obstacle: JourneyObstacle;
  onAnswer: (idx: number) => void;
  accentColor: string;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fade]);

  return (
    <Animated.View
      style={{
        opacity: fade,
        transform: [
          { translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
        ],
      }}
    >
      <View style={[styles.bubble, { borderColor: accentColor }]}>
        <Text style={styles.bubbleName}>{petName}</Text>
        <Text style={styles.bubbleText}>{obstacle.question.prompt}</Text>
      </View>
      <View style={styles.optionsRow}>
        {obstacle.question.options.map((opt, idx) => (
          <Pressable
            key={idx}
            onPress={() => onAnswer(idx)}
            style={({ pressed }) => [styles.optionBtn, pressed && styles.optionPressed]}
          >
            <Text style={styles.optionText}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

function FeedbackPanel({ feedback, line }: { feedback: 'correct' | 'wrong'; line: string }) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [fade]);
  const color = feedback === 'correct' ? '#27AE60' : '#E67E22';
  return (
    <Animated.View style={{ opacity: fade, alignItems: 'center' }}>
      <View style={styles.feedbackCard}>
        <Text style={[styles.feedbackTag, { color }]}>
          {feedback === 'correct' ? 'BRAVO!' : 'HMMM...'}
        </Text>
        <Text style={styles.feedbackLine}>{line}</Text>
      </View>
    </Animated.View>
  );
}

function PauseIcon() {
  return (
    <Svg width={14} height={16}>
      <Rect x={1} y={1} width={4} height={14} rx={1.5} fill="rgba(45, 42, 74, 0.95)" />
      <Rect x={9} y={1} width={4} height={14} rx={1.5} fill="rgba(45, 42, 74, 0.95)" />
    </Svg>
  );
}

function WalkingHint({ approaching, petName }: { approaching: boolean; petName: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
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
  }, [pulse]);

  return (
    <View style={styles.walkingHint}>
      <Animated.Text
        style={[
          styles.walkingHintText,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
          },
        ]}
      >
        {approaching ? `${petName} a vazut ceva...` : `${petName} merge cu tine`}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.text, fontSize: 15, fontWeight: '600' },

  topBar: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  pauseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnInline: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  backInlineText: { color: colors.text, fontWeight: '700' },
  topPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  biomeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  distanceText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },

  bottomArea: {
    position: 'absolute',
    bottom: 16,
    left: '32%',
    right: 16,
    alignItems: 'stretch',
  },

  bubble: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 2,
    marginBottom: 10,
  },
  bubbleName: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  bubbleText: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },

  optionsRow: { flexDirection: 'row', gap: 8 },
  optionBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionPressed: { backgroundColor: colors.cardAlt, transform: [{ scale: 0.97 }] },
  optionText: { color: colors.text, fontSize: 14, fontWeight: '700', textAlign: 'center' },

  feedbackCard: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  feedbackTag: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  feedbackLine: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },

  walkingHint: { alignItems: 'center' },
  walkingHintText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
