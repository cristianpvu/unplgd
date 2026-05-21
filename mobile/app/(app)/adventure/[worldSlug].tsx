import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  answerBoss,
  answerNode,
  completeAdventure,
  getAdventureWorlds,
  startAdventureRun,
  type AdventureArc,
  type CompleteResponse,
} from '../../../src/api/adventure';
import { colors } from '../../../src/theme/colors';

type Phase = 'intro' | 'node' | 'boss' | 'victory';

export default function AdventurePlay() {
  const { worldSlug } = useLocalSearchParams<{ worldSlug: string }>();
  const qc = useQueryClient();

  // Meta lumii (culori/nume) din cache-ul listei de lumi.
  const worldsQuery = useQuery({ queryKey: ['adventure', 'worlds'], queryFn: getAdventureWorlds });
  const world = worldsQuery.data?.worlds.find((w) => w.slug === worldSlug);
  const accent = world?.accentColor ?? colors.accent;
  const bg = world?.bgColor ?? '#0E2A1A';

  const [runId, setRunId] = useState<string | null>(null);
  const [arc, setArc] = useState<AdventureArc | null>(null);
  const [phase, setPhase] = useState<Phase>('intro');
  const [nodeIndex, setNodeIndex] = useState(0);

  const runMut = useMutation({
    mutationFn: () => startAdventureRun(worldSlug),
    onSuccess: (resp) => {
      setRunId(resp.runId);
      setArc(resp.arc);
      // Reluare: daca progresul exista, sarim la nodul curent.
      const ni = resp.progress?.nodeIndex ?? 0;
      setNodeIndex(Math.min(ni, resp.arc.nodes.length - 1));
      if (resp.progress?.bossDefeated) setPhase('victory');
      else setPhase('intro');
    },
  });

  useEffect(() => {
    if (worldSlug && !runMut.isPending && !runId) runMut.mutate();
  }, [worldSlug]);

  // Eroare la generare — afisam mesaj + retry in loc de spinner infinit.
  if (runMut.isError && !arc) {
    const msg =
      (runMut.error as any)?.message ?? 'Nu am putut crea aventura. Incearca din nou.';
    return (
      <View style={[styles.loading, { backgroundColor: bg }]}>
        <Text style={styles.errorTitle}>Hopa!</Text>
        <Text style={styles.loadingText}>{msg}</Text>
        <Pressable
          onPress={() => runMut.mutate()}
          style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.retryText}>Incearca din nou</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginTop: 12 }}>
          <Text style={styles.backLink}>Inapoi</Text>
        </Pressable>
      </View>
    );
  }

  if (runMut.isPending || !arc || !runId) {
    return (
      <View style={[styles.loading, { backgroundColor: bg }]}>
        <ActivityIndicator color="#FFFFFF" size="large" />
        <LoadingMessages
          petName={worldsQuery.data?.pet.name ?? null}
          worldName={world?.name ?? null}
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      {/* Header: progres + iesire */}
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.exitBtn}>
          <Text style={styles.exitIcon}>✕</Text>
        </Pressable>
        <ProgressDots
          total={arc.nodes.length}
          current={phase === 'boss' || phase === 'victory' ? arc.nodes.length : nodeIndex}
          accent={accent}
        />
        <View style={{ width: 36 }} />
      </View>

      {phase === 'intro' && (
        <IntroPhase
          arc={arc}
          accent={accent}
          petName={worldsQuery.data?.pet.name ?? 'Pet'}
          onStart={() => setPhase('node')}
        />
      )}

      {phase === 'node' && (
        <NodePhase
          key={nodeIndex}
          runId={runId}
          arc={arc}
          nodeIndex={nodeIndex}
          accent={accent}
          onAdvance={() => {
            if (nodeIndex + 1 < arc.nodes.length) {
              setNodeIndex(nodeIndex + 1);
            } else {
              setPhase('boss');
            }
          }}
        />
      )}

      {phase === 'boss' && (
        <BossPhase
          runId={runId}
          arc={arc}
          accent={accent}
          worldName={world?.name ?? ''}
          onVictory={() => setPhase('victory')}
        />
      )}

      {phase === 'victory' && (
        <VictoryPhase
          runId={runId}
          arc={arc}
          accent={accent}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ['adventure', 'worlds'] });
            qc.invalidateQueries({ queryKey: ['adventure', 'backgrounds'] });
            qc.invalidateQueries({ queryKey: ['pet'] });
            router.back();
          }}
        />
      )}
    </SafeAreaView>
  );
}

// Mesaje rotative cat timp AI-ul genereaza arcul (~15-20s, o singura data).
// Fac asteptarea sa para vie, nu blocata.
function LoadingMessages({
  petName,
  worldName,
}: {
  petName: string | null;
  worldName: string | null;
}) {
  const pet = petName ?? 'Prietenul tau';
  const messages = [
    worldName ? `${pet} pregateste ${worldName}...` : `${pet} pregateste aventura...`,
    `${pet} deseneaza harta...`,
    `${pet} ascunde surprize pe drum...`,
    `${pet} cheama boss-ul...`,
    'Inca putin, merita asteptarea!',
  ];
  const [idx, setIdx] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => {
      Animated.sequence([
        Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      // schimbam textul la mijlocul tranzitiei
      setTimeout(() => setIdx((i) => (i + 1) % messages.length), 250);
    }, 2600);
    return () => clearInterval(id);
  }, [fade, messages.length]);

  return (
    <Animated.Text style={[styles.loadingText, { opacity: fade }]}>
      {messages[idx]}
    </Animated.Text>
  );
}

// Sir de puncte care arata progresul pe harta.
function ProgressDots({ total, current, accent }: { total: number; current: number; accent: string }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i < current && { backgroundColor: accent },
            i === current && { backgroundColor: '#FFFFFF', transform: [{ scale: 1.3 }] },
          ]}
        />
      ))}
      <View style={[styles.bossDot, current >= total && { backgroundColor: accent }]}>
        <Text style={styles.bossDotText}>★</Text>
      </View>
    </View>
  );
}

// Bula de poveste a pet-ului (refolosita in toate fazele).
function PetSpeech({ text }: { text: string }) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [text, fade]);
  return (
    <Animated.View
      style={[
        styles.speechBubble,
        { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
      ]}
    >
      <Text style={styles.speechText}>{text}</Text>
    </Animated.View>
  );
}

function IntroPhase({
  arc,
  accent,
  petName,
  onStart,
}: {
  arc: AdventureArc;
  accent: string;
  petName: string;
  onStart: () => void;
}) {
  return (
    <View style={styles.phaseWrap}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={styles.petLabel}>{petName} spune:</Text>
        <PetSpeech text={arc.intro} />
      </View>
      <Pressable
        onPress={onStart}
        style={({ pressed }) => [styles.cta, { backgroundColor: accent }, pressed && styles.pressed]}
      >
        <Text style={styles.ctaText}>Sa incepem!</Text>
      </Pressable>
    </View>
  );
}

function NodePhase({
  runId,
  arc,
  nodeIndex,
  accent,
  onAdvance,
}: {
  runId: string;
  arc: AdventureArc;
  nodeIndex: number;
  accent: string;
  onAdvance: () => void;
}) {
  const node = arc.nodes[nodeIndex]!;
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<{ correct: boolean; line: string; fact: string } | null>(null);

  const mut = useMutation({
    mutationFn: (optionIndex: number) => answerNode(runId, nodeIndex, optionIndex),
    onSuccess: (resp) => {
      setResult({ correct: resp.correct, line: resp.line, fact: resp.fact });
    },
  });

  function pick(i: number) {
    if (mut.isPending || (result && result.correct)) return;
    setPicked(i);
    mut.mutate(i);
  }

  function retry() {
    setPicked(null);
    setResult(null);
  }

  return (
    <ScrollView contentContainerStyle={styles.phaseScroll}>
      <Text style={styles.narrative}>{node.narrative}</Text>
      <PetSpeech text={node.obstacle.prompt} />

      <View style={styles.options}>
        {node.obstacle.options.map((opt, i) => {
          const isPicked = picked === i;
          const showResult = result !== null && isPicked;
          return (
            <Pressable
              key={i}
              onPress={() => pick(i)}
              disabled={mut.isPending || (result?.correct ?? false)}
              style={({ pressed }) => [
                styles.option,
                showResult && (result!.correct ? styles.optionCorrect : styles.optionWrong),
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.optionText, showResult && { color: '#FFFFFF' }]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>

      {result && (
        <View style={[styles.feedback, result.correct ? styles.feedbackOk : styles.feedbackBad]}>
          <Text style={styles.feedbackLine}>{result.line}</Text>
          {result.correct && <Text style={styles.feedbackFact}>💡 {result.fact}</Text>}
        </View>
      )}

      {result &&
        (result.correct ? (
          <Pressable
            onPress={onAdvance}
            style={({ pressed }) => [styles.cta, { backgroundColor: accent }, pressed && styles.pressed]}
          >
            <Text style={styles.ctaText}>Mai departe →</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={retry}
            style={({ pressed }) => [styles.ctaGhost, pressed && styles.pressed]}
          >
            <Text style={styles.ctaGhostText}>Mai incercam o data</Text>
          </Pressable>
        ))}
    </ScrollView>
  );
}

function BossPhase({
  runId,
  arc,
  accent,
  worldName,
  onVictory,
}: {
  runId: string;
  arc: AdventureArc;
  accent: string;
  worldName: string;
  onVictory: () => void;
}) {
  const questions = arc.boss.questions;
  const [qIndex, setQIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  // HP boss = numar de raspunsuri corecte ramase. Scade la corect.
  const totalHp = questions.length;
  const [hp, setHp] = useState(totalHp);
  const hpAnim = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;

  const mut = useMutation({
    mutationFn: (optionIndex: number) => answerBoss(runId, qIndex, optionIndex),
    onSuccess: (resp) => {
      setLastCorrect(resp.correct);
      if (resp.correct) {
        const newHp = hp - 1;
        setHp(newHp);
        Animated.timing(hpAnim, {
          toValue: newHp / totalHp,
          duration: 400,
          useNativeDriver: false,
        }).start();
      } else {
        // Boss-ul isi revine putin vizual (shake), fara penalizare reala.
        Animated.sequence([
          Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]).start();
      }
    },
  });

  function pick(i: number) {
    if (mut.isPending || lastCorrect) return;
    setPicked(i);
    mut.mutate(i);
  }

  function next() {
    if (qIndex + 1 < questions.length) {
      setQIndex(qIndex + 1);
      setPicked(null);
      setLastCorrect(null);
    } else {
      onVictory();
    }
  }

  if (!started) {
    return (
      <View style={styles.phaseWrap}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={styles.bossTitle}>{arc.boss.intro ? '' : worldName}</Text>
          <View style={[styles.bossAvatar, { borderColor: accent }]}>
            <Text style={styles.bossAvatarText}>★</Text>
          </View>
          <PetSpeech text={arc.boss.intro} />
        </View>
        <Pressable
          onPress={() => setStarted(true)}
          style={({ pressed }) => [styles.cta, { backgroundColor: accent }, pressed && styles.pressed]}
        >
          <Text style={styles.ctaText}>Infrunta-l!</Text>
        </Pressable>
      </View>
    );
  }

  const q = questions[qIndex]!;
  return (
    <ScrollView contentContainerStyle={styles.phaseScroll}>
      {/* Boss HP */}
      <Animated.View
        style={[
          styles.bossBar,
          { transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) }] },
        ]}
      >
        <View style={styles.hpTrack}>
          <Animated.View
            style={[
              styles.hpFill,
              {
                backgroundColor: accent,
                width: hpAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              },
            ]}
          />
        </View>
        <Text style={styles.hpLabel}>BOSS</Text>
      </Animated.View>

      <PetSpeech text={q.prompt} />

      <View style={styles.options}>
        {q.options.map((opt, i) => {
          const isPicked = picked === i;
          const showResult = lastCorrect !== null && isPicked;
          return (
            <Pressable
              key={i}
              onPress={() => pick(i)}
              disabled={mut.isPending || (lastCorrect ?? false)}
              style={({ pressed }) => [
                styles.option,
                showResult && (lastCorrect ? styles.optionCorrect : styles.optionWrong),
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.optionText, showResult && { color: '#FFFFFF' }]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>

      {lastCorrect === true && (
        <Pressable
          onPress={next}
          style={({ pressed }) => [styles.cta, { backgroundColor: accent }, pressed && styles.pressed]}
        >
          <Text style={styles.ctaText}>
            {qIndex + 1 < questions.length ? 'Lovitura buna! Continua' : 'Ultima lovitura!'}
          </Text>
        </Pressable>
      )}
      {lastCorrect === false && (
        <Pressable
          onPress={() => {
            setPicked(null);
            setLastCorrect(null);
          }}
          style={({ pressed }) => [styles.ctaGhost, pressed && styles.pressed]}
        >
          <Text style={styles.ctaGhostText}>Hai inca o data</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function VictoryPhase({
  runId,
  arc,
  accent,
  onDone,
}: {
  runId: string;
  arc: AdventureArc;
  accent: string;
  onDone: () => void;
}) {
  const [result, setResult] = useState<CompleteResponse | null>(null);
  const mut = useMutation({
    mutationFn: () => completeAdventure(runId),
    onSuccess: (resp) => setResult(resp),
  });
  useEffect(() => {
    mut.mutate();
  }, []);

  const scale = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
  }, [scale]);

  return (
    <ScrollView contentContainerStyle={styles.phaseScroll}>
      <Animated.View style={{ alignItems: 'center', transform: [{ scale }], marginTop: 12 }}>
        <Text style={styles.victoryTag}>VICTORIE</Text>
        <Text style={styles.victoryTitle}>{arc.boss.victoryLine}</Text>
      </Animated.View>

      <PetSpeech text={arc.outro} />

      {mut.isPending && <ActivityIndicator color="#FFFFFF" style={{ marginTop: 20 }} />}

      {result && result.bondAwarded > 0 && (
        <View style={styles.rewardCard}>
          <Text style={styles.rewardLabel}>LEGATURA</Text>
          <Text style={[styles.rewardValue, { color: accent }]}>+{result.bondAwarded} XP</Text>
        </View>
      )}

      {result && result.unlockedBackgrounds.length > 0 && (
        <View style={styles.unlockSection}>
          <Text style={styles.unlockHeader}>Fundaluri deblocate</Text>
          {result.unlockedBackgrounds.map((b) => (
            <View key={b.key} style={styles.unlockCard}>
              {b.imageUrl ? (
                <Image source={{ uri: b.imageUrl }} style={styles.unlockImg} resizeMode="cover" />
              ) : (
                <View style={[styles.unlockImg, styles.unlockImgEmpty]} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.unlockName}>{b.name}</Text>
                {b.isNew && <Text style={[styles.unlockNew, { color: accent }]}>NOU!</Text>}
              </View>
            </View>
          ))}
          <Text style={styles.unlockHint}>Le poti pune pe profil din pagina Pet-uri.</Text>
        </View>
      )}

      {result && (
        <Pressable
          onPress={onDone}
          style={({ pressed }) => [styles.cta, { backgroundColor: accent }, pressed && styles.pressed]}
        >
          <Text style={styles.ctaText}>Gata</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 30 },
  loadingText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  errorTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  retryBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 8,
  },
  retryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  backLink: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '700' },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  exitBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitIcon: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  bossDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  bossDotText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },

  phaseWrap: { flex: 1, paddingHorizontal: 18, paddingBottom: 18 },
  phaseScroll: { paddingHorizontal: 18, paddingBottom: 32, gap: 16, flexGrow: 1 },

  petLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  speechBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
  },
  speechText: { color: colors.text, fontSize: 17, fontWeight: '700', lineHeight: 24 },
  narrative: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    fontStyle: 'italic',
  },

  options: { gap: 10 },
  option: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  optionCorrect: { backgroundColor: colors.success },
  optionWrong: { backgroundColor: colors.danger },
  optionText: { color: colors.text, fontSize: 15, fontWeight: '800', textAlign: 'center' },

  feedback: { borderRadius: 14, padding: 14, gap: 6 },
  feedbackOk: { backgroundColor: 'rgba(46,204,113,0.2)' },
  feedbackBad: { backgroundColor: 'rgba(255,79,107,0.2)' },
  feedbackLine: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', lineHeight: 21 },
  feedbackFact: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600', lineHeight: 19 },

  cta: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 'auto',
  },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  ctaGhost: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  ctaGhostText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },

  bossTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  bossAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  bossAvatarText: { fontSize: 48, color: '#FFFFFF' },
  bossBar: { gap: 4 },
  hpTrack: {
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.35)',
    overflow: 'hidden',
  },
  hpFill: { height: '100%', borderRadius: 7 },
  hpLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  victoryTag: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '900', letterSpacing: 3 },
  victoryTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 28,
  },
  rewardCard: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  rewardLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  rewardValue: { fontSize: 30, fontWeight: '900' },

  unlockSection: { gap: 10 },
  unlockHeader: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.4 },
  unlockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    padding: 10,
  },
  unlockImg: { width: 72, height: 48, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)' },
  unlockImgEmpty: { backgroundColor: 'rgba(255,255,255,0.15)' },
  unlockName: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  unlockNew: { fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 2 },
  unlockHint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
});
