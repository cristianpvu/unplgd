import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  absolutePetAudioUrl,
  clearPetChat,
  getMyPet,
  getPetChatHistory,
  petImageUrl,
  sendPetChat,
} from '../../src/api/pets';
import { ApiError } from '../../src/api/client';
import { playPetVoice, stopDevice, stopRemoteAudio } from '../../src/lib/speech';
import { colors } from '../../src/theme/colors';

type Bubble = { id: string; role: 'user' | 'assistant'; text: string };

export default function PetChat() {
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState('');
  const [kbHeight, setKbHeight] = useState(0);

  const petQuery = useQuery({ queryKey: ['pet'], queryFn: getMyPet });
  const historyQuery = useQuery({ queryKey: ['pet', 'chat'], queryFn: getPetChatHistory });

  const pet = petQuery.data?.pet;
  const petImage = petImageUrl(pet?.species.imagePath ?? null);
  const petName = pet?.name ?? 'Pet';

  // Mesaj de intro la chat gol — random din catchphrases-urile speciei (per
  // personaj, deja in DB). NU il salvam in Redis: e doar UI, modelul nu-l
  // vede, iar el saluta natural la primul reply real.
  function pickIntro(): string {
    const phrases = pet?.species.catchphrases ?? [];
    if (phrases.length === 0) return `Hei.`;
    return phrases[Math.floor(Math.random() * phrases.length)] ?? phrases[0]!;
  }

  // La prima incarcare, hidratam bubbles din history.
  useEffect(() => {
    if (!historyQuery.data) return;
    if (historyQuery.data.messages.length === 0) {
      if (pet) {
        setBubbles([{ id: 'intro', role: 'assistant', text: pickIntro() }]);
      }
      return;
    }
    setBubbles(
      historyQuery.data.messages.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.content,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyQuery.data, pet]);

  useEffect(() => {
    return () => {
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

  const send = useMutation({
    mutationFn: (msg: string) => sendPetChat(msg),
    onSuccess: (resp) => {
      setBubbles((b) => [
        ...b,
        { id: `a-${Date.now()}`, role: 'assistant', text: resp.reply },
      ]);
      void playPetVoice(resp.reply, absolutePetAudioUrl(resp.replyAudioUrl));
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    },
    onError: (err: any) => {
      const msg =
        err instanceof ApiError && err.code === 'rate_limited'
          ? 'Prea multe mesaje, ia o pauza scurta.'
          : err?.message ?? `${petName} nu raspunde acum.`;
      Alert.alert('Hopa', msg);
    },
  });

  const reset = useMutation({
    mutationFn: () => clearPetChat(),
    onSuccess: () => {
      setBubbles([{ id: 'intro', role: 'assistant', text: pickIntro() }]);
      qc.invalidateQueries({ queryKey: ['pet', 'chat'] });
      stopDevice();
      void stopRemoteAudio();
    },
  });

  function onSend() {
    const trimmed = draft.trim();
    if (!trimmed || send.isPending) return;
    setBubbles((b) => [
      ...b,
      { id: `u-${Date.now()}`, role: 'user', text: trimmed },
    ]);
    setDraft('');
    send.mutate(trimmed);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
          <Text style={styles.iconText}>←</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(app)/pets')}
          style={styles.headerCenter}
          hitSlop={8}
        >
          {petImage ? (
            <Image source={{ uri: petImage }} style={styles.headerAvatar} resizeMode="contain" />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
              <Text style={styles.headerAvatarEmoji}>🐾</Text>
            </View>
          )}
          <Text style={styles.headerTitle} numberOfLines={1}>
            {petName}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Alert.alert(
              'Conversatie noua?',
              `Stergi ce ai vorbit cu ${petName} pana acum.`,
              [
                { text: 'Anuleaza' },
                { text: 'Sterge', style: 'destructive', onPress: () => reset.mutate() },
              ],
            );
          }}
          hitSlop={12}
          style={styles.iconBtn}
        >
          <Text style={styles.iconText}>↺</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, paddingBottom: kbHeight > 0 ? kbHeight + insets.bottom : 0 }}>
        <ScrollView
          ref={scrollRef}
          style={styles.chat}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {historyQuery.isPending && (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accent} />
            </View>
          )}
          {bubbles.map((b) => (
            <BubbleRow key={b.id} bubble={b} />
          ))}
          {send.isPending && (
            <View style={styles.typing}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={styles.typingText}>{petName} se gandeste...</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputRow, { paddingBottom: kbHeight > 0 ? 6 : insets.bottom + 10 }]}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={`Scrie ceva pentru ${petName}...`}
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
      </View>
    </SafeAreaView>
  );
}

function BubbleRow({ bubble }: { bubble: Bubble }) {
  const isMe = bubble.role === 'user';
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  iconBtn: {
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
  iconText: { color: colors.text, fontSize: 22, fontWeight: '700' },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerAvatar: { width: 36, height: 36 },
  headerAvatarPlaceholder: {
    backgroundColor: colors.cardAlt,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarEmoji: { fontSize: 20 },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },

  chat: { flex: 1 },
  chatContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  center: { paddingTop: 40, alignItems: 'center' },

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
});
