// Engine pentru povesti predefinite. Consuma Chapter.scenes[] in secventa.
//
// Visitor dinamic: cand intalneste `encounter` cu visitorMode='random-friend',
// engine cere /journey/random-friend si substituie placeholders ({friend},
// {friendPet}). Cand visitorul vorbeste, vocea folosita e a SPECIEI vizitatorului.
//
// Vfx: cand scena curenta are `vfx`, emite un eveniment temporal pe `vfxEvent`
// pe care Scene-ul il ascult si declanseaza animatia corespunzatoare. Engine
// asteapta un mic delay (sub jocul textului) ca efectul + textul sa coexiste.

import { useCallback, useEffect, useRef, useState } from 'react';
import { playPetVoiceAwait, stopRemoteAudio, stopDevice } from '../lib/speech';
import {
  absoluteAudioUrl,
  claimCheckpoint,
  fetchJourneyQuestions,
  getRandomFriendPet,
  synthesizeJourneyTts,
  type CheckpointReward,
  type JourneyQuestionDto,
  type RandomFriendPet,
} from '../api/journey';
import type {
  Chapter,
  Scene,
  SceneChallenge,
  SceneEncounter,
  SceneFarewell,
  SceneVfx,
} from './stories/types';

export type EngineObstacle = {
  sceneId: string;
  shapeKey: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  successLine: string;
  failLine: string;
};

export type EngineVisitor = {
  sceneId: string;
  speciesSlug: string;
  petName: string;
  friendName: string;
  imageUrl: string | null;
};

export type EngineState = {
  caption: string | null;
  // Sub-text mic afisat sub caption — ex. cine vorbeste in dialog encounter.
  speakerLabel: string | null;
  obstacle: EngineObstacle | null;
  // Vizitator transient — apare doar in timpul dialogului de encounter.
  visitor: EngineVisitor | null;
  // Tovaras persistent — ramane langa pet prin scenele urmatoare dupa un
  // encounter cu staysAsCompanion, pana la o scena 'farewell' / final capitol.
  companion: EngineVisitor | null;
  petCanWalk: boolean;
  sceneIdx: number;
  totalScenes: number;
  chapterDone: boolean;
  // Token care creste la fiecare vfx — Scene asculta diferenta de valoare
  // si declanseaza animatia. (token, kind)
  vfxEvent: { id: number; vfx: SceneVfx } | null;
  // Reward-ul ultimului checkpoint atins (bond xp + fundal deblocat). Afisat
  // in cardul de checkpoint / final.
  lastReward: CheckpointReward | null;
};

type EngineApi = {
  state: EngineState;
  answerChallenge: (chosenIndex: number) => void;
  skipCurrent: () => void;
};

export function useStoryEngine(chapter: Chapter | null): EngineApi {
  const [state, setState] = useState<EngineState>(() => initialState(chapter));

  const tokenRef = useRef(0);
  const vfxIdRef = useRef(0);
  const pendingAnswerRef = useRef<((idx: number) => void) | null>(null);

  useEffect(() => {
    tokenRef.current++;
    pendingAnswerRef.current = null;
    void stopRemoteAudio();
    stopDevice();
    setState(initialState(chapter));
    if (!chapter) return;

    const myToken = tokenRef.current;
    void runChapter(chapter, myToken);

    return () => {
      tokenRef.current++;
      pendingAnswerRef.current = null;
      void stopRemoteAudio();
      stopDevice();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter?.id]);

  useEffect(() => {
    return () => {
      tokenRef.current++;
      pendingAnswerRef.current = null;
      void stopRemoteAudio();
      stopDevice();
    };
  }, []);

  const isMine = (myToken: number) => tokenRef.current === myToken;

  function triggerVfx(vfx: SceneVfx | undefined) {
    if (!vfx) return;
    vfxIdRef.current++;
    const id = vfxIdRef.current;
    setState((s) => ({ ...s, vfxEvent: { id, vfx } }));
  }

  async function playLine(
    text: string,
    voice: 'narrator' | 'pet',
    myToken: number,
    visitorSpeciesSlug?: string,
    speakerLabel?: string | null,
  ): Promise<void> {
    if (!isMine(myToken)) return;
    setState((s) => ({ ...s, caption: text, speakerLabel: speakerLabel ?? null }));
    let audioUrl: string | null = null;
    try {
      const res = await synthesizeJourneyTts(text, voice, visitorSpeciesSlug);
      audioUrl = absoluteAudioUrl(res.audioUrl);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[engine] tts fetch failed:', String(err));
    }
    if (!isMine(myToken)) return;
    await playPetVoiceAwait(text, audioUrl);
  }

  function substitute(text: string, visitor: RandomFriendPet | null): string {
    if (!visitor) return text;
    return text
      .replace(/\{friend\}/g, visitor.friendName)
      .replace(/\{friendPet\}/g, visitor.petName);
  }

  async function runChapter(ch: Chapter, myToken: number) {
    // Pre-fetch intrebarile pentru toate scenele challenge. Grupam per domain,
    // cerem batch-uri si pastram un cursor per domain pentru distribuire in
    // ordinea scenelor. Daca fetch-ul pica, scenele pica pe fallback in
    // runChallenge (raman fara intrebare → skip silent).
    const challengeDomains: string[] = ch.scenes
      .filter((s): s is SceneChallenge => s.kind === 'challenge')
      .map((s) => s.domain);
    const domainNeeds = new Map<string, number>();
    challengeDomains.forEach((d) => domainNeeds.set(d, (domainNeeds.get(d) ?? 0) + 1));
    const domainQueues = new Map<string, JourneyQuestionDto[]>();
    for (const [domain, needed] of domainNeeds.entries()) {
      try {
        const res = await fetchJourneyQuestions(domain, needed);
        if (isMine(myToken)) domainQueues.set(domain, res.questions);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[engine] fetch questions failed for', domain, String(err));
        domainQueues.set(domain, []);
      }
    }

    for (let i = 0; i < ch.scenes.length; i++) {
      if (!isMine(myToken)) return;
      const scene = ch.scenes[i];
      setState((s) => ({
        ...s,
        sceneIdx: i,
        caption: null,
        speakerLabel: null,
        obstacle: null,
        visitor: null,
        petCanWalk: true,
      }));

      triggerVfx((scene as { vfx?: SceneVfx }).vfx);

      switch (scene.kind) {
        case 'narrate': {
          await playLine(scene.text, scene.voice ?? 'narrator', myToken);
          await sleep(400);
          break;
        }
        case 'pet_says': {
          setState((s) => ({ ...s, petCanWalk: false }));
          await playLine(scene.text, 'pet', myToken);
          await sleep(300);
          if (!isMine(myToken)) return;
          setState((s) => ({ ...s, petCanWalk: true }));
          break;
        }
        case 'challenge': {
          const queue = domainQueues.get(scene.domain);
          const question = queue && queue.length > 0 ? queue.shift()! : null;
          if (!question) {
            // Fara intrebare — saltam scena (nu blocam povestea).
            // eslint-disable-next-line no-console
            console.warn('[engine] no question for domain', scene.domain, '— skipping');
            await sleep(300);
            break;
          }
          await runChallenge(scene, question, myToken);
          break;
        }
        case 'encounter': {
          await runEncounter(scene, myToken);
          break;
        }
        case 'farewell': {
          await runFarewell(scene, myToken);
          break;
        }
        case 'checkpoint': {
          setState((s) => ({ ...s, petCanWalk: false }));
          await playLine(scene.text, 'narrator', myToken);
          // Claim reward (bond xp + unlock fundal). Idempotent server-side.
          if (scene.reward) {
            try {
              const reward = await claimCheckpoint({
                sceneId: scene.id,
                chapterId: ch.id,
                bondXp: scene.reward.bondXp,
                backgroundKey: scene.reward.backgroundKey,
              });
              if (isMine(myToken)) {
                setState((s) => ({ ...s, lastReward: reward }));
              }
            } catch (err) {
              // eslint-disable-next-line no-console
              console.warn('[engine] checkpoint claim failed:', String(err));
            }
          }
          await sleep(600);
          break;
        }
      }
    }
    if (!isMine(myToken)) return;
    setState((s) => ({
      ...s,
      chapterDone: true,
      petCanWalk: false,
      caption: null,
      speakerLabel: null,
      obstacle: null,
      visitor: null,
      companion: null,
    }));
  }

  async function runChallenge(
    scene: SceneChallenge,
    question: JourneyQuestionDto,
    myToken: number,
  ) {
    setState((s) => ({ ...s, petCanWalk: true }));
    await playLine(scene.intro, 'narrator', myToken);
    if (!isMine(myToken)) return;
    setState((s) => ({
      ...s,
      petCanWalk: false,
      obstacle: {
        sceneId: scene.id,
        shapeKey: scene.shapeKey,
        prompt: question.prompt,
        options: question.options,
        correctIndex: question.correctIndex,
        successLine: question.successLine,
        failLine: question.failLine,
      },
    }));
    await playLine(question.prompt, 'pet', myToken);
    if (!isMine(myToken)) return;
    const chosen = await new Promise<number>((resolve) => {
      pendingAnswerRef.current = resolve;
    });
    pendingAnswerRef.current = null;
    if (!isMine(myToken)) return;
    const correct = chosen === question.correctIndex;
    await playLine(correct ? question.successLine : question.failLine, 'pet', myToken);
    if (!isMine(myToken)) return;
    // La GRESIT: naratorul spune intai care era raspunsul corect, apoi explicatia.
    // La CORECT: direct explicatia, ca o curiozitate.
    if (!correct) {
      const correctOption = question.options[question.correctIndex] ?? '';
      const correction = `Raspunsul corect era: ${correctOption}.`;
      await sleep(250);
      if (!isMine(myToken)) return;
      await playLine(correction, 'narrator', myToken);
    }
    if (question.explanation) {
      await sleep(250);
      if (!isMine(myToken)) return;
      await playLine(question.explanation, 'narrator', myToken);
    }
    if (!isMine(myToken)) return;
    setState((s) => ({ ...s, obstacle: null, petCanWalk: true }));
    await sleep(500);
  }

  async function runEncounter(scene: SceneEncounter, myToken: number) {
    setState((s) => ({ ...s, petCanWalk: true }));

    // Daca visitorMode='random-friend' → cere unul. Daca pica → skip scena
    // (continuam fara incident).
    let friend: RandomFriendPet | null = null;
    if (scene.visitorMode === 'random-friend') {
      try {
        friend = await getRandomFriendPet();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[engine] no random friend available, skipping encounter');
        // skip — pet continua sa mearga.
        await sleep(400);
        return;
      }
    } else {
      // Visitor fixat — folosim slug-ul direct, fara substituire.
      friend = {
        friendName: '',
        petName: scene.visitorMode,
        speciesSlug: scene.visitorMode,
        speciesName: scene.visitorMode,
        petImageUrl: null,
      };
    }
    if (!isMine(myToken)) return;

    // Intro narator (substituiri).
    await playLine(substitute(scene.intro, friend), 'narrator', myToken);
    if (!isMine(myToken)) return;

    // Spawn vizitator.
    setState((s) => ({
      ...s,
      petCanWalk: false,
      visitor: {
        sceneId: scene.id,
        speciesSlug: friend!.speciesSlug,
        petName: friend!.petName,
        friendName: friend!.friendName,
        imageUrl: friend!.petImageUrl,
      },
    }));
    await sleep(300);

    // Dialog secvential.
    for (const line of scene.dialog) {
      if (!isMine(myToken)) return;
      const text = substitute(line.text, friend);
      if (line.speaker === 'visitor') {
        // Vocea vizitatorului = vocea SPECIEI lui.
        await playLine(text, 'pet', myToken, friend.speciesSlug, friend.petName);
      } else if (line.speaker === 'pet') {
        await playLine(text, 'pet', myToken);
      } else {
        await playLine(text, 'narrator', myToken);
      }
    }
    if (!isMine(myToken)) return;
    await playLine(substitute(scene.outro, friend), 'narrator', myToken);
    if (!isMine(myToken)) return;

    if (scene.staysAsCompanion) {
      // Vizitatorul devine tovaras: il mutam din `visitor` (pozitia de
      // intalnire) in `companion` (langa pet, persistent prin scenele urmatoare).
      const companion: EngineVisitor = {
        sceneId: scene.id,
        speciesSlug: friend.speciesSlug,
        petName: friend.petName,
        friendName: friend.friendName,
        imageUrl: friend.petImageUrl,
      };
      setState((s) => ({ ...s, visitor: null, companion, petCanWalk: true }));
    } else {
      setState((s) => ({ ...s, visitor: null, petCanWalk: true }));
    }
    await sleep(500);
  }

  async function runFarewell(scene: SceneFarewell, myToken: number) {
    // Tovarasul isi ia ramas bun. Naratorul citeste, apoi companion-ul pleaca.
    setState((s) => ({ ...s, petCanWalk: false }));
    await playLine(scene.text, 'narrator', myToken);
    if (!isMine(myToken)) return;
    setState((s) => ({ ...s, companion: null, petCanWalk: true }));
    await sleep(700);
  }

  const answerChallenge = useCallback((idx: number) => {
    const resolver = pendingAnswerRef.current;
    if (resolver) resolver(idx);
  }, []);

  const skipCurrent = useCallback(() => {
    void stopRemoteAudio();
    stopDevice();
  }, []);

  return { state, answerChallenge, skipCurrent };
}

function initialState(chapter: Chapter | null): EngineState {
  return {
    caption: null,
    speakerLabel: null,
    obstacle: null,
    visitor: null,
    petCanWalk: true,
    companion: null,
    sceneIdx: 0,
    totalScenes: chapter?.scenes.length ?? 0,
    chapterDone: false,
    vfxEvent: null,
    lastReward: null,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function findActiveChapter(chapters: Chapter[]): Chapter | null {
  if (chapters.length === 0) return null;
  return chapters[0];
}
