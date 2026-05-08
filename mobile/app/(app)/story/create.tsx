import { useEffect, useRef, useState } from 'react';
import {
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
import Svg, {
  Circle,
  Defs,
  RadialGradient,
  Stop,
  G,
  Path,
} from 'react-native-svg';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  postCreateChat,
  resetCreateDraft,
  absoluteAudioUrl,
  ttsSynthesize,
  type FinalStory,
} from '../../../src/api/stories';
import { ApiError } from '../../../src/api/client';
import {
  ensureMicPermission,
  isSttAvailable,
  playPetVoice,
  playPetVoiceAwait,
  startListening,
  stopDevice,
  stopRemoteAudio,
  type SttHandle,
} from '../../../src/lib/speech';
import { colors } from '../../../src/theme/colors';

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking';

const INTRO_TEXT =
  'Salut! Sunt Povestitorul. Hai sa cream o poveste impreuna. Despre ce vrei sa fie?';
const FINISH_NOW_MESSAGE = 'Vreau sa termin povestea acum, te rog!';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

export default function StoryCreate() {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>('idle');
  const [aiText, setAiText] = useState('');
  const [aiShown, setAiShown] = useState('');
  const [userPartial, setUserPartial] = useState('');
  const [userFinalEcho, setUserFinalEcho] = useState('');
  const [final, setFinal] = useState<FinalStory | null>(null);
  const [hasSpoken, setHasSpoken] = useState(false);
  const sttRef = useRef<SttHandle | null>(null);
  const introPlayedRef = useRef(false);
  const cancelledRef = useRef(false);

  // Animated values pt orb si fundal
  const orbPulse = useRef(new Animated.Value(1)).current;
  const orbGlow = useRef(new Animated.Value(0.6)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const bgRotation = useRef(new Animated.Value(0)).current;

  // Background mesh — rotatie infinita lenta indiferent de faza, da impresia
  // ca "magia" e mereu in miscare.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(bgRotation, {
        toValue: 1,
        duration: 60_000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [bgRotation]);

  // Orb animation per faza
  useEffect(() => {
    orbPulse.stopAnimation();
    orbGlow.stopAnimation();
    ring1.stopAnimation();
    ring2.stopAnimation();
    ring3.stopAnimation();

    if (phase === 'idle') {
      // Breathe lent
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(orbPulse, {
            toValue: 1.04,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(orbPulse, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }

    if (phase === 'listening') {
      // Ripples expanding outward, pulse rapid pe orb
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(orbPulse, {
            toValue: 1.12,
            duration: 450,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(orbPulse, {
            toValue: 1,
            duration: 450,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      const rippleSeq = (anim: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: 1600,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
          ]),
        );
      pulseLoop.start();
      const r1 = rippleSeq(ring1, 0);
      const r2 = rippleSeq(ring2, 533);
      const r3 = rippleSeq(ring3, 1066);
      r1.start();
      r2.start();
      r3.start();
      return () => {
        pulseLoop.stop();
        r1.stop();
        r2.stop();
        r3.stop();
      };
    }

    if (phase === 'thinking') {
      // Glow oscileaza puternic — "se gandeste"
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(orbGlow, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(orbGlow, {
            toValue: 0.4,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }

    if (phase === 'speaking') {
      // Pulse rapid varied — ca o "voce" care varieaza
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(orbPulse, {
            toValue: 1.08,
            duration: 280,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(orbPulse, {
            toValue: 0.96,
            duration: 220,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(orbPulse, {
            toValue: 1.04,
            duration: 320,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(orbPulse, {
            toValue: 1,
            duration: 200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    }
  }, [phase, orbPulse, orbGlow, ring1, ring2, ring3]);

  // Typewriter AI: scriu aiText cuvant cu cuvant in aiShown
  useEffect(() => {
    if (!aiText) {
      setAiShown('');
      return;
    }
    setAiShown('');
    const tokens = aiText.split(/(\s+)/);
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(i + 1, tokens.length);
      setAiShown(tokens.slice(0, i).join(''));
      if (i >= tokens.length) clearInterval(id);
    }, 110);
    return () => clearInterval(id);
  }, [aiText]);

  // Intro la mount — reda introul si auto-mic dupa ce termina
  useEffect(() => {
    if (introPlayedRef.current) return;
    introPlayedRef.current = true;
    void (async () => {
      try {
        const { audioUrl } = await ttsSynthesize(INTRO_TEXT);
        await speakAndListen(INTRO_TEXT, absoluteAudioUrl(audioUrl));
      } catch {
        await speakAndListen(INTRO_TEXT, null);
      }
    })();
    return () => {
      cancelledRef.current = true;
      stopDevice();
      void stopRemoteAudio();
      sttRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function speakAndListen(text: string, audioUrl: string | null) {
    cancelledRef.current = false;
    setPhase('speaking');
    setAiText(text);
    setUserFinalEcho('');
    try {
      await playPetVoiceAwait(text, audioUrl);
    } catch {
      // ignoram — ramane typewriter-ul
    }
    setAiShown(text);
    setHasSpoken(true);
    setPhase('idle');
    if (cancelledRef.current) return;
    setTimeout(() => {
      if (!cancelledRef.current) void startListen();
    }, 250);
  }

  async function startListen() {
    if (!isSttAvailable()) {
      Alert.alert('Microfon indisponibil', 'Apasa pe input ca sa scrii.');
      return;
    }
    const ok = await ensureMicPermission();
    if (!ok) {
      Alert.alert(
        'Microfon necesar',
        'Activeaza microfonul din Setari ca sa vorbesti cu Povestitorul.',
      );
      return;
    }
    if (cancelledRef.current) return;
    stopDevice();
    void stopRemoteAudio();
    setUserPartial('');
    setUserFinalEcho('');
    setAiText('');
    setAiShown('');
    setPhase('listening');
    sttRef.current = await startListening({
      silenceTimeoutMs: 1500,
      onInterim: (text) => setUserPartial(text),
      onResult: (text) => {
        sttRef.current = null;
        const finalText = text.trim();
        setUserPartial('');
        if (!finalText) {
          setPhase('idle');
          return;
        }
        setUserFinalEcho(finalText);
        setPhase('thinking');
        send.mutate(finalText);
      },
      onError: (code, message) => {
        sttRef.current = null;
        setPhase('idle');
        setUserPartial('');
        if (code !== 'nomatch') {
          Alert.alert('Hopa', message ?? 'N-am inteles. Mai incearca.');
        }
      },
    });
  }

  function stopListen() {
    sttRef.current?.stop();
    sttRef.current = null;
    setPhase('idle');
    setUserPartial('');
  }

  function cancelSpeak() {
    cancelledRef.current = true;
    stopDevice();
    void stopRemoteAudio();
    setAiShown(aiText);
    setPhase('idle');
  }

  const send = useMutation({
    mutationFn: (msg: string) => postCreateChat(msg),
    onSuccess: (resp) => {
      if ('finalStory' in resp && resp.finalStory) {
        const story = resp.finalStory;
        setFinal(story);
        setPhase('speaking');
        setAiText(story.body);
        qc.invalidateQueries({ queryKey: ['stories', 'mine'] });
        if (story.ttsError) Alert.alert('TTS error', story.ttsError);
        void (async () => {
          try {
            await playPetVoiceAwait(story.body, absoluteAudioUrl(story.bodyAudioUrl));
          } catch {}
          setAiShown(story.body);
          setPhase('idle');
        })();
      } else if ('reply' in resp && resp.reply) {
        void speakAndListen(resp.reply, absoluteAudioUrl(resp.replyAudioUrl));
      }
    },
    onError: (err: any) => {
      const msg =
        err instanceof ApiError && err.code === 'daily_limit'
          ? 'Ai creat deja o poveste azi! Vino maine.'
          : err?.message ?? 'Povestitorul nu raspunde acum';
      Alert.alert('Hopa', msg);
      setPhase('idle');
    },
  });

  const reset = useMutation({
    mutationFn: () => resetCreateDraft(),
    onSuccess: async () => {
      cancelledRef.current = true;
      sttRef.current?.stop();
      sttRef.current = null;
      stopDevice();
      await stopRemoteAudio();
      setFinal(null);
      setHasSpoken(false);
      setAiText('');
      setAiShown('');
      setUserFinalEcho('');
      setUserPartial('');
      setPhase('idle');
      introPlayedRef.current = false;
      // Re-trigger intro
      void (async () => {
        try {
          const { audioUrl } = await ttsSynthesize(INTRO_TEXT);
          await speakAndListen(INTRO_TEXT, absoluteAudioUrl(audioUrl));
        } catch {
          await speakAndListen(INTRO_TEXT, null);
        }
      })();
    },
  });

  function onMicPress() {
    if (final) return;
    if (phase === 'listening') stopListen();
    else if (phase === 'speaking') cancelSpeak();
    else if (phase === 'idle') void startListen();
  }

  function onFinishNow() {
    Alert.alert(
      'Termini povestea acum?',
      'Povestitorul va folosi ce ati discutat si va completa restul.',
      [
        { text: 'Nu inca' },
        {
          text: 'Da',
          onPress: () => {
            cancelSpeak();
            stopListen();
            setUserFinalEcho(FINISH_NOW_MESSAGE);
            setPhase('thinking');
            send.mutate(FINISH_NOW_MESSAGE);
          },
        },
      ],
    );
  }

  function onResetPress() {
    Alert.alert('Poveste noua?', 'Pierzi conversatia curenta.', [
      { text: 'Anuleaza' },
      { text: 'Da, sterge', style: 'destructive', onPress: () => reset.mutate() },
    ]);
  }

  function onReplay() {
    if (!final) return;
    void playPetVoice(final.body, absoluteAudioUrl(final.bodyAudioUrl));
  }

  const canFinish = !final && hasSpoken && phase !== 'thinking';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <BackgroundMesh rotation={bgRotation} />

      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={14} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>×</Text>
        </Pressable>
        <Text style={styles.headerName}>Povestitorul</Text>
        <Pressable onPress={onResetPress} hitSlop={14} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>↺</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Orb
          phase={phase}
          orbPulse={orbPulse}
          orbGlow={orbGlow}
          ring1={ring1}
          ring2={ring2}
          ring3={ring3}
        />

        <Text style={styles.statusText}>{statusForPhase(phase, final)}</Text>

        <ScrollView
          style={styles.transcriptScroll}
          contentContainerStyle={styles.transcriptContent}
          showsVerticalScrollIndicator={false}
        >
          {final ? (
            <View style={styles.finalCard}>
              <Text style={styles.finalLabel}>POVESTEA TA</Text>
              <Text style={styles.finalTitle}>{final.title}</Text>
              <Text style={styles.finalBody}>{aiShown}</Text>
            </View>
          ) : userPartial ? (
            <Text style={styles.userTranscript}>{userPartial}</Text>
          ) : phase === 'thinking' && userFinalEcho ? (
            <Text style={styles.userTranscript}>{userFinalEcho}</Text>
          ) : aiShown ? (
            <Text style={styles.aiTranscript}>
              {aiShown}
              {phase === 'speaking' && <Text style={styles.cursor}>▍</Text>}
            </Text>
          ) : (
            <Text style={styles.placeholder}>
              Apasa pe microfon si spune-mi ce vrei sa inventam.
            </Text>
          )}
        </ScrollView>
      </View>

      {final ? (
        <View style={styles.finalActions}>
          <Pressable
            onPress={onReplay}
            style={({ pressed }) => [styles.replayBtn, pressed && styles.btnPressed]}
          >
            <Text style={styles.replayText}>🔊  Asculta din nou</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace('/(app)/story')}
            style={({ pressed }) => [styles.doneBtn, pressed && styles.btnPressed]}
          >
            <Text style={styles.doneText}>Gata, salvat in carnetel!</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.controls}>
          {canFinish && (
            <Pressable
              onPress={onFinishNow}
              style={({ pressed }) => [styles.finishChip, pressed && styles.btnPressed]}
            >
              <Text style={styles.finishChipText}>Termin povestea ✓</Text>
            </Pressable>
          )}
          <Pressable
            onPress={onMicPress}
            disabled={phase === 'thinking'}
            style={({ pressed }) => [
              styles.micBtn,
              phase === 'listening' && styles.micBtnListening,
              phase === 'speaking' && styles.micBtnSpeaking,
              phase === 'thinking' && styles.micBtnDisabled,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.micIcon}>{micIconForPhase(phase)}</Text>
          </Pressable>
          <Text style={styles.micLabel}>{micLabelForPhase(phase)}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function statusForPhase(phase: Phase, final: FinalStory | null): string {
  if (final) return 'Povestea ta · gata!';
  switch (phase) {
    case 'listening':
      return 'Te ascult...';
    case 'thinking':
      return 'Povestitorul se gandeste...';
    case 'speaking':
      return 'Povestitorul vorbeste';
    default:
      return 'Apasa pe microfon';
  }
}

function micIconForPhase(phase: Phase): string {
  switch (phase) {
    case 'listening':
      return '⏹';
    case 'speaking':
      return '⏸';
    case 'thinking':
      return '...';
    default:
      return '🎤';
  }
}

function micLabelForPhase(phase: Phase): string {
  switch (phase) {
    case 'listening':
      return 'Opreste';
    case 'speaking':
      return 'Sari';
    case 'thinking':
      return ' ';
    default:
      return 'Vorbeste';
  }
}

// ───────────── ORB ─────────────
function Orb({
  phase,
  orbPulse,
  orbGlow,
  ring1,
  ring2,
  ring3,
}: {
  phase: Phase;
  orbPulse: Animated.Value;
  orbGlow: Animated.Value;
  ring1: Animated.Value;
  ring2: Animated.Value;
  ring3: Animated.Value;
}) {
  const SIZE = 220;
  // Ripples cresc de la r=60 la r=110 cu fade
  const ringScaleFrom = 60;
  const ringScaleTo = 110;

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      {/* Halo + ripples in SVG bottom layer */}
      <Svg
        width={SIZE}
        height={SIZE}
        viewBox="0 0 240 240"
        style={StyleSheet.absoluteFillObject}
      >
        <Defs>
          <RadialGradient id="orbGlow" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0%" stopColor={colors.accent} stopOpacity="0.5" />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <AnimatedG opacity={orbGlow}>
          <Circle cx="120" cy="120" r="115" fill="url(#orbGlow)" />
        </AnimatedG>
        {phase === 'listening' && (
          <>
            <Ripple anim={ring1} from={ringScaleFrom} to={ringScaleTo} />
            <Ripple anim={ring2} from={ringScaleFrom} to={ringScaleTo} />
            <Ripple anim={ring3} from={ringScaleFrom} to={ringScaleTo} />
          </>
        )}
      </Svg>

      {/* Orb core — Animated.View pt scale, SVG inauntru pt gradient lucios */}
      <Animated.View
        style={{
          width: SIZE,
          height: SIZE,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: orbPulse }],
        }}
      >
        <Svg width={SIZE} height={SIZE} viewBox="0 0 240 240">
          <Defs>
            <RadialGradient id="orbGradient" cx="0.5" cy="0.45" r="0.65">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="35%" stopColor="#FFD9B0" stopOpacity="0.95" />
              <Stop offset="70%" stopColor={colors.accent} stopOpacity="0.85" />
              <Stop offset="100%" stopColor="#7B3FBF" stopOpacity="0.6" />
            </RadialGradient>
          </Defs>
          <Circle cx="120" cy="120" r="78" fill="url(#orbGradient)" />
          <Circle cx="98" cy="92" r="22" fill="#FFFFFF" opacity={0.55} />
          <Circle cx="92" cy="86" r="8" fill="#FFFFFF" opacity={0.95} />
        </Svg>
      </Animated.View>
    </View>
  );
}

function Ripple({
  anim,
  from,
  to,
}: {
  anim: Animated.Value;
  from: number;
  to: number;
}) {
  const radius = anim.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  const opacity = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.5, 0],
  });
  return (
    <AnimatedCircle
      cx="120"
      cy="120"
      r={radius}
      stroke={colors.accent}
      strokeWidth={2}
      fill="none"
      opacity={opacity}
    />
  );
}

// ───────────── BACKGROUND MESH ─────────────
function BackgroundMesh({ rotation }: { rotation: Animated.Value }) {
  const rotateZ = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <RadialGradient id="bg1" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0%" stopColor={colors.accent} stopOpacity="0.35" />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="bg2" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0%" stopColor="#7B3FBF" stopOpacity="0.32" />
            <Stop offset="100%" stopColor="#7B3FBF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="bg3" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0%" stopColor="#3FA3BF" stopOpacity="0.28" />
            <Stop offset="100%" stopColor="#3FA3BF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Path d="M0 0 H400 V800 H0 Z" fill={colors.bg} />
      </Svg>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ rotate: rotateZ }] },
        ]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient id="g1" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0%" stopColor={colors.accent} stopOpacity="0.45" />
              <Stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="g2" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0%" stopColor="#9B3FBF" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#9B3FBF" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="g3" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0%" stopColor="#3F8FBF" stopOpacity="0.35" />
              <Stop offset="100%" stopColor="#3F8FBF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="120" cy="180" r="280" fill="url(#g1)" />
          <Circle cx="320" cy="320" r="320" fill="url(#g2)" />
          <Circle cx="180" cy="600" r="300" fill="url(#g3)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  smallBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  headerName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  body: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 24,
    gap: 16,
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 8,
  },

  transcriptScroll: {
    flex: 1,
    width: '100%',
  },
  transcriptContent: {
    paddingTop: 12,
    paddingBottom: 24,
    minHeight: 100,
  },
  aiTranscript: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '600',
    textAlign: 'center',
  },
  userTranscript: {
    color: colors.accent,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingTop: 20,
  },
  cursor: { color: colors.accent, fontWeight: '900' },

  finalCard: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 22,
    padding: 18,
    gap: 6,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  finalLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  finalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  finalBody: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'left',
    marginTop: 6,
  },

  controls: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 8,
  },
  finishChip: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accent,
    marginBottom: 8,
  },
  finishChipText: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  micBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  micBtnListening: { backgroundColor: '#E55353' },
  micBtnSpeaking: { backgroundColor: colors.textMuted },
  micBtnDisabled: { opacity: 0.6 },
  micIcon: { fontSize: 36 },
  micLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  btnPressed: { transform: [{ scale: 0.95 }], opacity: 0.85 },

  finalActions: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 6,
    gap: 10,
  },
  replayBtn: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  replayText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  doneBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
