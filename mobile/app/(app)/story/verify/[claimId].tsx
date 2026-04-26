import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getClaim,
  postVerifyAnswer,
  absoluteAudioUrl,
  type VerifyChatResponse,
} from '../../../../src/api/stories';
import {
  playRemoteAudio,
  speakDevice,
  stopDevice,
  stopRemoteAudio,
} from '../../../../src/lib/speech';
import { MicButton } from '../../../../src/ui/MicButton';
import { colors } from '../../../../src/theme/colors';

type Bubble =
  | { id: string; role: 'pet' | 'me'; text: string }
  | { id: string; role: 'final'; final: VerifyDoneState };

type VerifyDoneState = Extract<VerifyChatResponse, { done: true }>;

export default function StoryVerify() {
  const { claimId } = useLocalSearchParams<{ claimId: string }>();
  const qc = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState('');
  const [final, setFinal] = useState<VerifyDoneState | null>(null);

  const claimQuery = useQuery({
    queryKey: ['stories', 'claim', claimId],
    queryFn: () => getClaim(claimId),
    enabled: !!claimId,
  });

  // Mesaj de bun-venit pe baza autorului — pet-ul intreaba prima intrebare
  // dupa ce trimitem PRIMUL mesaj. Aratam un placeholder de start ca user-ul
  // sa stie ca trebuie sa scrie ceva ("ok, sunt gata!").
  useEffect(() => {
    if (claimQuery.data && bubbles.length === 0) {
      const author = claimQuery.data.claim.story.author.name;
      const intro = `${author} mi-a zis ca ti-a spus o poveste! Hai sa vedem cat ai retinut. Cand esti gata, scrie-mi.`;
      setBubbles([{ id: 'intro', role: 'pet', text: intro }]);
      speakDevice(intro);
    }
    return () => {
      stopDevice();
      void stopRemoteAudio();
    };
  }, [claimQuery.data]);

  const send = useMutation({
    mutationFn: (msg: string) => postVerifyAnswer(claimId, msg),
    onSuccess: (resp) => {
      if ('done' in resp && resp.done) {
        setFinal(resp);
        setBubbles((b) => [
          ...b,
          { id: `f-${Date.now()}`, role: 'final', final: resp },
        ]);
        qc.invalidateQueries({ queryKey: ['stories', 'inbox'] });
        qc.invalidateQueries({ queryKey: ['me'] });

        const audio = absoluteAudioUrl(resp.summaryAudioUrl);
        if (audio) void playRemoteAudio(audio).catch(() => speakDevice(resp.summary));
        else speakDevice(resp.summary);
      } else if ('reply' in resp && resp.reply) {
        const reply = resp.reply;
        setBubbles((b) => [...b, { id: `p-${Date.now()}`, role: 'pet', text: reply }]);
        speakDevice(reply);
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    },
    onError: (err: any) => {
      Alert.alert('Hopa', err?.message ?? 'Buddy nu raspunde acum');
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

  if (claimQuery.isPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (claimQuery.error || !claimQuery.data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Verificare</Text>
          <View style={{ width: 44 }} />
        </View>
        <Text style={styles.errorText}>Nu am putut incarca verificarea</Text>
      </SafeAreaView>
    );
  }

  const claim = claimQuery.data.claim;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          De la {claim.story.author.name}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.chat}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {bubbles.map((b) => (
            <BubbleView key={b.id} bubble={b} />
          ))}
          {send.isPending && (
            <View style={styles.typing}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={styles.typingText}>Buddy se gandeste...</Text>
            </View>
          )}
        </ScrollView>

        {final ? (
          <View style={styles.finalActions}>
            <Pressable
              onPress={() => router.replace('/(app)/story')}
              style={({ pressed }) => [styles.doneBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.doneText}>Inchide</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.inputRow}>
            <MicButton
              disabled={send.isPending}
              onTranscript={(text) => {
                setDraft((d) => (d ? `${d} ${text}` : text));
              }}
            />
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Spune sau scrie ce-ai retinut..."
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

function BubbleView({ bubble }: { bubble: Bubble }) {
  if (bubble.role === 'final') {
    const f = bubble.final;
    const passed = f.status === 'VERIFIED';
    return (
      <View
        style={[
          styles.finalCard,
          passed ? styles.finalCardWin : styles.finalCardLoss,
        ]}
      >
        <Text style={styles.finalEmoji}>
          {passed ? '🎉' : f.canRetry ? '🤔' : '😅'}
        </Text>
        <Text style={styles.finalTitle}>
          {passed
            ? `${f.score} din 5 — bravo!`
            : f.canRetry
              ? 'Aproape! Mai incearca o data.'
              : 'Hmm, nu prea ai prins-o.'}
        </Text>
        <Text style={styles.finalSummary}>{f.summary}</Text>
        {passed && (f.xp.listener > 0 || f.xp.author > 0) && (
          <View style={styles.xpRow}>
            <Text style={styles.xpText}>+{f.xp.listener} XP pentru tine</Text>
            <Text style={styles.xpText}>+{f.xp.author} XP pentru prieten</Text>
          </View>
        )}
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
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },

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
    borderRadius: 20,
    padding: 18,
    gap: 8,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 2,
  },
  finalCardWin: { backgroundColor: colors.cardAlt, borderColor: colors.success },
  finalCardLoss: { backgroundColor: colors.card, borderColor: colors.border },
  finalEmoji: { fontSize: 48 },
  finalTitle: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  finalSummary: { color: colors.text, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  xpRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  xpText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800',
    backgroundColor: 'rgba(46,204,113,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },

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
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  doneBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  errorText: { color: colors.danger, textAlign: 'center', marginTop: 24 },
});
