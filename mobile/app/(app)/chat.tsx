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
import { MicControls } from '../../src/ui/voice/MicControls';
import { Orb } from '../../src/ui/voice/Orb';
import { Transcript } from '../../src/ui/voice/Transcript';
import { VoiceShell } from '../../src/ui/voice/VoiceShell';
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
import {
  ensureMicPermission,
  isSttAvailable,
  playPetVoice,
  playPetVoiceAwait,
  startListening,
  stopDevice,
  stopRemoteAudio,
  type SttHandle,
} from '../../src/lib/speech';
import { colors } from '../../src/theme/colors';

type Bubble = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  // Setat doar pe mesajele assistant pt care avem deja MP3 cache-uit pe backend
  // (intro la prima intrare, replies de la /pets/chat). Lipseste pe history-ul
  // mai vechi din Redis si pe mesajele user — atunci cadem pe device speak.
  audioUrl?: string | null;
};
type Phase = 'idle' | 'listening' | 'thinking' | 'speaking';
type Mode = 'live' | 'chat';

export default function PetChat() {
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState('');
  const [kbHeight, setKbHeight] = useState(0);
  const [mode, setMode] = useState<Mode>('live');
  const [phase, setPhase] = useState<Phase>('idle');
  // textul complet pe care vrem sa-l "scriem" cuvant cu cuvant in live mode
  const [livePetText, setLivePetText] = useState('');
  // ce s-a aratat pana acum din livePetText (typewriter)
  const [livePetShown, setLivePetShown] = useState('');
  // STT interim (cand vorbesti tu)
  const [livePartialUser, setLivePartialUser] = useState('');
  const liveSttRef = useRef<SttHandle | null>(null);
  // marker ca intro-ul a fost redat — nu il redam la fiecare schimbare de bubbles
  const introPlayedRef = useRef(false);
  // Daca user-ul a anulat redarea (pauza/back/switch), nu pornim auto-mic dupa
  // ce speakingul se rezolva — distingem cancel vs finish natural.
  const speakCancelledRef = useRef(false);

  const petQuery = useQuery({ queryKey: ['pet'], queryFn: getMyPet });
  const historyQuery = useQuery({ queryKey: ['pet', 'chat'], queryFn: getPetChatHistory });

  const pet = petQuery.data?.pet;
  const petImage = petImageUrl(pet?.species.imagePath ?? null);
  const petName = pet?.name ?? 'Pet';

  useEffect(() => {
    if (!historyQuery.data) return;
    if (historyQuery.data.messages.length === 0) {
      const intro = historyQuery.data.intro;
      if (intro) {
        setBubbles([
          {
            id: 'intro',
            role: 'assistant',
            text: intro.text,
            audioUrl: absolutePetAudioUrl(intro.audioUrl),
          },
        ]);
      } else if (pet) {
        // Fallback defensiv pt clienti vechi / cazul in care backend-ul n-a
        // putut sintetiza TTS — pastram macar un text vizibil. Liveul cade
        // pe device speak, ca inainte.
        const phrases = pet.species.catchphrases;
        const text = phrases.length > 0
          ? phrases[Math.floor(Math.random() * phrases.length)] ?? phrases[0]!
          : 'Hei.';
        setBubbles([{ id: 'intro', role: 'assistant', text }]);
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
      speakCancelledRef.current = true;
      stopDevice();
      void stopRemoteAudio();
      liveSttRef.current?.stop();
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

  // Typewriter — afisam livePetText cuvant cu cuvant in livePetShown
  useEffect(() => {
    if (!livePetText) {
      setLivePetShown('');
      return;
    }
    setLivePetShown('');
    const tokens = livePetText.split(/(\s+)/);
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(i + 1, tokens.length);
      setLivePetShown(tokens.slice(0, i).join(''));
      if (i >= tokens.length) clearInterval(id);
    }, 140);
    return () => clearInterval(id);
  }, [livePetText]);

  // Intro live: cand intram in live mode si avem un assistant message in coada,
  // il citim cu voce. introPlayedRef previne re-redarea la fiecare schimbare.
  // audioUrl-ul vine de la backend (intro sau reply) ca sa cantam in vocea
  // pet-ului; altfel `liveSpeak` cade pe expo-speech (robotic) — vezi speech.ts.
  useEffect(() => {
    if (mode !== 'live') return;
    if (introPlayedRef.current) return;
    if (bubbles.length === 0) return;
    const lastAsst = [...bubbles].reverse().find((b) => b.role === 'assistant');
    if (!lastAsst) return;
    introPlayedRef.current = true;
    void liveSpeak(lastAsst.text, lastAsst.audioUrl ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bubbles, mode]);

  async function liveSpeak(text: string, audioUrl: string | null) {
    speakCancelledRef.current = false;
    setPhase('speaking');
    setLivePetText(text);
    try {
      await playPetVoiceAwait(text, audioUrl);
    } catch {
      // ignore
    }
    setLivePetShown(text);
    setPhase('idle');
    // Auto-mic dupa ce a terminat de vorbit, doar daca nu a fost anulat.
    if (!speakCancelledRef.current) {
      // mic delay sa lasam phase sa se aseze inainte sa trecem la 'listening'
      setTimeout(() => {
        if (!speakCancelledRef.current) void liveStartListening();
      }, 200);
    }
  }

  async function liveStartListening() {
    if (!isSttAvailable()) {
      Alert.alert(
        'Microfon indisponibil',
        'Recunoasterea vocala nu e activa. Foloseste modul scris.',
      );
      return;
    }
    const ok = await ensureMicPermission();
    if (!ok) {
      Alert.alert(
        'Microfon necesar',
        `${petName} nu te poate auzi fara permisiune. Activeaza microfonul din Setari.`,
      );
      return;
    }
    // Daca intre timp am navigat away / am schimbat modul / am anulat
    // speak-ul, NU pornim mic-ul. Altfel AVAudioEngine.connect poate sa
    // arunce o exceptie pe iOS si crapa app-ul.
    if (speakCancelledRef.current) return;
    stopDevice();
    void stopRemoteAudio();
    setLivePetText('');
    setLivePetShown('');
    setLivePartialUser('');
    setPhase('listening');
    liveSttRef.current = await startListening({
      silenceTimeoutMs: 1500,
      onInterim: (text) => setLivePartialUser(text),
      onResult: (text) => {
        liveSttRef.current = null;
        const final = text.trim();
        setLivePartialUser('');
        if (!final) {
          setPhase('idle');
          return;
        }
        setBubbles((b) => [...b, { id: `u-${Date.now()}`, role: 'user', text: final }]);
        setPhase('thinking');
        send.mutate(final);
      },
      onError: (code, message) => {
        liveSttRef.current = null;
        setPhase('idle');
        setLivePartialUser('');
        if (code !== 'nomatch') {
          Alert.alert('Hopa', message ?? 'N-am inteles. Mai incearca.');
        }
      },
    });
  }

  function liveStopListening() {
    liveSttRef.current?.stop();
    liveSttRef.current = null;
    setPhase('idle');
    setLivePartialUser('');
  }

  function liveCancelSpeaking() {
    speakCancelledRef.current = true;
    stopDevice();
    void stopRemoteAudio();
    setLivePetShown(livePetText);
    setPhase('idle');
  }

  function switchMode(target: Mode) {
    if (target === mode) return;
    speakCancelledRef.current = true;
    liveSttRef.current?.stop();
    liveSttRef.current = null;
    stopDevice();
    void stopRemoteAudio();
    setLivePartialUser('');
    setLivePetText('');
    setLivePetShown('');
    setPhase('idle');
    if (target === 'live') {
      // re-redam ultimul assistant cand revenim in live
      introPlayedRef.current = false;
    }
    setMode(target);
  }

  const send = useMutation({
    mutationFn: (msg: string) => sendPetChat(msg),
    onSuccess: (resp) => {
      const audio = absolutePetAudioUrl(resp.replyAudioUrl);
      setBubbles((b) => [
        ...b,
        { id: `a-${Date.now()}`, role: 'assistant', text: resp.reply, audioUrl: audio },
      ]);
      if (mode === 'live') {
        void liveSpeak(resp.reply, audio);
      } else {
        void playPetVoice(resp.reply, audio);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      }
    },
    onError: (err: any) => {
      const msg =
        err instanceof ApiError && err.code === 'rate_limited'
          ? 'Prea multe mesaje, ia o pauza scurta.'
          : err?.message ?? `${petName} nu raspunde acum.`;
      Alert.alert('Hopa', msg);
      if (mode === 'live') setPhase('idle');
    },
  });

  const reset = useMutation({
    mutationFn: () => clearPetChat(),
    onSuccess: () => {
      speakCancelledRef.current = true;
      liveSttRef.current?.stop();
      liveSttRef.current = null;
      // Bubbles se vor repopula din historyQuery cand refetch-ul aduce
      // intro-ul nou de la backend (cu audio TTS). Pana atunci, golim ecranul.
      setBubbles([]);
      introPlayedRef.current = false;
      qc.invalidateQueries({ queryKey: ['pet', 'chat'] });
      stopDevice();
      void stopRemoteAudio();
      setLivePartialUser('');
      setPhase('idle');
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

  function onResetPress() {
    Alert.alert(
      'Conversatie noua?',
      `Stergi ce ai vorbit cu ${petName} pana acum.`,
      [
        { text: 'Anuleaza' },
        { text: 'Sterge', style: 'destructive', onPress: () => reset.mutate() },
      ],
    );
  }

  if (mode === 'live') {
    return (
      <LiveView
        petImage={petImage}
        petName={petName}
        phase={phase}
        livePetShown={livePetShown}
        livePartialUser={livePartialUser}
        onBack={() => router.back()}
        onSwitchToChat={() => switchMode('chat')}
        onReset={onResetPress}
        onMicPress={() => {
          if (phase === 'listening') liveStopListening();
          else if (phase === 'speaking') liveCancelSpeaking();
          else if (phase === 'idle') void liveStartListening();
        }}
      />
    );
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
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => switchMode('live')}
            hitSlop={12}
            style={styles.iconBtn}
            accessibilityLabel="Mod apel"
          >
            <Text style={styles.iconText}>🎙️</Text>
          </Pressable>
          <Pressable onPress={onResetPress} hitSlop={12} style={styles.iconBtn}>
            <Text style={styles.iconText}>↺</Text>
          </Pressable>
        </View>
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

type LiveProps = {
  petImage: string | null;
  petName: string;
  phase: Phase;
  livePetShown: string;
  livePartialUser: string;
  onBack: () => void;
  onSwitchToChat: () => void;
  onReset: () => void;
  onMicPress: () => void;
};

function LiveView({
  petImage,
  petName,
  phase,
  livePetShown,
  livePartialUser,
  onBack,
  onSwitchToChat,
  onReset,
  onMicPress,
}: LiveProps) {
  const status =
    phase === 'listening'
      ? 'Te ascult...'
      : phase === 'thinking'
        ? `${petName} se gandeste`
        : phase === 'speaking'
          ? `${petName} vorbeste`
          : `Apasa pe microfon si vorbeste cu ${petName}`;

  return (
    <VoiceShell
      title={petName}
      phase={phase}
      status={status}
      onClose={onBack}
      rightButton={{
        label: '💬',
        onPress: onSwitchToChat,
        accessibilityLabel: 'Mod scris',
      }}
      centerpiece={
        <Orb phase={phase} size={260} subtle>
          {petImage ? (
            <Image
              source={{ uri: petImage }}
              style={liveStyles.petImg}
              resizeMode="contain"
            />
          ) : (
            <Text style={liveStyles.petEmoji}>🐾</Text>
          )}
        </Orb>
      }
    >
      <View style={liveStyles.actions}>
        <Transcript
          phase={phase}
          aiShown={livePetShown}
          userPartial={livePartialUser}
          userFinalEcho=""
          placeholder={`Spune-i orice, ${petName} e mereu curios.`}
        />
        <MicControls
          phase={phase}
          onPress={onMicPress}
          showFinish={phase === 'idle'}
          finishLabel="Conversatie noua"
          onFinish={onReset}
        />
      </View>
    </VoiceShell>
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
  headerActions: { flexDirection: 'row', gap: 8 },
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

const liveStyles = StyleSheet.create({
  // Imaginea pet-ului ocupa cea mai mare parte din interiorul orb-ului
  // (260px). Lasam ceva margine ca animatia de pulse sa nu duca marginile
  // imaginii peste halo-ul SVG.
  petImg: { width: 230, height: 230 },
  petEmoji: { fontSize: 110 },
  actions: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 18,
    justifyContent: 'flex-end',
  },
});
