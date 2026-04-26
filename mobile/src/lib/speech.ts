import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';

// Layer 1 — TTS pe device (expo-speech). Folosit pentru replicile pet-ului
// in chat-uri (intrebari, feedback). Latency 0, fara cost. Voce nativa OS.
export function speakDevice(text: string) {
  Speech.stop();
  Speech.speak(text, { language: 'ro-RO', pitch: 1.05, rate: 1.0 });
}

export function stopDevice() {
  Speech.stop();
}

// Layer 2 — playback MP3 server-side (Edge TTS prin backend). Folosit pentru
// povestea finala si summary-ul de verify, unde calitatea conteaza. Cache la
// backend → al doilea play e instant.
let activePlayer: AudioPlayer | null = null;

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
}

// STT — push-to-talk. Folosim recunoastere on-device cand e disponibila
// (Apple Speech / Google) si rezultate finale (nu interim) ca sa evitam UI
// flicker. Limba: ro-RO. Apelantul primeste callback cu transcriptul final.
export type SttHandle = {
  stop: () => void;
};

export async function ensureMicPermission(): Promise<boolean> {
  const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  return granted;
}

export async function startListening(opts: {
  onResult: (text: string) => void;
  onError?: (err: string) => void;
}): Promise<SttHandle> {
  // Cleanup orice sesiune anterioara
  try {
    ExpoSpeechRecognitionModule.stop();
  } catch {
    // nimic in progres
  }

  const resultSub = ExpoSpeechRecognitionModule.addListener(
    'result',
    (e: ExpoSpeechRecognitionResultEvent) => {
      if (!e.isFinal) return;
      const transcript = e.results[0]?.transcript?.trim();
      if (transcript) opts.onResult(transcript);
    },
  );

  const errorSub = ExpoSpeechRecognitionModule.addListener('error', (e) => {
    opts.onError?.(e.error ?? 'unknown');
  });

  const cleanup = () => {
    resultSub.remove();
    errorSub.remove();
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // ignore
    }
  };

  ExpoSpeechRecognitionModule.start({
    lang: 'ro-RO',
    interimResults: false,
    maxAlternatives: 1,
    continuous: false,
    requiresOnDeviceRecognition: false,
    addsPunctuation: false,
  });

  return { stop: cleanup };
}

