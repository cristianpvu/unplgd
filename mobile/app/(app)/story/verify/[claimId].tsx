import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
  getClaim,
  postVerifyAnswer,
  absoluteAudioUrl,
  ttsSynthesize,
  type VerifyChatResponse,
} from '../../../../src/api/stories';
import {
  ensureMicPermission,
  isSttAvailable,
  playPetVoice,
  playPetVoiceAwait,
  startListening,
  stopDevice,
  stopRemoteAudio,
  type SttHandle,
} from '../../../../src/lib/speech';
import { Orb, BackgroundMesh, type OrbPhase } from '../../../../src/ui/voice/Orb';
import { colors } from '../../../../src/theme/colors';

type Phase = OrbPhase;
type VerifyDoneState = Extract<VerifyChatResponse, { done: true }>;

export default function StoryVerify() {
  const { claimId } = useLocalSearchParams<{ claimId: string }>();
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>('idle');
  const [aiText, setAiText] = useState('');
  const [aiShown, setAiShown] = useState('');
  const [userPartial, setUserPartial] = useState('');
  const [userFinalEcho, setUserFinalEcho] = useState('');
  const [final, setFinal] = useState<VerifyDoneState | null>(null);
  const sttRef = useRef<SttHandle | null>(null);
  const introPlayedRef = useRef(false);
  const cancelledRef = useRef(false);

  const claimQuery = useQuery({
    queryKey: ['stories', 'claim', claimId],
    queryFn: () => getClaim(claimId),
    enabled: !!claimId,
  });

  const claim = claimQuery.data?.claim;
  const authorName = claim?.story.author.name;

  // Typewriter pe replicile AI-ului
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

  // Intro la mount, dupa ce avem claim-ul si numele autorului. Joaca o singura
  // data, apoi auto-mic.
  useEffect(() => {
    if (introPlayedRef.current) return;
    if (!authorName) return;
    introPlayedRef.current = true;
    const intro = `${authorName} mi-a zis ca ti-a spus o poveste! Hai sa vedem cat ai retinut. Cand esti gata, raspunde-mi la intrebari.`;
    void (async () => {
      try {
        const { audioUrl } = await ttsSynthesize(intro);
        await speakAndListen(intro, absoluteAudioUrl(audioUrl));
      } catch {
        await speakAndListen(intro, null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorName]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      stopDevice();
      void stopRemoteAudio();
      sttRef.current?.stop();
    };
  }, []);

  async function speakAndListen(text: string, audioUrl: string | null) {
    cancelledRef.current = false;
    setPhase('speaking');
    setAiText(text);
    setUserFinalEcho('');
    try {
      await playPetVoiceAwait(text, audioUrl);
    } catch {
      // ignoram — typewriter ramane vizibil
    }
    setAiShown(text);
    setPhase('idle');
    if (cancelledRef.current) return;
    // iOS: AVAudioSession revine din playback la default lent, dam timp
    // sa se aseze inainte sa pornim STT.
    const handoffMs = Platform.OS === 'ios' ? 600 : 250;
    setTimeout(() => {
      if (!cancelledRef.current) void startListen();
    }, handoffMs);
  }

  async function startListen() {
    if (!isSttAvailable()) {
      Alert.alert('Microfon indisponibil', 'Apasa pe input ca sa scrii.');
      return;
    }
    const ok = await ensureMicPermission();
    if (!ok) {
      Alert.alert('Microfon necesar', 'Activeaza microfonul din Setari.');
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
    mutationFn: (msg: string) => postVerifyAnswer(claimId, msg),
    onSuccess: (resp) => {
      if ('done' in resp && resp.done) {
        setFinal(resp);
        setPhase('speaking');
        setAiText(resp.summary);
        qc.invalidateQueries({ queryKey: ['stories', 'inbox'] });
        qc.invalidateQueries({ queryKey: ['me'] });
        if (resp.ttsError) Alert.alert('TTS error', resp.ttsError);
        void (async () => {
          try {
            await playPetVoiceAwait(resp.summary, absoluteAudioUrl(resp.summaryAudioUrl));
          } catch {}
          setAiShown(resp.summary);
          setPhase('idle');
        })();
      } else if ('reply' in resp && resp.reply) {
        void speakAndListen(resp.reply, absoluteAudioUrl(resp.replyAudioUrl));
      }
    },
    onError: (err: any) => {
      Alert.alert('Hopa', err?.message ?? 'Povestitorul nu raspunde acum');
      setPhase('idle');
    },
  });

  function onMicPress() {
    if (final) return;
    if (phase === 'listening') stopListen();
    else if (phase === 'speaking') cancelSpeak();
    else if (phase === 'idle') void startListen();
  }

  function onReplaySummary() {
    if (!final) return;
    void playPetVoice(final.summary, absoluteAudioUrl(final.summaryAudioUrl));
  }

  if (claimQuery.isPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <BackgroundMesh />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (claimQuery.error || !claim) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <BackgroundMesh />
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={14} style={styles.smallBtn}>
            <Text style={styles.smallBtnText}>×</Text>
          </Pressable>
          <Text style={styles.headerName}>Verificare</Text>
          <View style={{ width: 38 }} />
        </View>
        <Text style={styles.errorText}>Nu am putut incarca verificarea.</Text>
      </SafeAreaView>
    );
  }

  const finalPassed = final?.status === 'VERIFIED';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <BackgroundMesh />

      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={14} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>×</Text>
        </Pressable>
        <Text style={styles.headerName} numberOfLines={1}>
          De la {claim.story.author.name}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.body}>
        <Orb phase={phase} />

        <Text style={styles.statusText}>{statusForPhase(phase, !!final, finalPassed)}</Text>

        <ScrollView
          style={styles.transcriptScroll}
          contentContainerStyle={styles.transcriptContent}
          showsVerticalScrollIndicator={false}
        >
          {final ? (
            <View
              style={[
                styles.finalCard,
                finalPassed ? styles.finalCardWin : styles.finalCardLoss,
              ]}
            >
              <Text style={styles.finalEmoji}>
                {finalPassed ? '🎉' : final.canRetry ? '🤔' : '😅'}
              </Text>
              <Text style={styles.finalTitle}>
                {finalPassed
                  ? `${final.score} din 5 — bravo!`
                  : final.canRetry
                    ? 'Aproape! Mai incearca o data.'
                    : 'Hmm, nu prea ai prins-o.'}
              </Text>
              <Text style={styles.finalSummary}>{aiShown}</Text>
              {finalPassed && (final.xp.listener > 0 || final.xp.author > 0) && (
                <View style={styles.xpRow}>
                  <Text style={styles.xpText}>+{final.xp.listener} XP pentru tine</Text>
                  <Text style={styles.xpText}>+{final.xp.author} XP pentru prieten</Text>
                </View>
              )}
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
              Apasa pe microfon si raspunde la intrebare.
            </Text>
          )}
        </ScrollView>
      </View>

      {final ? (
        <View style={styles.finalActions}>
          <Pressable
            onPress={onReplaySummary}
            style={({ pressed }) => [styles.replayBtn, pressed && styles.btnPressed]}
          >
            <Text style={styles.replayText}>🔊  Asculta din nou</Text>
          </Pressable>
          {finalPassed && (
            <Pressable
              onPress={() => router.replace(`/(app)/story/extend/${claim.story.id}`)}
              style={({ pressed }) => [styles.continueBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.continueText}>Continua povestea</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.replace('/(app)/story')}
            style={({ pressed }) => [styles.doneBtn, pressed && styles.btnPressed]}
          >
            <Text style={styles.doneText}>Inchide</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.controls}>
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

function statusForPhase(phase: Phase, isFinal: boolean, passed: boolean): string {
  if (isFinal) return passed ? 'Bravo, ai retinut!' : 'Verificare incheiata';
  switch (phase) {
    case 'listening':
      return 'Te ascult...';
    case 'thinking':
      return 'Verific raspunsul...';
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 12,
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
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
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

  transcriptScroll: { flex: 1, width: '100%' },
  transcriptContent: { paddingTop: 12, paddingBottom: 24, minHeight: 100 },
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
    borderRadius: 22,
    padding: 18,
    gap: 8,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  finalCardWin: { borderColor: colors.success },
  finalCardLoss: { borderColor: colors.border },
  finalEmoji: { fontSize: 48 },
  finalTitle: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  finalSummary: { color: colors.text, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  xpRow: { flexDirection: 'row', gap: 12, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' },
  xpText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800',
    backgroundColor: 'rgba(46,204,113,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },

  controls: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 8,
  },
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
  continueBtn: {
    backgroundColor: colors.success,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  errorText: {
    color: colors.danger,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 24,
  },
});
