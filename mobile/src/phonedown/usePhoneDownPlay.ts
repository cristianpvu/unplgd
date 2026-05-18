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
import { useFaceDown } from './useFaceDown';
import { usePhoneDownSocket } from './usePhoneDownSocket';

// Stari logice ale gameplay-ului (perspectiva mea — participantul curent).
//  - waiting:    in lobby, n-am pornit
//  - countdown:  server-ul a setat startedAt, dar inca nu e momentul phoneDownAt
//  - waitingDown: trebuie sa-mi pun telefonul jos (face-down)
//  - playing:    telefonul e jos, ceasul curge
//  - paused:     suna telefonul → server pe pauza; ceasul stagneaza
//  - surrendered: am ridicat telefonul → server-ul m-a inregistrat
//  - winner:     am castigat (ramas ultimul sau am atins cap-ul)
//  - ended:      sesiunea s-a terminat, sunt afara
export type PhoneDownPhase =
  | 'waiting'
  | 'countdown'
  | 'waitingDown'
  | 'playing'
  | 'paused'
  | 'surrendered'
  | 'winner'
  | 'ended';

type Options = {
  sessionId: string | undefined;
  // True doar in interiorul ecranului de play (nu vrem ca sensorii sa
  // ruleze cand user-ul e in alta parte din app).
  active: boolean;
  // User-ul curent — folosit pentru a identifica participantul "eu" in sesiune.
  myUserId: string | undefined;
};

export type PhoneDownPlayState = {
  phase: PhoneDownPhase;
  session: PhoneDownSessionDto | null;
  sessionError: unknown;
  // Calcul live al duratei mele (ms). Pe paused/surrendered = inghetat.
  myDurationMs: number;
  isInCall: boolean;
  isFaceDown: boolean;
  // True dupa server-side decizie (rank set). Util pentru result screen.
  myRank: number | null;
  // Action: am ridicat telefonul intentionat (din UI), nu accidental.
  surrender: () => Promise<void>;
};

export function usePhoneDownPlay(opts: Options): PhoneDownPlayState {
  const qc = useQueryClient();
  const { sessionId, active, myUserId } = opts;

  // Polling REST 1s in timpul jocului ca sa avem clasamentul live (durations
  // ale celorlalti). Socket-ul ne aduce schimbarile de stare; polling-ul
  // sterge duration drift fara overhead.
  const sessionQuery = useQuery({
    queryKey: ['phonedown', 'session', sessionId],
    queryFn: () => {
      if (!sessionId) throw new Error('no session');
      return getSession(sessionId);
    },
    enabled: !!sessionId,
    refetchInterval: active ? 1500 : false,
    // Sesiune disparuta / kicked → opreste retry-ul ca sa nu spammezi.
    retry: (failureCount, err) => {
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
        return false;
      }
      return failureCount < 2;
    },
  });

  // Daca server-ul ne refuza, logam si invalidam cache-ul de "current".
  // Consumer-ul afiseaza ecranul de eroare (nu mai facem redirect tacut).
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

  // Detectia face-down ruleaza doar in faza activa de joc (countdown +
  // gameplay). Inainte/dupa e off — economisim baterie.
  const sensorEnabled =
    active &&
    !!session &&
    session.status === 'PLAYING' &&
    me?.status !== 'SURRENDERED' &&
    me?.status !== 'WINNER';
  const isFaceDown = useFaceDown(sensorEnabled);

  // Call detection — pornit cat timp suntem in faza activa. Pe ringing/active
  // → trimitem pause; pe idle dupa pause → resume.
  const [isInCall, setIsInCall] = useState(false);
  useEffect(() => {
    if (!sensorEnabled) {
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
  }, [sensorEnabled]);

  // Mutatii pause/resume/surrender. Idempotente server-side, deci re-apel
  // pe acelasi event nu strica nimic.
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

  // Anti-spam pe pause/resume: tinem ultimul state trimis ca sa nu trimitem
  // de doua ori acelasi event.
  const lastCallSentRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!sessionId || !sensorEnabled) return;
    if (lastCallSentRef.current === isInCall) return;
    lastCallSentRef.current = isInCall;
    if (isInCall) {
      pauseMut.mutate();
    } else {
      resumeMut.mutate();
    }
    // pauseMut/resumeMut sunt referente stabile via useMutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInCall, sessionId, sensorEnabled]);

  // Suntem in countdown daca phoneDownAt e in viitor? In faza asta NU trebuie
  // sa surrender (jocul nu a inceput inca — server-ul ar inchide ses cu
  // toti la duration 0 → tie → toti WINNER).
  const inCountdown =
    !!me?.phoneDownAt && new Date(me.phoneDownAt).getTime() > Date.now();

  // Auto-surrender daca user-ul ridica telefonul (NU e in call si NU e
  // face-down). E o decizie clienta — server-ul valideaza separat.
  //
  // Avem nevoie de un mic grace period dupa ce intram in "playing" ca user-ul
  // sa apuce sa intoarca telefonul.
  const playingStartedRef = useRef<number | null>(null);
  useEffect(() => {
    if (sensorEnabled && session?.status === 'PLAYING' && !inCountdown && isFaceDown) {
      if (!playingStartedRef.current) {
        playingStartedRef.current = Date.now();
      }
    } else if (!sensorEnabled) {
      playingStartedRef.current = null;
    }
  }, [sensorEnabled, isFaceDown, session?.status, inCountdown]);

  useEffect(() => {
    if (!sensorEnabled) return;
    if (!sessionId) return;
    if (!me) return;
    if (me.status !== 'ACTIVE') return;
    if (inCountdown) return; // jocul n-a inceput — nu surrender pe miscari pre-start
    if (isInCall) return; // pauza pentru apel — nu surrender
    if (isFaceDown) return;
    if (!playingStartedRef.current) return; // n-a inceput sa joace efectiv
    // Telefonul a fost ridicat — surrender.
    surrenderMut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFaceDown, isInCall, sensorEnabled, sessionId, me?.status, inCountdown]);

  // AppState: daca aplicatia merge in background din alt motiv decat un apel
  // (ex. user-ul a apasat home), e tot un surrender — ne aliniem la
  // FocusMode din cowalk. Nu in countdown (vezi mai sus).
  useEffect(() => {
    if (!sensorEnabled) return;
    if (!sessionId) return;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (
        next === 'background' &&
        !isInCall &&
        !inCountdown &&
        me?.status === 'ACTIVE'
      ) {
        surrenderMut.mutate();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensorEnabled, sessionId, isInCall, me?.status, inCountdown]);

  // Calculam faza din state-ul server + sensori. Fata in jos in "PLAYING"
  // = playing; ridicat in "PLAYING" = waitingDown (asteptam sa puna jos);
  // dupa surrender → surrendered/winner; dupa end → ended.
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
    // ACTIVE — phoneDownAt poate fi in viitor (countdown).
    if (me.phoneDownAt) {
      const phoneDownAtMs = new Date(me.phoneDownAt).getTime();
      if (Date.now() < phoneDownAtMs) return 'countdown';
    }
    if (!isFaceDown) return 'waitingDown';
    return 'playing';
  })();

  // myDurationMs — server-ul ne da deja un live; folosim direct.
  const myDurationMs = me?.durationMs ?? 0;

  return {
    phase,
    session,
    sessionError: sessionQuery.error,
    myDurationMs,
    isInCall,
    isFaceDown,
    myRank,
    surrender: async () => {
      await surrenderMut.mutateAsync();
    },
  };
}
