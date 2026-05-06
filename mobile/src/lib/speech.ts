import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';

// Layer 1 — TTS pe device (expo-speech). Fallback cand audio remote pica.
// In conditii normale NU il chemam direct — folosim playPetVoice care prefera
// audio-ul de la backend (ElevenLabs).
export function speakDevice(text: string) {
  Speech.stop();
  Speech.speak(text, { language: 'ro-RO', pitch: 1.05, rate: 1.0 });
}

export function stopDevice() {
  Speech.stop();
}

// Helper unificat — folosit peste tot pe ecranele de poveste. Daca avem URL
// remote (de la backend, deja generat de ElevenLabs sau Edge cu cache), il
// redam. Daca pica fetch-ul sau nu avem URL, cadem pe expo-speech.
export async function playPetVoice(text: string, audioUrl: string | null) {
  stopDevice();
  await stopRemoteAudio();
  if (audioUrl) {
    try {
      await playRemoteAudio(audioUrl);
      return;
    } catch {
      // fall through la device speak
    }
  }
  speakDevice(text);
}

// Layer 2 — playback MP3 server-side (Edge TTS prin backend). Folosit pentru
// povestea finala si summary-ul de verify, unde calitatea conteaza. Cache la
// backend → al doilea play e instant.
let activePlayer: AudioPlayer | null = null;
// Resolver-ul promise-ului din `playPetVoiceAwait` curent. La stopRemoteAudio
// il chemam ca apelantul sa nu ramana blocat in await dupa cancel.
let activeAwaitResolver: (() => void) | null = null;

export async function playRemoteAudio(url: string) {
  await stopRemoteAudio();
  const player = createAudioPlayer({ uri: url });
  activePlayer = player;
  player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) {
      try {
        player.remove();
      } catch {
        // ignore
      }
      if (activePlayer === player) activePlayer = null;
    }
  });
  player.play();
}

export async function stopRemoteAudio() {
  if (activePlayer) {
    try {
      activePlayer.pause();
      activePlayer.remove();
    } catch {
      // ignore
    }
    activePlayer = null;
  }
  if (activeAwaitResolver) {
    const r = activeAwaitResolver;
    activeAwaitResolver = null;
    r();
  }
}

// Variant await-able a lui playPetVoice — promise se rezolva DUPA finish-ul
// playback-ului (sau imediat la fallback pe device speak). Folosit la
// audiobook-ul lantului ca sa redam capitolele secvential. stop*Remote/Device
// rezolva si ele promise-ul (cancel = rezolvare normala, nu eroare).
export async function playPetVoiceAwait(
  text: string,
  audioUrl: string | null,
): Promise<void> {
  stopDevice();
  await stopRemoteAudio();
  if (!audioUrl) {
    speakDevice(text);
    // expo-speech nu expune un await pe finish; aproximam prin lungimea textului
    // (~14 chars/sec la viteza standard romana). Folosit doar in fallback.
    const ms = Math.min(60_000, Math.max(2_000, Math.round((text.length / 14) * 1000)));
    await new Promise((r) => setTimeout(r, ms));
    return;
  }
  await new Promise<void>((resolve) => {
    const player = createAudioPlayer({ uri: audioUrl });
    activePlayer = player;
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      try {
        player.remove();
      } catch {
        // ignore
      }
      if (activePlayer === player) activePlayer = null;
      if (activeAwaitResolver === finish) activeAwaitResolver = null;
      resolve();
    };
    activeAwaitResolver = finish;
    player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) finish();
    });
    try {
      player.play();
    } catch {
      finish();
    }
  });
}

// STT — push-to-talk. Folosim recunoastere on-device cand e disponibila
// (Apple Speech / Google) si rezultate finale (nu interim) ca sa evitam UI
// flicker. Limba: ro-RO. Apelantul primeste callback cu transcriptul final.
export type SttHandle = {
  stop: () => void;
};

export function isSttAvailable(): boolean {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export async function ensureMicPermission(): Promise<boolean> {
  const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  return granted;
}

export async function startListening(opts: {
  onResult: (text: string) => void;
  onInterim?: (text: string) => void;
  onError?: (err: string, message?: string) => void;
  lang?: string;
  // Daca > 0, dupa ce primim primul interim, reseteaza un timer la fiecare
  // event nou; cand expira fara activitate, oprim engine-ul (silence detection
  // pe iOS, complementar fata de auto-stop nativ care e prea relaxat).
  silenceTimeoutMs?: number;
}): Promise<SttHandle> {
  const lang = opts.lang ?? 'ro-RO';
  const silenceMs = opts.silenceTimeoutMs ?? 0;

  // Cleanup orice sesiune anterioara
  try {
    ExpoSpeechRecognitionModule.stop();
  } catch {
    // nimic in progres
  }

  // Sesiunea poate emite evenimente intarziate dupa ce am decis ca s-a incheiat
  // (ex: result final + end care vine dupa, sau result-uri buffered). Folosim
  // `closed` ca poarta — odata true, nimic nu mai pleaca catre consumer.
  let closed = false;
  let lastTranscript = '';
  // Pe iOS, `end` poate fi emis INAINTEA `result(isFinal=true)` cand cerem
  // stop() programatic (silence trigger). Daca facem removeAll() pe `end`
  // imediat, pierdem result-ul final. Folosim flag-ul ca sa nu emitem dublu.
  let resultEmitted = false;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  const clearSilenceTimer = () => {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  };
  const flushOnSilence = () => {
    if (closed || resultEmitted) return;
    // Folosim DIRECT ultimul interim ca rezultat final, fara sa asteptam
    // event-urile post-stop() (care pe iOS/Android sosesc in ordini diferite
    // si uneori se pierd). Apoi rugam engine-ul sa se opreasca.
    if (lastTranscript) {
      resultEmitted = true;
      opts.onResult(lastTranscript);
      removeAll();
    }
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // ignore
    }
  };
  const armSilenceTimer = () => {
    if (silenceMs <= 0) return;
    clearSilenceTimer();
    silenceTimer = setTimeout(flushOnSilence, silenceMs);
  };
  const removeAll = () => {
    clearSilenceTimer();
    if (closed) return;
    closed = true;
    subs.forEach((s) => s.remove());
  };

  const subs = [
    ExpoSpeechRecognitionModule.addListener('end', () => {
      if (closed || resultEmitted) return;
      // Lasam 350ms ca un eventual `result(isFinal=true)` sa apuce sa fie
      // procesat (pe iOS poate veni dupa `end` la stop programatic). Daca nu
      // vine nimic, folosim ultimul interim ca fallback.
      setTimeout(() => {
        if (closed || resultEmitted) return;
        if (lastTranscript) {
          resultEmitted = true;
          opts.onResult(lastTranscript);
        } else {
          opts.onError?.('nomatch', 'Buddy n-a inteles ce ai zis. Mai incearca.');
        }
        removeAll();
      }, 350);
    }),
    ExpoSpeechRecognitionModule.addListener('nomatch', () => {
      if (closed || resultEmitted) return;
      opts.onError?.('nomatch', 'Buddy n-a inteles ce ai zis. Mai incearca.');
      removeAll();
    }),
    ExpoSpeechRecognitionModule.addListener(
      'result',
      (e: ExpoSpeechRecognitionResultEvent) => {
        if (closed || resultEmitted) return;
        const transcript = e.results[0]?.transcript?.trim();
        if (!transcript) return;
        lastTranscript = transcript;
        if (e.isFinal) {
          resultEmitted = true;
          opts.onResult(transcript);
          lastTranscript = '';
          // Inchidem imediat dupa final ca event-uri buffered (interim
          // intarziate, end ulterior) sa nu rescrie draft-ul cu valori stale.
          removeAll();
        } else {
          opts.onInterim?.(transcript);
          armSilenceTimer();
        }
      },
    ),
    ExpoSpeechRecognitionModule.addListener('error', (e) => {
      if (closed || resultEmitted) return;
      // Pe Android, dupa silence detection sau alte triggere, engine-ul poate
      // emite `error: no_match` / `no_speech` chiar daca am cules transcript
      // valid din interim. Promovam lastTranscript la rezultat in loc sa
      // pierdem mesajul user-ului.
      if (lastTranscript) {
        resultEmitted = true;
        opts.onResult(lastTranscript);
        removeAll();
        return;
      }
      opts.onError?.(e.error ?? 'unknown', e.message);
      removeAll();
    }),
  ];

  // User-initiated stop: cere engine-ului sa termine si sa returneze final.
  // Inchidem poarta IMEDIAT (fara removeAll) pana arrives final result, ca
  // events stale sa nu mai fie procesate. Hard removal dupa 2s fallback.
  const cleanup = () => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // ignore
    }
    setTimeout(removeAll, 2000);
  };

  try {
    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: true,
      maxAlternatives: 1,
      continuous: false,
      requiresOnDeviceRecognition: false,
      addsPunctuation: false,
      // Android: scurteaza ferestrele de tacere ca recognizer-ul sa termine
      // automat dupa ~1.5s de liniste, similar cu comportamentul nostru iOS-side.
      ...(silenceMs > 0
        ? {
            androidIntentOptions: {
              EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: silenceMs,
              EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: silenceMs,
              EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 600,
            },
          }
        : {}),
    });
    // Daca n-ai zis nimic in N secunde (de ~3x silenceMs), oprim sesiunea ca
    // engine-ul sa nu astepte la nesfarsit pe iOS.
    if (silenceMs > 0) {
      silenceTimer = setTimeout(() => {
        if (closed || resultEmitted) return;
        if (lastTranscript) {
          resultEmitted = true;
          opts.onResult(lastTranscript);
          removeAll();
        } else {
          opts.onError?.('nomatch', 'N-am auzit nimic. Mai incearca.');
          removeAll();
        }
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch {
          // ignore
        }
      }, Math.max(silenceMs * 3, 4000));
    }
  } catch (err) {
    removeAll();
    opts.onError?.('start_failed', String(err));
  }

  return { stop: cleanup };
}

