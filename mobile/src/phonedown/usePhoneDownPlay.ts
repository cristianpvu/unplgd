import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getSession,
  pauseSession,
  resumeSession,
  surrenderSession,
  type PhoneDownSessionDto,
} from '../api/phonedown';
import { ApiError } from '../api/client';
import { callDetector } from 'call-detector';
import { usePhoneDownSocket } from './usePhoneDownSocket';

// Stari logice ale gameplay-ului (perspectiva mea — participantul curent).
//  - waiting:    in lobby, n-am pornit
//  - playing:    ecranul de blocare e activ, ceasul curge
//  - paused:     suna telefonul → server pe pauza; ceasul stagneaza
//  - surrendered: am scos din concurs (am parasit app-ul sau am apasat renunt)
//  - winner:     am castigat (ramas ultimul sau am atins cap-ul)
//  - ended:      sesiunea s-a terminat, sunt afara
export type PhoneDownPhase =
  | 'waiting'
  | 'playing'
  | 'paused'
  | 'surrendered'
  | 'winner'
  | 'ended';

type Options = {
  sessionId: string | undefined;
  // True doar in interiorul ecranului de play (nu vrem ca detectarea apelului
  // sa ruleze cand user-ul e in alta parte din app).
  active: boolean;
  // User-ul curent — folosit pentru a identifica participantul "eu" in sesiune.
  myUserId: string | undefined;
  // True cand suntem pe lockscreen — reducem polling-ul pentru baterie.
  // (1.5s in lobby/play normal vs 5s pe lockscreen).
  lowPower?: boolean;
};

export type PhoneDownPlayState = {
  phase: PhoneDownPhase;
  session: PhoneDownSessionDto | null;
  sessionError: unknown;
  myDurationMs: number;
  isInCall: boolean;
  myRank: number | null;
  // Action: am cedat intentionat (din UI), nu accidental.
  surrender: () => Promise<void>;
};

export function usePhoneDownPlay(opts: Options): PhoneDownPlayState {
  const qc = useQueryClient();
  const { sessionId, active, myUserId, lowPower } = opts;

  // Polling REST in timpul jocului ca sa avem clasamentul live. Socket-ul
  // ne aduce schimbarile de stare; polling-ul sterge duration drift fara overhead.
  // Pe lockscreen reducem la 5s — schimbarile mari vin oricum prin socket.
  const sessionQuery = useQuery({
    queryKey: ['phonedown', 'session', sessionId],
    queryFn: () => {
      if (!sessionId) throw new Error('no session');
      return getSession(sessionId);
    },
    enabled: !!sessionId,
    refetchInterval: active ? (lowPower ? 5000 : 1500) : false,
    retry: (failureCount, err) => {
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
        return false;
      }
      return failureCount < 2;
    },
  });

  useEffect(() => {
    const err = sessionQuery.error;
    if (!err) return;
    if (err instanceof ApiError) {
      console.warn(
        'phonedown getSession failed:',
        err.status,
        err.code,
        err.message,
        'sessionId=',
        sessionId,
      );
      if (err.status === 404 || err.status === 403) {
        qc.invalidateQueries({ queryKey: ['phonedown', 'current'] });
      }
    } else {
      console.warn('phonedown getSession failed (non-ApiError):', err);
    }
  }, [sessionQuery.error, qc, sessionId]);

  usePhoneDownSocket(sessionId);

  const session = sessionQuery.data ?? null;
  const me = session?.participants.find((p) => p.userId === myUserId) ?? null;
  const myRank = me?.rank ?? null;

  const playActive =
    active &&
    !!session &&
    session.status === 'PLAYING' &&
    me?.status !== 'SURRENDERED' &&
    me?.status !== 'WINNER';

  // Call detection — pornit cat timp suntem in faza activa. Pe ringing/active
  // → trimitem pause; pe idle dupa pause → resume.
  const [isInCall, setIsInCall] = useState(false);
  useEffect(() => {
    if (!playActive) {
      void callDetector.stop();
      setIsInCall(false);
      return;
    }
    let cancelled = false;
    let sub: ReturnType<typeof callDetector.addListener> = null;
    (async () => {
      const started = await callDetector.start();
      if (cancelled || !started) return;
      const initial = await callDetector.getCurrentState();
      if (!cancelled) setIsInCall(initial);
      sub = callDetector.addListener((inCall) => {
        if (!cancelled) setIsInCall(inCall);
      });
    })();
    return () => {
      cancelled = true;
      sub?.remove();
      void callDetector.stop();
    };
  }, [playActive]);

  // Mutatii pause/resume/surrender. Idempotente server-side.
  const pauseMut = useMutation({
    mutationFn: () => pauseSession(sessionId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['phonedown', 'session', sessionId] }),
  });
  const resumeMut = useMutation({
    mutationFn: () => resumeSession(sessionId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['phonedown', 'session', sessionId] }),
  });
  const surrenderMut = useMutation({
    mutationFn: () => surrenderSession(sessionId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['phonedown', 'session', sessionId] }),
  });

  // Anti-spam pe pause/resume.
  const lastCallSentRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!sessionId || !playActive) return;
    if (lastCallSentRef.current === isInCall) return;
    lastCallSentRef.current = isInCall;
    if (isInCall) {
      pauseMut.mutate();
    } else {
      resumeMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInCall, sessionId, playActive]);

  // AppState: daca aplicatia merge in background din alt motiv decat un apel
  // (ex. user-ul a deblocat ecranul si a iesit din app), e surrender.
  useEffect(() => {
    if (!playActive) return;
    if (!sessionId) return;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' && !isInCall && me?.status === 'ACTIVE') {
        surrenderMut.mutate();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playActive, sessionId, isInCall, me?.status]);

  // Calculam faza din state-ul server.
  const phase: PhoneDownPhase = (() => {
    if (!session) return 'waiting';
    if (session.status === 'WAITING') return 'waiting';
    if (session.status === 'ENDED' || session.status === 'CANCELLED') {
      if (me?.status === 'WINNER') return 'winner';
      return 'ended';
    }
    // PLAYING
    if (!me) return 'ended';
    if (me.status === 'WINNER') return 'winner';
    if (me.status === 'SURRENDERED') return 'surrendered';
    if (me.status === 'PAUSED' || isInCall) return 'paused';
    return 'playing';
  })();

  const myDurationMs = me?.durationMs ?? 0;

  return {
    phase,
    session,
    sessionError: sessionQuery.error,
    myDurationMs,
    isInCall,
    myRank,
    surrender: async () => {
      await surrenderMut.mutateAsync();
    },
  };
}
