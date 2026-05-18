import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getSession,
  surrenderSession,
  type PhoneDownSessionDto,
} from '../api/phonedown';
import { ApiError } from '../api/client';
import { callDetector } from 'call-detector';
import { usePhoneDownSocket } from './usePhoneDownSocket';

// Stari logice ale gameplay-ului (perspectiva mea — participantul curent).
//  - waiting:     in lobby, n-am pornit
//  - playing:     ecranul de blocare e activ, ceasul curge
//  - surrendered: am parasit aplicatia in afara unui apel sau am apasat renunt
//  - winner:      am castigat (ramas ultimul sau am atins cap-ul)
//  - ended:       sesiunea s-a terminat, sunt afara
//
// NOTA: apelurile NU mai pun pe pauza (toate counteaza in timpul total).
// Regula curenta de surrender: AppState=background AND NU sunt in apel.
export type PhoneDownPhase =
  | 'waiting'
  | 'playing'
  | 'surrendered'
  | 'winner'
  | 'ended';

type Options = {
  sessionId: string | undefined;
  active: boolean;
  myUserId: string | undefined;
  lowPower?: boolean;
};

export type PhoneDownPlayState = {
  phase: PhoneDownPhase;
  session: PhoneDownSessionDto | null;
  sessionError: unknown;
  myDurationMs: number;
  isInCall: boolean;
  myRank: number | null;
  surrender: () => Promise<void>;
};

// Calcul live al duratei unui participant fara request la server.
export function computeLiveDuration(
  participant: { status: string; durationMs: number },
  serverNowMs: number,
  nowMs: number,
): number {
  if (participant.status === 'ACTIVE') {
    return Math.max(0, participant.durationMs + (nowMs - serverNowMs));
  }
  return participant.durationMs;
}

export function usePhoneDownPlay(opts: Options): PhoneDownPlayState {
  const qc = useQueryClient();
  const { sessionId, active, myUserId, lowPower } = opts;

  const sessionQuery = useQuery({
    queryKey: ['phonedown', 'session', sessionId],
    queryFn: () => {
      if (!sessionId) throw new Error('no session');
      return getSession(sessionId);
    },
    enabled: !!sessionId,
    refetchInterval: active ? (lowPower ? 60_000 : 1500) : false,
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

  // Detectie apel — pornit cat timp suntem in faza activa. Folosit DOAR ca
  // sa stim daca "AppState=background" e cauzat de un apel (legit) sau de
  // user (= surrender). Apelurile NU mai pun pe pauza.
  const [isInCall, setIsInCall] = useState(false);
  useEffect(() => {
    if (!playActive) {
      void callDetector.stop();
      setIsInCall(false);
      return;
    }
    let cancelled = false;
    let sub: ReturnType<typeof callDetector.addListener> = null;
    let pollId: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const started = await callDetector.start();
      if (cancelled || !started) return;
      const initial = await callDetector.getCurrentState();
      if (!cancelled) setIsInCall(initial);
      sub = callDetector.addListener((inCall) => {
        if (!cancelled) setIsInCall(inCall);
      });
      pollId = setInterval(async () => {
        const cur = await callDetector.getCurrentState();
        if (!cancelled) {
          setIsInCall((prev) => (prev === cur ? prev : cur));
        }
      }, 3000);
    })();
    return () => {
      cancelled = true;
      sub?.remove();
      if (pollId) clearInterval(pollId);
      void callDetector.stop();
    };
  }, [playActive]);

  const surrenderMut = useMutation({
    mutationFn: () => surrenderSession(sessionId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['phonedown', 'session', sessionId] }),
  });

  // Track AppState ca state React, ca sa pot reactiona si la schimbarile
  // de isInCall, nu doar la AppState change events.
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState);
    return () => sub.remove();
  }, []);

  // Regula unica: daca app-ul e in background si NU sunt in apel, surrender.
  // Acopera ambele cazuri:
  //  (1) user a iesit din app fara apel — surrender imediat
  //  (2) user a fost in apel (background OK), apelul s-a terminat, app inca
  //      in background — surrender la momentul cand isInCall trece la false
  useEffect(() => {
    if (!playActive || !sessionId || !me) return;
    if (me.status !== 'ACTIVE') return;
    if (appState === 'background' && !isInCall) {
      surrenderMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState, isInCall, playActive, sessionId, me?.status]);

  const phase: PhoneDownPhase = (() => {
    if (!session) return 'waiting';
    if (session.status === 'WAITING') return 'waiting';
    if (session.status === 'ENDED' || session.status === 'CANCELLED') {
      if (me?.status === 'WINNER') return 'winner';
      return 'ended';
    }
    if (!me) return 'ended';
    if (me.status === 'WINNER') return 'winner';
    if (me.status === 'SURRENDERED') return 'surrendered';
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
