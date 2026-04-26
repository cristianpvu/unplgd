import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
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
  'Hey! Sunt Buddy! Hai sa cream o poveste impreuna. Imi spui despre ce vrei sa fie?';
const INTRO_BUBBLE: ChatBubble = { id: 'intro', role: 'pet', text: INTRO_TEXT };

export default function StoryCreate() {
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [bubbles, setBubbles] = useState<ChatBubble[]>([INTRO_BUBBLE]);
  const [draft, setDraft] = useState('');
  const [final, setFinal] = useState<FinalStory | null>(null);
  const [kbOpen, setKbOpen] = useState(false);
  // Pastram draft-ul pre-existent cand pornim STT, ca live transcript-ul sa
  // se concateneze in spate fara sa stearga ce a tastat user-ul deja.
  const sttBaseRef = useRef('');

  // Citim cu voce introul la mount — TTS server-side (ElevenLabs) cu fallback
  // pe device daca pica. Cache-ul backend serveste mereu acelasi MP3 pt acelasi
  // text + voce, deci e gratis dupa primul play.
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

  // Track keyboard ca sa eliminam padding-ul bottom inset cand e deschisa
  // (altfel input ramane suspendat deasupra tastaturii cu spatiu gol).
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const sShow = Keyboard.addListener(showEvt, () => setKbOpen(true));
    const sHide = Keyboard.addListener(hideEvt, () => setKbOpen(false));
    return () => {
      sShow.remove();
      sHide.remove();
    };
  }, []);

  const bottomPad = kbOpen ? 6 : 10 + insets.bottom;

  const send = useMutation({
    mutationFn: (msg: string) => postCreateChat(msg),
    onSuccess: (resp) => {
      if ('finalStory' in resp && resp.finalStory) {
        const story = resp.finalStory;
        setFinal(story);
        setBubbles((b) => [
          ...b,
          { id: `f-${story.id}`, role: 'final', story },
        ]);
        qc.invalidateQueries({ queryKey: ['stories', 'mine'] });

        if (story.ttsError) {
          Alert.alert('TTS error', story.ttsError);
        } else if (story.ttsProvider) {
          // Diagnostic vizibil cat lucram la TTS — sa vedem cu ce vorbeste.
          Alert.alert('TTS provider', story.ttsProvider);
        }

        void playPetVoice(story.body, absoluteAudioUrl(story.bodyAudioUrl));
      } else if ('reply' in resp && resp.reply) {
        const reply = resp.reply;
        setBubbles((b) => [
          ...b,
          { id: `p-${Date.now()}`, role: 'pet', text: reply },
        ]);
        void playPetVoice(reply, absoluteAudioUrl(resp.replyAudioUrl));
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    },
    onError: (err: any) => {
      const msg =
        err instanceof ApiError && err.code === 'daily_limit'
          ? 'Ai creat deja o poveste azi! Vino maine.'
          : err?.message ?? 'Buddy nu raspunde acum';
      Alert.alert('Hopa', msg);
    },
  });

  const reset = useMutation({
    mutationFn: () => resetCreateDraft(),
    onSuccess: async () => {
      setBubbles([INTRO_BUBBLE]);
      setFinal(null);
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

  function onSend() {
    const trimmed = draft.trim();
    if (!trimmed || send.isPending || final) return;

    setBubbles((b) => [...b, { id: `m-${Date.now()}`, role: 'me', text: trimmed }]);
    setDraft('');
    send.mutate(trimmed);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Creeaza poveste</Text>
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
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
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={styles.typingText}>Buddy se gandeste...</Text>
            </View>
          )}
        </ScrollView>

        {final ? (
          <View style={[styles.finalActions, { paddingBottom: kbOpen ? 14 : 14 + insets.bottom }]}>
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
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ bubble }: { bubble: ChatBubble }) {
  if (bubble.role === 'final') {
    return (
      <View style={styles.finalCard}>
        <Text style={styles.finalLabel}>POVESTEA TA</Text>
        <Text style={styles.finalTitle}>{bubble.story.title}</Text>
        <Text style={styles.finalBody}>{bubble.story.body}</Text>
      </View>
    );
  }

  const isMe = bubble.role === 'me';
  return (
    <View style={[styles.bubbleRow, isMe && styles.bubbleRowMe]}>
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubblePet]}>
        <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{bubble.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  back: { color: colors.text, fontSize: 22, fontWeight: '700' },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  resetBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetText: { color: colors.textMuted, fontSize: 22, fontWeight: '700' },

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
    paddingLeft: 8,
    paddingTop: 4,
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

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
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
