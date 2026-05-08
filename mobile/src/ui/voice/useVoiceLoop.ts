import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  ensureMicPermission,
  isSttAvailable,
  playPetVoiceAwait,
  startListening,
  stopDevice,
  stopRemoteAudio,
  type SttHandle,
} from '../../lib/speech';
import type { OrbPhase } from './Orb';

// Hook pentru bucla de conversatie voice-first: TTS → STT → TTS, cu typewriter
// si gestionarea fazei (idle/listening/thinking/speaking) pt orb. Componenta
// chemand decide ce face cu transcriptul user-ului prin `onResult` pasat in
// startListen — nu cuplam de un endpoint anume, asa ca acelasi hook serveste
// 3 moduri (creare/verificare/extindere).

export type VoiceLoopOptions = {
  // Callback pt cand user-ul vorbeste si STT scoate text final.
  onResult: (text: string) => void;
  onListenError?: (code: string, message?: string) => void;
};

export function useVoiceLoop() {
  const [phase, setPhase] = useState<OrbPhase>('idle');
  const [aiText, setAiText] = useState('');
  const [aiShown, setAiShown] = useState('');
  const [userPartial, setUserPartial] = useState('');
  const [userFinalEcho, setUserFinalEcho] = useState('');
  const sttRef = useRef<SttHandle | null>(null);
  const cancelledRef = useRef(false);

  // Typewriter — scriem aiText cuvant cu cuvant in aiShown
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

  const cleanup = useCallback(() => {
    cancelledRef.current = true;
    stopDevice();
    void stopRemoteAudio();
    sttRef.current?.stop();
    sttRef.current = null;
  }, []);

  // Cleanup la unmount
  useEffect(() => () => cleanup(), [cleanup]);

  const cancelSpeak = useCallback(() => {
    cancelledRef.current = true;
    stopDevice();
    void stopRemoteAudio();
    setAiShown(aiText);
    setPhase('idle');
  }, [aiText]);

  const stopListen = useCallback(() => {
    sttRef.current?.stop();
    sttRef.current = null;
    setPhase('idle');
    setUserPartial('');
  }, []);

  const startListen = useCallback(
    async (opts: VoiceLoopOptions): Promise<{ ok: boolean; reason?: string }> => {
      if (!isSttAvailable()) return { ok: false, reason: 'unavailable' };
      const granted = await ensureMicPermission();
      if (!granted) return { ok: false, reason: 'no_permission' };
      if (cancelledRef.current) return { ok: false, reason: 'cancelled' };
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
          opts.onResult(finalText);
        },
        onError: (code, message) => {
          sttRef.current = null;
          setPhase('idle');
          setUserPartial('');
          opts.onListenError?.(code, message);
        },
      });
      return { ok: true };
    },
    [],
  );

  // Vorbeste si lasa user-ul sa raspunda imediat dupa.
  const speakAndListen = useCallback(
    async (text: string, audioUrl: string | null, opts: VoiceLoopOptions) => {
      cancelledRef.current = false;
      setPhase('speaking');
      setAiText(text);
      setUserFinalEcho('');
      try {
        await playPetVoiceAwait(text, audioUrl);
      } catch {
        // ignoram — typewriter ramane
      }
      setAiShown(text);
      setPhase('idle');
      if (cancelledRef.current) return;
      // iOS: AVAudioSession revine din playback la default lent — handoff de
      // 600ms previne ratarea primului audio input.
      const handoffMs = Platform.OS === 'ios' ? 600 : 250;
      setTimeout(() => {
        if (!cancelledRef.current) void startListen(opts);
      }, handoffMs);
    },
    [startListen],
  );

  // Vorbeste fara sa porneasca STT dupa (folosit pt anunturi finale, replicile
  // de tranzitie intre moduri).
  const speak = useCallback(async (text: string, audioUrl: string | null) => {
    cancelledRef.current = false;
    setPhase('speaking');
    setAiText(text);
    try {
      await playPetVoiceAwait(text, audioUrl);
    } catch {}
    setAiShown(text);
    if (!cancelledRef.current) setPhase('idle');
  }, []);

  // Reset complet — pt cazuri cand mode-ul se schimba si vrem orb-ul gol
  const resetTranscript = useCallback(() => {
    setAiText('');
    setAiShown('');
    setUserPartial('');
    setUserFinalEcho('');
    setPhase('idle');
  }, []);

  // Setter manual pentru phase — folosit dupa POST cand vrem sa stam in
  // 'thinking' pana primim raspuns.
  const setThinking = useCallback(() => {
    setPhase('thinking');
  }, []);

  return {
    phase,
    aiText,
    aiShown,
    userPartial,
    userFinalEcho,
    speak,
    speakAndListen,
    startListen,
    stopListen,
    cancelSpeak,
    resetTranscript,
    setThinking,
    cleanup,
    isCancelled: () => cancelledRef.current,
    resetCancelled: () => {
      cancelledRef.current = false;
    },
  };
}
