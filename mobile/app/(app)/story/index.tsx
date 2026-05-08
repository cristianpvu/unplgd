import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listInbox,
  listMyStories,
  startClaim,
  postCreateChat,
  postVerifyAnswer,
  postExtendChat,
  resetCreateDraft,
  resetExtendDraft,
  absoluteAudioUrl,
  ttsSynthesize,
  type InboxItem,
  type ClaimDetails,
} from '../../../src/api/stories';
import { ApiError } from '../../../src/api/client';
import { getMe } from '../../../src/api/me';
import { VoiceShell } from '../../../src/ui/voice/VoiceShell';
import { Transcript } from '../../../src/ui/voice/Transcript';
import { MicControls } from '../../../src/ui/voice/MicControls';
import { ChipGroup, BigChip, PillButton } from '../../../src/ui/voice/Chips';
import { useVoiceLoop } from '../../../src/ui/voice/useVoiceLoop';
import { AuthorChip } from '../../../src/story/AuthorChip';
import {
  FinalCreateCard,
  FinalVerifyCard,
  FinalExtendCard,
} from '../../../src/story/FinalCards';
import { colors } from '../../../src/theme/colors';

// Hub voice-first pentru povesti — orchestrator pentru 3 moduri (creare /
// verificare / extindere) intr-un singur ecran. Nu facem redirect — schimbam
// `mode` si replica naratorului, totul ramane in conversatie.
//
// Modurile:
//   welcome          → naratorul saluta + 2 chips (Cream / Mi-a povestit)
//   pickAuthor       → naratorul intreaba "de la cine?" + lista autori
//   create           → bucla STT/TTS pentru creare poveste
//   verify           → bucla STT/TTS pentru verificare
//   extend           → bucla STT/TTS pentru continuare
//   final-*          → final card + chips de tranzitie spre alte moduri
//
// Logica per-mod (intro text, send mutation, final state, transitions) e
// localizata in functii `enter*Mode` — fiecare mod e ~30 linii, nu se
// imprastie in fisier.

type ClaimContext = { id: string; story: ClaimDetails['story'] };

type Mode =
  | { kind: 'welcome' }
  | { kind: 'pickAuthor' }
  | { kind: 'create' }
  | { kind: 'verify'; claim: ClaimContext }
  | { kind: 'extend'; storyId: string; chainRootId: string }
  | { kind: 'final-create'; story: ReturnType<typeof asCreateFinal> }
  | { kind: 'final-verify'; claim: ClaimContext; result: VerifyDone }
  | { kind: 'final-extend'; result: ExtendDone };

import type {
  CreateChatResponse,
  ExtendChatResponse,
  ExtendFinalStory,
  FinalStory,
  VerifyChatResponse,
} from '../../../src/api/stories';

type CreateFinal = Extract<CreateChatResponse, { finalStory: FinalStory }>['finalStory'];
type VerifyDone = Extract<VerifyChatResponse, { done: true }>;
type ExtendDone = Extract<ExtendChatResponse, { finalStory: ExtendFinalStory }>;

function asCreateFinal(s: CreateFinal) {
  return s;
}

const FINISH_NOW_MESSAGE = 'Vreau sa termin povestea acum, te rog!';
const FINISH_EXTEND_MESSAGE = 'Vreau sa termin capitolul acum, te rog!';

export default function StoryHub() {
  const qc = useQueryClient();
  const meQuery = useQuery({ queryKey: ['me'], queryFn: getMe });
  const inbox = useQuery({ queryKey: ['stories', 'inbox'], queryFn: listInbox });
  const mine = useQuery({ queryKey: ['stories', 'mine'], queryFn: listMyStories });

  const voice = useVoiceLoop();
  const [mode, setMode] = useState<Mode>({ kind: 'welcome' });
  const [chipsVisible, setChipsVisible] = useState(false);
  const [hasSpoken, setHasSpoken] = useState(false);
  const [startingClaimId, setStartingClaimId] = useState<string | null>(null);
  const introPlayedRef = useRef(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const createdToday = mine.data?.stories.some(
    (s) => new Date(s.createdAt).getTime() >= today.getTime(),
  );
  const inboxItems = inbox.data?.items ?? [];

  // Chips fade-in cand se termina vocea naratorului si typewriter-ul a ajuns
  // la final. Ascundem chips-urile cand pleaca naratorul intr-o noua replica.
  useEffect(() => {
    if (
      voice.phase === 'idle' &&
      voice.aiShown &&
      voice.aiShown === voice.aiText
    ) {
      const t = setTimeout(() => setChipsVisible(true), 250);
      return () => clearTimeout(t);
    }
    setChipsVisible(false);
  }, [voice.phase, voice.aiShown, voice.aiText]);

  // Intro la mount
  useEffect(() => {
    if (introPlayedRef.current) return;
    if (!meQuery.data) return;
    introPlayedRef.current = true;
    void enterWelcome(meQuery.data.name, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meQuery.data]);

  // ───────────── helpers de tranzitie ─────────────

  async function enterWelcome(name: string, first: boolean) {
    setMode({ kind: 'welcome' });
    setHasSpoken(false);
    const text = first
      ? `Salut, ${name}! Ce vrei sa facem astazi cu povestile?`
      : `Inapoi! Ce vrei sa facem cu povestile, ${name}?`;
    await speakAnnouncement(text);
  }

  async function speakAnnouncement(text: string) {
    try {
      const { audioUrl } = await ttsSynthesize(text);
      await voice.speak(text, absoluteAudioUrl(audioUrl));
    } catch {
      await voice.speak(text, null);
    }
  }

  // ───────────── CREATE mode ─────────────

  const sendCreate = useMutation({
    mutationFn: (msg: string) => postCreateChat(msg),
    onSuccess: (resp) => {
      if ('finalStory' in resp && resp.finalStory) {
        const story = resp.finalStory;
        qc.invalidateQueries({ queryKey: ['stories', 'mine'] });
        if (story.ttsError) Alert.alert('TTS error', story.ttsError);
        setMode({ kind: 'final-create', story });
        void voice.speak(story.body, absoluteAudioUrl(story.bodyAudioUrl));
      } else if ('reply' in resp && resp.reply) {
        void voice.speakAndListen(resp.reply, absoluteAudioUrl(resp.replyAudioUrl), {
          onResult: (text) => sendCreate.mutate(text),
        });
        setHasSpoken(true);
      }
    },
    onError: (err: any) => {
      const msg =
        err instanceof ApiError && err.code === 'daily_limit'
          ? 'Ai creat deja o poveste azi! Vino maine.'
          : err?.message ?? 'Povestitorul nu raspunde acum';
      Alert.alert('Hopa', msg);
      setMode({ kind: 'welcome' });
    },
  });

  async function enterCreate() {
    setMode({ kind: 'create' });
    setHasSpoken(false);
    const text =
      'Hai sa cream o poveste impreuna. Despre ce vrei sa fie?';
    try {
      const { audioUrl } = await ttsSynthesize(text);
      await voice.speakAndListen(text, absoluteAudioUrl(audioUrl), {
        onResult: (msg) => sendCreate.mutate(msg),
      });
    } catch {
      await voice.speakAndListen(text, null, {
        onResult: (msg) => sendCreate.mutate(msg),
      });
    }
  }

  // ───────────── VERIFY mode ─────────────

  const startClaimMutation = useMutation({
    mutationFn: (storyId: string) => startClaim(storyId),
    onSuccess: ({ claimId }, storyId) => {
      qc.invalidateQueries({ queryKey: ['stories', 'inbox'] });
      const item = inboxItems.find((i) => i.storyId === storyId);
      const claim: ClaimContext = {
        id: claimId,
        story: {
          id: item?.storyId ?? storyId,
          title: item?.title ?? '',
          createdAt: item?.createdAt ?? '',
          author: item?.author ?? { id: '', name: '', avatarSvg: null },
        },
      };
      setStartingClaimId(null);
      void enterVerify(claim);
    },
    onError: (err: any) => {
      const msg =
        err instanceof ApiError && err.code === 'already_attempted'
          ? 'Ai incercat deja la povestea asta.'
          : err instanceof ApiError && err.code === 'story_expired'
            ? 'Povestea e prea veche, a expirat.'
            : err?.message ?? 'Nu am putut porni verificarea';
      Alert.alert('Hopa', msg);
      setStartingClaimId(null);
    },
  });

  const sendVerify = useMutation({
    mutationFn: (vars: { claimId: string; msg: string }) =>
      postVerifyAnswer(vars.claimId, vars.msg),
    onSuccess: (resp, vars) => {
      const m = mode;
      if (m.kind !== 'verify') return;
      if ('done' in resp && resp.done) {
        qc.invalidateQueries({ queryKey: ['stories', 'inbox'] });
        qc.invalidateQueries({ queryKey: ['me'] });
        if (resp.ttsError) Alert.alert('TTS error', resp.ttsError);
        setMode({ kind: 'final-verify', claim: m.claim, result: resp });
        void voice.speak(resp.summary, absoluteAudioUrl(resp.summaryAudioUrl));
      } else if ('reply' in resp && resp.reply) {
        void voice.speakAndListen(resp.reply, absoluteAudioUrl(resp.replyAudioUrl), {
          onResult: (text) => sendVerify.mutate({ claimId: vars.claimId, msg: text }),
        });
        setHasSpoken(true);
      }
    },
    onError: (err: any) => {
      Alert.alert('Hopa', err?.message ?? 'Povestitorul nu raspunde acum');
      setMode({ kind: 'welcome' });
    },
  });

  async function enterVerify(claim: ClaimContext) {
    setMode({ kind: 'verify', claim });
    setHasSpoken(false);
    const text = `${claim.story.author.name} mi-a zis ca ti-a spus o poveste! Hai sa vedem cat ai retinut. Cand esti gata, raspunde-mi.`;
    try {
      const { audioUrl } = await ttsSynthesize(text);
      await voice.speakAndListen(text, absoluteAudioUrl(audioUrl), {
        onResult: (msg) => sendVerify.mutate({ claimId: claim.id, msg }),
      });
    } catch {
      await voice.speakAndListen(text, null, {
        onResult: (msg) => sendVerify.mutate({ claimId: claim.id, msg }),
      });
    }
  }

  // ───────────── EXTEND mode ─────────────

  const sendExtend = useMutation({
    mutationFn: (vars: { storyId: string; msg: string }) =>
      postExtendChat(vars.storyId, vars.msg),
    onSuccess: (resp, vars) => {
      const m = mode;
      if (m.kind !== 'extend') return;
      if ('finalStory' in resp && resp.finalStory) {
        qc.invalidateQueries({ queryKey: ['stories', 'mine'] });
        qc.invalidateQueries({ queryKey: ['stories', 'inbox'] });
        qc.invalidateQueries({ queryKey: ['me'] });
        if (resp.finalStory.ttsError) Alert.alert('TTS error', resp.finalStory.ttsError);
        setMode({ kind: 'final-extend', result: resp });
        void voice.speak(
          resp.finalStory.body,
          absoluteAudioUrl(resp.finalStory.bodyAudioUrl),
        );
      } else if ('reply' in resp && resp.reply) {
        void voice.speakAndListen(resp.reply, absoluteAudioUrl(resp.replyAudioUrl), {
          onResult: (text) => sendExtend.mutate({ storyId: vars.storyId, msg: text }),
        });
        setHasSpoken(true);
      }
    },
    onError: (err: any) => {
      let msg = err?.message ?? 'Povestitorul nu raspunde acum';
      if (err instanceof ApiError) {
        if (err.code === 'daily_limit') msg = 'Ai creat sau continuat deja o poveste azi! Vino maine.';
        else if (err.code === 'chain_full') msg = 'Lantul povestii a atins limita maxima.';
        else if (err.code === 'already_extended') msg = 'Ai continuat deja aceasta poveste.';
        else if (err.code === 'already_in_chain') msg = 'Esti deja autor in lant.';
        else if (err.code === 'not_verified')
          msg = 'Trebuie sa verifici povestea inainte sa o continui.';
      }
      Alert.alert('Hopa', msg);
      setMode({ kind: 'welcome' });
    },
  });

  async function enterExtend(storyId: string, chainRootId: string) {
    setMode({ kind: 'extend', storyId, chainRootId });
    setHasSpoken(false);
    const text =
      'Acum poti continua povestea cu propriul capitol! Ce se mai intampla mai departe?';
    try {
      const { audioUrl } = await ttsSynthesize(text);
      await voice.speakAndListen(text, absoluteAudioUrl(audioUrl), {
        onResult: (msg) => sendExtend.mutate({ storyId, msg }),
      });
    } catch {
      await voice.speakAndListen(text, null, {
        onResult: (msg) => sendExtend.mutate({ storyId, msg }),
      });
    }
  }

  // ───────────── pickAuthor mode ─────────────

  function enterPickAuthor() {
    if (inboxItems.length === 0) {
      void speakAnnouncement(
        'Inca nu ti-a povestit nimeni. Cere unui prieten sa-ti spuna o poveste!',
      );
      return;
    }
    if (inboxItems.length === 1) {
      const item = inboxItems[0]!;
      void (async () => {
        await speakAnnouncement(
          `Doar ${item.author.name} ti-a povestit ceva. Hai sa vedem cat ai retinut!`,
        );
        if (!voice.isCancelled()) onPickStory(item);
      })();
      return;
    }
    setMode({ kind: 'pickAuthor' });
    void speakAnnouncement('De la cine ti-a povestit? Alege un prieten.');
  }

  function onPickStory(item: InboxItem) {
    setStartingClaimId(item.storyId);
    startClaimMutation.mutate(item.storyId);
  }

  // ───────────── mic / finish actions ─────────────

  function onMicPress() {
    if (mode.kind !== 'create' && mode.kind !== 'verify' && mode.kind !== 'extend') return;
    if (voice.phase === 'listening') voice.stopListen();
    else if (voice.phase === 'speaking') voice.cancelSpeak();
    else if (voice.phase === 'idle') {
      const opts = micResultOpts();
      if (opts) void voice.startListen(opts);
    }
  }

  function micResultOpts() {
    if (mode.kind === 'create') {
      return { onResult: (text: string) => sendCreate.mutate(text) };
    }
    if (mode.kind === 'verify') {
      const claimId = mode.claim.id;
      return { onResult: (text: string) => sendVerify.mutate({ claimId, msg: text }) };
    }
    if (mode.kind === 'extend') {
      const storyId = mode.storyId;
      return { onResult: (text: string) => sendExtend.mutate({ storyId, msg: text }) };
    }
    return null;
  }

  function onFinishNow() {
    if (mode.kind === 'create') {
      Alert.alert(
        'Termini povestea acum?',
        'Povestitorul va folosi ce ati discutat si va completa restul.',
        [
          { text: 'Nu inca' },
          {
            text: 'Da',
            onPress: () => {
              voice.cancelSpeak();
              voice.stopListen();
              voice.setThinking();
              sendCreate.mutate(FINISH_NOW_MESSAGE);
            },
          },
        ],
      );
    } else if (mode.kind === 'extend') {
      const storyId = mode.storyId;
      Alert.alert(
        'Termini capitolul acum?',
        'Povestitorul va folosi ce ati discutat si va completa creativ restul.',
        [
          { text: 'Nu inca' },
          {
            text: 'Da',
            onPress: () => {
              voice.cancelSpeak();
              voice.stopListen();
              voice.setThinking();
              sendExtend.mutate({ storyId, msg: FINISH_EXTEND_MESSAGE });
            },
          },
        ],
      );
    }
  }

  function onResetActiveMode() {
    if (mode.kind === 'create') {
      Alert.alert('Reia povestea?', 'Pierzi conversatia curenta.', [
        { text: 'Nu' },
        {
          text: 'Da',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetCreateDraft();
            } catch {}
            void enterCreate();
          },
        },
      ]);
    } else if (mode.kind === 'extend') {
      const storyId = mode.storyId;
      const chainRootId = mode.chainRootId;
      Alert.alert('Reia capitolul?', 'Pierzi conversatia curenta.', [
        { text: 'Nu' },
        {
          text: 'Da',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetExtendDraft(storyId);
            } catch {}
            void enterExtend(storyId, chainRootId);
          },
        },
      ]);
    }
  }

  // ───────────── render ─────────────

  const status = statusForMode(mode, voice.phase);
  const title = titleForMode(mode);
  const closeTarget = closeBehaviourForMode(mode);

  function onClose() {
    if (closeTarget === 'back-to-welcome') {
      voice.cancelSpeak();
      voice.stopListen();
      if (meQuery.data) void enterWelcome(meQuery.data.name, false);
    } else {
      voice.cleanup();
      router.back();
    }
  }

  const showFinishChip = hasSpoken && (mode.kind === 'create' || mode.kind === 'extend');

  const placeholderForMode =
    mode.kind === 'create'
      ? 'Apasa pe microfon si spune-mi ce vrei sa inventam.'
      : mode.kind === 'verify'
        ? 'Apasa pe microfon si raspunde la intrebare.'
        : mode.kind === 'extend'
          ? 'Apasa pe microfon si spune ce continuare imaginezi.'
          : '';

  return (
    <VoiceShell
      title={title}
      phase={voice.phase}
      status={status}
      onClose={onClose}
      rightButton={rightButtonForMode(mode, () => router.push('/(app)/story/mine'), onResetActiveMode)}
    >
      <View style={styles.actionsArea}>
        {/* Transcriptul si zona de actiuni difera per mod */}
        {mode.kind === 'welcome' && (
          <>
            <Transcript
              compact
              phase={voice.phase}
              aiShown={voice.aiShown}
              userPartial=""
              userFinalEcho=""
              placeholder=""
            />
            <ChipGroup visible={chipsVisible}>
              <BigChip
                label="Cream o poveste"
                sub={createdToday ? 'Ai creat azi · vino maine' : 'Inventeaza ceva nou'}
                variant="accent"
                disabled={!!createdToday}
                onPress={() => void enterCreate()}
              />
              <BigChip
                label="Mi-a povestit cineva"
                sub={
                  inbox.isPending
                    ? 'Se incarca...'
                    : inboxItems.length === 0
                      ? 'Nimeni inca'
                      : `${inboxItems.length} ${
                          inboxItems.length === 1 ? 'poveste' : 'povesti'
                        }`
                }
                variant="secondary"
                badge={inboxItems.length > 0 ? String(inboxItems.length) : null}
                onPress={enterPickAuthor}
              />
            </ChipGroup>
          </>
        )}

        {mode.kind === 'pickAuthor' && (
          <>
            <Transcript
              compact
              phase={voice.phase}
              aiShown={voice.aiShown}
              userPartial=""
              userFinalEcho=""
              placeholder=""
            />
            <ChipGroup visible={chipsVisible}>
              <PillButton
                label="← Inapoi"
                onPress={() => {
                  if (meQuery.data) void enterWelcome(meQuery.data.name, false);
                }}
              />
              <ScrollView
                style={styles.authorList}
                contentContainerStyle={styles.authorListContent}
                showsVerticalScrollIndicator={false}
              >
                {inboxItems.map((item) => (
                  <AuthorChip
                    key={item.storyId}
                    item={item}
                    isStarting={startingClaimId === item.storyId}
                    onPress={() => onPickStory(item)}
                  />
                ))}
              </ScrollView>
            </ChipGroup>
          </>
        )}

        {(mode.kind === 'create' ||
          mode.kind === 'verify' ||
          mode.kind === 'extend') && (
          <>
            <Transcript
              phase={voice.phase}
              aiShown={voice.aiShown}
              userPartial={voice.userPartial}
              userFinalEcho={voice.userFinalEcho}
              placeholder={placeholderForMode}
            />
            <MicControls
              phase={voice.phase}
              onPress={onMicPress}
              showFinish={showFinishChip}
              finishLabel={mode.kind === 'extend' ? 'Termin capitolul ✓' : 'Termin povestea ✓'}
              onFinish={onFinishNow}
            />
          </>
        )}

        {mode.kind === 'final-create' && (
          <>
            <Transcript
              phase={voice.phase}
              aiShown=""
              userPartial=""
              userFinalEcho=""
              placeholder=""
            >
              <FinalCreateCard story={mode.story} body={voice.aiShown} />
            </Transcript>
            <ChipGroup visible={chipsVisible}>
              <PillButton
                label="🔊 Asculta din nou"
                onPress={() =>
                  void voice.speak(
                    mode.story.body,
                    absoluteAudioUrl(mode.story.bodyAudioUrl),
                  )
                }
              />
              <PillButton
                label="Inapoi la inceput"
                onPress={() => {
                  if (meQuery.data) void enterWelcome(meQuery.data.name, false);
                }}
                variant="accent"
              />
            </ChipGroup>
          </>
        )}

        {mode.kind === 'final-verify' && (
          <>
            <Transcript
              phase={voice.phase}
              aiShown=""
              userPartial=""
              userFinalEcho=""
              placeholder=""
            >
              <FinalVerifyCard result={mode.result} body={voice.aiShown} />
            </Transcript>
            <ChipGroup visible={chipsVisible}>
              <PillButton
                label="🔊 Asculta din nou"
                onPress={() =>
                  void voice.speak(
                    mode.result.summary,
                    absoluteAudioUrl(mode.result.summaryAudioUrl),
                  )
                }
              />
              {mode.result.status === 'VERIFIED' && (
                <PillButton
                  label="📖 Continua povestea"
                  variant="accent"
                  onPress={() =>
                    void enterExtend(mode.claim.story.id, mode.claim.story.id)
                  }
                />
              )}
              <PillButton
                label="Inapoi la inceput"
                onPress={() => {
                  if (meQuery.data) void enterWelcome(meQuery.data.name, false);
                }}
              />
            </ChipGroup>
          </>
        )}

        {mode.kind === 'final-extend' && (
          <>
            <Transcript
              phase={voice.phase}
              aiShown=""
              userPartial=""
              userFinalEcho=""
              placeholder=""
            >
              <FinalExtendCard result={mode.result} body={voice.aiShown} />
            </Transcript>
            <ChipGroup visible={chipsVisible}>
              <PillButton
                label="🔊 Asculta capitolul tau"
                onPress={() =>
                  void voice.speak(
                    mode.result.finalStory.body,
                    absoluteAudioUrl(mode.result.finalStory.bodyAudioUrl),
                  )
                }
              />
              <PillButton
                label="📚 Vezi tot lantul"
                onPress={() => {
                  voice.cleanup();
                  router.push(
                    `/(app)/story/chain/${mode.result.finalStory.chainRootId}`,
                  );
                }}
              />
              <PillButton
                label="Inapoi la inceput"
                variant="accent"
                onPress={() => {
                  if (meQuery.data) void enterWelcome(meQuery.data.name, false);
                }}
              />
            </ChipGroup>
          </>
        )}
      </View>
    </VoiceShell>
  );
}

// ───────────── render helpers ─────────────

function statusForMode(mode: Mode, phase: string): string {
  if (mode.kind === 'final-create') return 'Povestea ta · gata!';
  if (mode.kind === 'final-extend') return 'Capitolul tau · gata!';
  if (mode.kind === 'final-verify') {
    return mode.result.status === 'VERIFIED' ? 'Bravo, ai retinut!' : 'Verificare incheiata';
  }
  switch (phase) {
    case 'listening':
      return 'Te ascult...';
    case 'thinking':
      return 'Povestitorul se gandeste...';
    case 'speaking':
      return 'Povestitorul vorbeste';
    default:
      return mode.kind === 'welcome' ? 'Povestitorul' : 'Apasa pe microfon';
  }
}

function titleForMode(mode: Mode): string {
  switch (mode.kind) {
    case 'welcome':
      return 'Povesti';
    case 'pickAuthor':
      return 'Alege prietenul';
    case 'create':
    case 'final-create':
      return 'Creeaza poveste';
    case 'verify':
    case 'final-verify':
      return 'Verificare';
    case 'extend':
    case 'final-extend':
      return 'Continua povestea';
  }
}

function closeBehaviourForMode(mode: Mode): 'back-to-welcome' | 'leave-screen' {
  // In welcome inchidem ecranul cu totul; in alte moduri intoarcem la welcome.
  return mode.kind === 'welcome' ? 'leave-screen' : 'back-to-welcome';
}

function rightButtonForMode(
  mode: Mode,
  onMine: () => void,
  onReset: () => void,
) {
  if (mode.kind === 'welcome') {
    return { label: '📚', onPress: onMine, accessibilityLabel: 'Carnetelul meu' };
  }
  if (mode.kind === 'create' || mode.kind === 'extend') {
    return { label: '↺', onPress: onReset, accessibilityLabel: 'Reia conversatia' };
  }
  return undefined;
}

const styles = StyleSheet.create({
  actionsArea: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 8,
    justifyContent: 'flex-end',
  },
  authorList: { flex: 1, marginTop: 8 },
  authorListContent: { gap: 10, paddingBottom: 10 },
});
