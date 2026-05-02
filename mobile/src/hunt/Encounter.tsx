import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  answerRun,
  engageMonster,
  finalizeMonster,
  type ChallengeRunDto,
  type EngageResponse,
  type MonsterType,
} from '../api/hunt';
import { colors } from '../theme/colors';
import { MicButton } from '../ui/MicButton';

const MONSTER_COLOR: Record<MonsterType, string> = {
  green: '#7DCEA0',
  yellow: '#F4D03F',
  red: '#E74C3C',
  gold: '#F1C40F',
};

const MONSTER_EMOJI: Record<MonsterType, string> = {
  green: '👻',
  yellow: '🐲',
  red: '👹',
  gold: '🐉',
};

type Props = {
  sessionId: string;
  monsterId: string;
  myCoords: { lat: number; lng: number };
  monsterCoords: { lat: number; lng: number };
  onClose: () => void;
};

export function Encounter({ sessionId, monsterId, myCoords, monsterCoords, onClose }: Props) {
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [engaged, setEngaged] = useState<EngageResponse | null>(null);
  const [tapCount, setTapCount] = useState(0);
  const [draftAnswer, setDraftAnswer] = useState('');
  const [now, setNow] = useState(Date.now());
  const sttBaseRef = useRef('');

  // Float animation pe sprite (sus-jos uniform).
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(float, { toValue: 0, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ]),
    ).start();
  }, [float]);

  // Auto-engage la deschidere — backend-ul valideaza distanta.
  const engageMut = useMutation({
    mutationFn: () => engageMonster(sessionId, monsterId, myCoords.lat, myCoords.lng),
    onSuccess: (resp) => setEngaged(resp),
    onError: (err: any) => {
      Alert.alert('Hopa', err?.message ?? 'Nu pot porni lupta', [
        { text: 'Inchide', onPress: onClose },
      ]);
    },
  });

  useEffect(() => {
    if (!engaged && !engageMut.isPending) {
      engageMut.mutate();
    }
  }, []);

  // Timer countdown pe expiresAt.
  useEffect(() => {
    if (!engaged) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [engaged]);

  // Permisiune camera la start.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission]);

  const answerMut = useMutation({
    mutationFn: ({ runId, answer }: { runId: string; answer: string }) =>
      answerRun(sessionId, monsterId, runId, answer),
    onSuccess: (resp, vars) => {
      if (!engaged) return;
      // Optimistic update pe run-ul propriu.
      const updatedRuns = engaged.runs.map((r) =>
        r.id === vars.runId
          ? {
              ...r,
              outcome: resp.correct ? ('CORRECT' as const) : ('WRONG' as const),
              feedback: resp.feedback,
            }
          : r,
      );
      setEngaged({ ...engaged, runs: updatedRuns });
      setTapCount(0);
      setDraftAnswer('');
    },
    onError: (err: any) => {
      Alert.alert('Hopa', err?.message ?? 'Eroare la trimitere');
    },
  });

  const finalizeMut = useMutation({
    mutationFn: () => finalizeMonster(sessionId, monsterId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hunt', 'session', sessionId] });
      onClose();
    },
    onError: (err: any) => {
      // Daca cineva nu a raspuns inca, lasam dialog si user-ul poate astepta.
      Alert.alert('Inca asteptam', err?.message ?? 'Mai sunt challenge-uri neraspunse');
    },
  });

  // Detectie: toate runs propriii au outcome != PENDING + nu mai sunt runs PENDING in echipa.
  const allDone =
    engaged && engaged.runs.length > 0 && engaged.runs.every((r) => r.outcome !== 'PENDING');
  // Auto-finalize cand toata echipa a terminat.
  useEffect(() => {
    if (allDone && !finalizeMut.isPending && !finalizeMut.isSuccess) {
      finalizeMut.mutate();
    }
  }, [allDone]);

  const myRuns = engaged?.runs.filter((r) => r.mine) ?? [];
  const currentRun = myRuns.find((r) => r.outcome === 'PENDING') ?? null;
  const teammateRuns = engaged?.runs.filter((r) => !r.mine) ?? [];
  const remainingMs = engaged?.expiresAt
    ? Math.max(0, new Date(engaged.expiresAt).getTime() - now)
    : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);

  if (permission === null || engageMut.isPending && !engaged) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const monsterType = engaged?.monster?.type ?? 'green';
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [-12, 12] });

  return (
    <View style={styles.container}>
      {permission?.granted ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0E0E10' }]} />
      )}

      <View style={styles.overlay}>
        <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.timer}>
            {remainingSec > 0 ? `${remainingSec}s` : 'Timpul a expirat'}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Text style={styles.closeIcon}>✕</Text>
          </Pressable>
        </View>

        <Animated.View style={[styles.spriteWrap, { transform: [{ translateY: floatY }] }]}>
          <View style={[styles.spriteBg, { backgroundColor: MONSTER_COLOR[monsterType] }]}>
            <Text style={styles.spriteEmoji}>{MONSTER_EMOJI[monsterType]}</Text>
          </View>
          {engaged?.monster && (
            <Text style={styles.monsterName}>{engaged.monster.name}</Text>
          )}
        </Animated.View>

        <View style={[styles.bottomCard, { paddingBottom: insets.bottom + 18 }]}>
          {currentRun ? (
            <ChallengePanel
              run={currentRun}
              tapCount={tapCount}
              onTap={() => setTapCount((c) => c + 1)}
              draft={draftAnswer}
              onDraftChange={setDraftAnswer}
              onSttStart={() => {
                sttBaseRef.current = draftAnswer;
              }}
              onSttTranscript={(t) => {
                const base = sttBaseRef.current;
                const sep = base && !base.endsWith(' ') ? ' ' : '';
                setDraftAnswer(base + sep + t);
              }}
              onSubmit={(answer) => answerMut.mutate({ runId: currentRun.id, answer })}
              submitting={answerMut.isPending}
            />
          ) : myRuns.length > 0 ? (
            <View style={styles.waitPanel}>
              <Text style={styles.waitTitle}>Ai terminat partea ta!</Text>
              <Text style={styles.waitSub}>
                {teammateRuns.some((r) => r.outcome === 'PENDING')
                  ? 'Asteptam coechipierii...'
                  : allDone
                    ? 'Calculam rezultatul...'
                    : 'Gata!'}
              </Text>
              <TeammateProgress runs={teammateRuns} />
            </View>
          ) : (
            <ActivityIndicator color={colors.accent} />
          )}
        </View>
      </View>
    </View>
  );
}

function ChallengePanel({
  run,
  tapCount,
  onTap,
  draft,
  onDraftChange,
  onSttStart,
  onSttTranscript,
  onSubmit,
  submitting,
}: {
  run: ChallengeRunDto;
  tapCount: number;
  onTap: () => void;
  draft: string;
  onDraftChange: (s: string) => void;
  onSttStart: () => void;
  onSttTranscript: (s: string) => void;
  onSubmit: (answer: string) => void;
  submitting: boolean;
}) {
  if (run.challenge.type === 'mcq' && run.challenge.options) {
    return (
      <View style={styles.panelInner}>
        <Text style={styles.promptLabel}>Provocarea ta</Text>
        <Text style={styles.promptText}>{run.challenge.prompt}</Text>
        <View style={styles.mcqGrid}>
          {run.challenge.options.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => onSubmit(opt)}
              disabled={submitting}
              style={({ pressed }) => [
                styles.mcqOption,
                submitting && styles.mcqOptionDisabled,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={styles.mcqOptionText}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  if (run.challenge.type === 'counting') {
    return (
      <View style={styles.panelInner}>
        <Text style={styles.promptLabel}>Provocarea ta</Text>
        <Text style={styles.promptText}>{run.challenge.prompt}</Text>
        <Pressable
          onPress={onTap}
          disabled={submitting}
          style={({ pressed }) => [styles.tapPad, pressed && styles.tapPadPressed]}
        >
          <Text style={styles.tapCount}>{tapCount}</Text>
          <Text style={styles.tapHint}>Atinge!</Text>
        </Pressable>
        <Pressable
          onPress={() => onSubmit(String(tapCount))}
          disabled={submitting || tapCount === 0}
          style={({ pressed }) => [
            styles.submitBtn,
            (submitting || tapCount === 0) && styles.submitBtnDisabled,
            pressed && styles.btnPressed,
          ]}
        >
          <Text style={styles.submitText}>
            {submitting ? 'Trimit...' : `Gata cu ${tapCount}`}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (run.challenge.type === 'riddle') {
    return (
      <View style={styles.panelInner}>
        <Text style={styles.promptLabel}>Provocarea ta</Text>
        <Text style={styles.promptText}>{run.challenge.prompt}</Text>
        <View style={styles.inputRow}>
          <MicButton
            disabled={submitting}
            onStart={onSttStart}
            onTranscript={onSttTranscript}
          />
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={onDraftChange}
            placeholder="Spune raspunsul"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={200}
            editable={!submitting}
          />
        </View>
        <Pressable
          onPress={() => onSubmit(draft.trim())}
          disabled={submitting || !draft.trim()}
          style={({ pressed }) => [
            styles.submitBtn,
            (submitting || !draft.trim()) && styles.submitBtnDisabled,
            pressed && styles.btnPressed,
          ]}
        >
          <Text style={styles.submitText}>{submitting ? 'Trimit...' : 'Trimit raspunsul'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Text style={styles.promptText}>Tip de challenge necunoscut: {run.challenge.type}</Text>
  );
}

function TeammateProgress({ runs }: { runs: ChallengeRunDto[] }) {
  // Grupare per user, contam done vs pending.
  const byUser = new Map<string, { done: number; total: number }>();
  for (const r of runs) {
    const cur = byUser.get(r.userId) ?? { done: 0, total: 0 };
    cur.total += 1;
    if (r.outcome !== 'PENDING') cur.done += 1;
    byUser.set(r.userId, cur);
  }
  if (byUser.size === 0) return null;
  return (
    <View style={styles.teammateRow}>
      {[...byUser.entries()].map(([userId, prog]) => (
        <View key={userId} style={styles.teammateChip}>
          <Text style={styles.teammateText}>
            {prog.done}/{prog.total}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' },
  overlay: { flex: 1 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  timer: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },

  spriteWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  spriteBg: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  spriteEmoji: { fontSize: 96 },
  monsterName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 18,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  bottomCard: {
    backgroundColor: 'rgba(15,15,18,0.92)',
    paddingHorizontal: 18,
    paddingTop: 18,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  panelInner: { gap: 12 },
  promptLabel: { color: '#A8A8B0', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  promptText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', lineHeight: 24 },

  mcqGrid: { gap: 10, marginTop: 4 },
  mcqOption: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  mcqOptionDisabled: { opacity: 0.5 },
  mcqOptionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },

  tapPad: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 18,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 6,
  },
  tapPadPressed: { transform: [{ scale: 0.98 }] },
  tapCount: { color: '#FFFFFF', fontSize: 64, fontWeight: '900' },
  tapHint: { color: '#A8A8B0', fontSize: 13, fontWeight: '700' },

  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    color: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
    maxHeight: 100,
  },

  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  btnPressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },

  waitPanel: { gap: 8, alignItems: 'center', paddingVertical: 12 },
  waitTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  waitSub: { color: '#A8A8B0', fontSize: 14, fontWeight: '600', textAlign: 'center' },

  teammateRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  teammateChip: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  teammateText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
