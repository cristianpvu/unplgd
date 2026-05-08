import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  postCreateChat,
  resetCreateDraft,
  absoluteAudioUrl,
  ttsSynthesize,
  type FinalStory,
  type StoryProgress,
} from '../../../src/api/stories';
import { ApiError } from '../../../src/api/client';
import {
  playPetVoice,
  speakDevice,
  stopDevice,
  stopRemoteAudio,
} from '../../../src/lib/speech';
import { MicButton } from '../../../src/ui/MicButton';
import { colors } from '../../../src/theme/colors';

type ChatBubble =
  | { id: string; role: 'pet' | 'me'; text: string }
  | { id: string; role: 'final'; story: FinalStory };

const INTRO_TEXT =
  'Salut! Sunt Povestitorul. Hai sa cream o poveste impreuna. Imi spui despre ce vrei sa fie?';
const INTRO_BUBBLE: ChatBubble = { id: 'intro', role: 'pet', text: INTRO_TEXT };
const FINISH_NOW_MESSAGE = 'Vreau sa termin povestea acum, te rog!';

const QUICK_REPLIES = [
  { label: 'Nu stiu, ajuta-ma 🤔', message: 'Nu stiu, da-mi tu cateva idei!' },
  { label: 'Surprinde-ma! 🎲', message: 'Surprinde-ma cu ceva amuzant!' },
];

export default function StoryCreate() {
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [bubbles, setBubbles] = useState<ChatBubble[]>([INTRO_BUBBLE]);
  const [draft, setDraft] = useState('');
  const [final, setFinal] = useState<FinalStory | null>(null);
  const [progress, setProgress] = useState<StoryProgress>({ gathered: 0, total: 5 });
  const [kbHeight, setKbHeight] = useState(0);
  const sttBaseRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { audioUrl } = await ttsSynthesize(INTRO_TEXT);
        if (cancelled) return;
        await playPetVoice(INTRO_TEXT, absoluteAudioUrl(audioUrl));
      } catch {
        if (cancelled) return;
        speakDevice(INTRO_TEXT);
      }
    })();
    return () => {
      cancelled = true;
      stopDevice();
      void stopRemoteAudio();
    };
  }, []);

  useEffect(() => {
    const sShow = Keyboard.addListener('keyboardDidShow', (e) => {
      setKbHeight(e.endCoordinates.height);
    });
    const sHide = Keyboard.addListener('keyboardDidHide', () => {
      setKbHeight(0);
    });
    return () => {
      sShow.remove();
      sHide.remove();
    };
  }, []);

  const bottomPad = kbHeight > 0 ? 6 : 10 + insets.bottom;

  const send = useMutation({
    mutationFn: (msg: string) => postCreateChat(msg),
    onSuccess: (resp) => {
      if ('finalStory' in resp && resp.finalStory) {
        const story = resp.finalStory;
        setFinal(story);
        setProgress({ gathered: 5, total: 5 });
        setBubbles((b) => [...b, { id: `f-${story.id}`, role: 'final', story }]);
        qc.invalidateQueries({ queryKey: ['stories', 'mine'] });
        if (story.ttsError) Alert.alert('TTS error', story.ttsError);
        void playPetVoice(story.body, absoluteAudioUrl(story.bodyAudioUrl));
      } else if ('reply' in resp && resp.reply) {
        const reply = resp.reply;
        setBubbles((b) => [...b, { id: `p-${Date.now()}`, role: 'pet', text: reply }]);
        if (resp.progress) setProgress(resp.progress);
        void playPetVoice(reply, absoluteAudioUrl(resp.replyAudioUrl));
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    },
    onError: (err: any) => {
      const msg =
        err instanceof ApiError && err.code === 'daily_limit'
          ? 'Ai creat deja o poveste azi! Vino maine.'
          : err?.message ?? 'Povestitorul nu raspunde acum';
      Alert.alert('Hopa', msg);
    },
  });

  const reset = useMutation({
    mutationFn: () => resetCreateDraft(),
    onSuccess: async () => {
      setBubbles([INTRO_BUBBLE]);
      setFinal(null);
      setProgress({ gathered: 0, total: 5 });
      stopDevice();
      await stopRemoteAudio();
      try {
        const { audioUrl } = await ttsSynthesize(INTRO_TEXT);
        await playPetVoice(INTRO_TEXT, absoluteAudioUrl(audioUrl));
      } catch {
        speakDevice(INTRO_TEXT);
      }
    },
  });

  function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || send.isPending || final) return;
    setBubbles((b) => [...b, { id: `m-${Date.now()}`, role: 'me', text: trimmed }]);
    setDraft('');
    send.mutate(trimmed);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }

  const onSend = () => sendMessage(draft);
  const onQuickReply = (msg: string) => sendMessage(msg);
  const onFinishNow = () => {
    Alert.alert(
      'Termini povestea acum?',
      'Povestitorul va folosi ce ai inventat pana acum si va completa restul cu ceva amuzant.',
      [
        { text: 'Nu inca' },
        { text: 'Da, termin', onPress: () => sendMessage(FINISH_NOW_MESSAGE) },
      ],
    );
  };

  // Buton "termin acum" disponibil cand copilul a dat macar 2 raspunsuri.
  const canFinishEarly = !final && progress.gathered >= 2 && progress.gathered < 5;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.narratorBadge}>
            <BookIcon />
          </View>
          <View>
            <Text style={styles.headerTitle}>Povestitorul</Text>
            <Text style={styles.headerSubtitle}>
              {send.isPending ? 'scrie...' : final ? 'gata, salvata!' : 'creeaza poveste cu tine'}
            </Text>
          </View>
        </View>
        {bubbles.length > 1 && !final ? (
          <Pressable
            onPress={() => {
              Alert.alert('Sigur?', 'Pierzi povestea pe care o lucrezi.', [
                { text: 'Nu' },
                { text: 'Da, sterge', style: 'destructive', onPress: () => reset.mutate() },
              ]);
            }}
            hitSlop={12}
            style={styles.resetBtn}
          >
            <Text style={styles.resetText}>↺</Text>
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <ProgressDots gathered={progress.gathered} total={progress.total} done={!!final} />

      <View style={{ flex: 1, paddingBottom: kbHeight > 0 ? kbHeight + insets.bottom : 0 }}>
        <ScrollView
          ref={scrollRef}
          style={styles.chat}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {bubbles.map((b) => (
            <Bubble key={b.id} bubble={b} />
          ))}
          {send.isPending && (
            <View style={styles.typing}>
              <View style={styles.typingDots}>
                <TypingDot delay={0} />
                <TypingDot delay={150} />
                <TypingDot delay={300} />
              </View>
              <Text style={styles.typingText}>Povestitorul se gandeste...</Text>
            </View>
          )}
        </ScrollView>

        {final ? (
          <View style={[styles.finalActions, { paddingBottom: kbHeight > 0 ? 14 : 14 + insets.bottom }]}>
            <Pressable
              onPress={() => {
                void playPetVoice(final.body, absoluteAudioUrl(final.bodyAudioUrl));
              }}
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
          <>
            {!send.isPending && bubbles.length > 1 && bubbles[bubbles.length - 1]?.role === 'pet' && (
              <View style={styles.quickRow}>
                {QUICK_REPLIES.map((q) => (
                  <Pressable
                    key={q.label}
                    onPress={() => onQuickReply(q.message)}
                    disabled={send.isPending}
                    style={({ pressed }) => [styles.chip, pressed && styles.btnPressed]}
                  >
                    <Text style={styles.chipText}>{q.label}</Text>
                  </Pressable>
                ))}
                {canFinishEarly && (
                  <Pressable
                    onPress={onFinishNow}
                    disabled={send.isPending}
                    style={({ pressed }) => [
                      styles.chip,
                      styles.chipFinish,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <Text style={[styles.chipText, styles.chipFinishText]}>Termin acum ✓</Text>
                  </Pressable>
                )}
              </View>
            )}
            <View style={[styles.inputRow, { paddingBottom: bottomPad }]}>
              <MicButton
                disabled={send.isPending}
                onStart={() => {
                  sttBaseRef.current = draft;
                }}
                onTranscript={(text) => {
                  const base = sttBaseRef.current;
                  const sep = base && !base.endsWith(' ') ? ' ' : '';
                  setDraft(base + sep + text);
                }}
              />
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder="Scrie sau apasa pe microfon..."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={500}
                editable={!send.isPending}
              />
              <Pressable
                onPress={onSend}
                disabled={!draft.trim() || send.isPending}
                style={({ pressed }) => [
                  styles.sendBtn,
                  (!draft.trim() || send.isPending) && styles.sendBtnDisabled,
                  pressed && styles.btnPressed,
                ]}
              >
                <Text style={styles.sendText}>↑</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function ProgressDots({
  gathered,
  total,
  done,
}: {
  gathered: number;
  total: number;
  done: boolean;
}) {
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: total }).map((_, i) => {
        const filled = i < gathered;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              filled && styles.dotFilled,
              done && styles.dotDone,
            ]}
          />
        );
      })}
      <Text style={styles.progressLabel}>
        {done ? 'Gata!' : `${gathered}/${total} elemente`}
      </Text>
    </View>
  );
}

function Bubble({ bubble }: { bubble: ChatBubble }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  if (bubble.role === 'final') {
    return (
      <Animated.View style={[styles.finalCard, { opacity, transform: [{ translateY }] }]}>
        <Text style={styles.finalLabel}>POVESTEA TA</Text>
        <Text style={styles.finalTitle}>{bubble.story.title}</Text>
        <Text style={styles.finalBody}>{bubble.story.body}</Text>
      </Animated.View>
    );
  }

  const isMe = bubble.role === 'me';
  return (
    <Animated.View
      style={[
        styles.bubbleRow,
        isMe && styles.bubbleRowMe,
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubblePet]}>
        <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{bubble.text}</Text>
      </View>
    </Animated.View>
  );
}

function TypingDot({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 350,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, opacity]);
  return <Animated.View style={[styles.typingDot, { opacity }]} />;
}

function BookIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4Z"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8Z"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { color: colors.text, fontSize: 22, fontWeight: '700' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  narratorBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  headerSubtitle: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  resetBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetText: { color: colors.textMuted, fontSize: 22, fontWeight: '700' },

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  dotFilled: { backgroundColor: colors.accent },
  dotDone: { backgroundColor: colors.success },
  progressLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 'auto',
  },

  chat: { flex: 1 },
  chatContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },

  bubbleRow: { alignItems: 'flex-start' },
  bubbleRowMe: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubblePet: { backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  bubbleMe: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleText: { color: colors.text, fontSize: 16, lineHeight: 22 },
  bubbleTextMe: { color: '#FFFFFF' },

  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    paddingTop: 4,
  },
  typingDots: { flexDirection: 'row', gap: 4 },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  typingText: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },

  finalCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    gap: 8,
    borderWidth: 2,
    borderColor: colors.accent,
    marginTop: 8,
  },
  finalLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  finalTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  finalBody: { color: colors.text, fontSize: 16, lineHeight: 24 },

  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  chip: {
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  chipFinish: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipFinishText: { color: '#FFFFFF' },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    maxHeight: 120,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendText: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  btnPressed: { transform: [{ scale: 0.95 }], opacity: 0.85 },

  finalActions: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  replayBtn: {
    backgroundColor: colors.card,
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
