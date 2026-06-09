import type { Server as HttpServer } from 'node:http';
import { Server as IOServer, type Socket } from 'socket.io';
import { verifyToken } from '../jwt.js';
import { logger } from '../logger.js';
import { prisma } from '../prisma.js';
import { recordReport } from '../cowalk/session.js';
import { phoneDownRoomName } from './phonedownEmit.js';

// Singleton — initializat o data la boot in server.ts.
let io: IOServer | null = null;

export type AuthSocket = Socket & { data: { userId: string } };

export function initIO(server: HttpServer): IOServer {
  if (io) return io;
  io = new IOServer(server, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
    // Heartbeat scurt ca sa detectam disconnect-uri rapid (ex. user pleaca din parc).
    pingInterval: 20_000,
    pingTimeout: 10_000,
  });

  // JWT auth la handshake — token in `auth.token` sau in header.
  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.headers.authorization?.toString().startsWith('Bearer ')
          ? socket.handshake.headers.authorization.toString().slice(7)
          : undefined);
      if (!token) return next(new Error('missing_token'));
      const { sub } = verifyToken(token);
      (socket as AuthSocket).data.userId = sub;
      next();
    } catch {
      next(new Error('invalid_token'));
    }
  });

  io.on('connection', async (rawSocket) => {
    const socket = rawSocket as AuthSocket;
    logger.debug({ userId: socket.data.userId, sid: socket.id }, 'socket connected');

    // Auto-join user-room. Toate event-urile co-walk emise de backend sunt
    // adresate user-ului (room `user:<userId>`) — fiecare participant vede
    // propria sa progresie / participantii din sesiunea lui. Reconnect-urile
    // sunt automate, fara ca mobile-ul sa "cheme" un join.
    //
    // AWAIT deliberat: daca un cowalk:started se emite in fereastra dintre
    // connect si finalizarea join-ului, event-ul ajunge intr-un room gol si
    // se pierde (clientul ramane blocat pe "Ma conectez..."). Asteptand
    // join-ul inainte de orice altceva inchidem race-ul la sursa.
    await socket.join(userRoomName(socket.data.userId));

    // cowalk:report { sessionId, steps, rssiSamples } — mobile trimite la
    // ~30s. Backend acumuleaza pasii (max) si RSSI samples (append cu cap)
    // pe sesiunea curenta a userului. Verifica indirect autorizarea: daca
    // userId nu e in sesiunea cu acel sessionId, recordReport returneaza
    // null si ignoram update-ul.
    socket.on(
      'cowalk:report',
      async (payload: unknown, ack?: (resp: unknown) => void) => {
        try {
          const parsed = parseCowalkReport(payload);
          if (!parsed) throw new Error('invalid_payload');
          const session = await recordReport(
            socket.data.userId,
            parsed.steps,
            parsed.rssiSamples,
          );
          if (!session || session.id !== parsed.sessionId) {
            ack?.({ ok: false, error: 'session_mismatch' });
            return;
          }
          ack?.({ ok: true });
        } catch (e: any) {
          ack?.({ ok: false, error: e?.message ?? 'report_failed' });
        }
      },
    );

    // hunt:join { sessionId } — server valideaza ca user e membru/host/lobby
    // si baga socket-ul in room. Tot ce vine pe room ramane scoped per-session.
    socket.on('hunt:join', async (payload: unknown, ack?: (resp: unknown) => void) => {
      try {
        const sessionId =
          payload && typeof payload === 'object' && 'sessionId' in payload
            ? String((payload as { sessionId: unknown }).sessionId)
            : null;
        if (!sessionId) throw new Error('missing_sessionId');
        const userId = socket.data.userId;
        const allowed = await isSessionMember(sessionId, userId);
        if (!allowed) throw new Error('not_member');
        await socket.join(huntRoomName(sessionId));
        ack?.({ ok: true });
      } catch (e: any) {
        ack?.({ ok: false, error: e?.message ?? 'join_failed' });
      }
    });

    socket.on('hunt:leave', async (payload: unknown, ack?: (resp: unknown) => void) => {
      try {
        const sessionId =
          payload && typeof payload === 'object' && 'sessionId' in payload
            ? String((payload as { sessionId: unknown }).sessionId)
            : null;
        if (!sessionId) throw new Error('missing_sessionId');
        await socket.leave(huntRoomName(sessionId));
        ack?.({ ok: true });
      } catch (e: any) {
        ack?.({ ok: false, error: e?.message ?? 'leave_failed' });
      }
    });

    // phonedown:join { sessionId } — abonare la room-ul sesiunii (events
    // tip lobby_changed, started, surrendered, ended). Verifica autorizarea
    // prin lookup participant — non-participantii nu primesc nimic.
    socket.on('phonedown:join', async (payload: unknown, ack?: (resp: unknown) => void) => {
      try {
        const sessionId =
          payload && typeof payload === 'object' && 'sessionId' in payload
            ? String((payload as { sessionId: unknown }).sessionId)
            : null;
        if (!sessionId) throw new Error('missing_sessionId');
        const userId = socket.data.userId;
        const part = await prisma.phoneDownParticipant.findUnique({
          where: { sessionId_userId: { sessionId, userId } },
          select: { id: true },
        });
        if (!part) throw new Error('not_participant');
        await socket.join(phoneDownRoomName(sessionId));
        ack?.({ ok: true });
      } catch (e: any) {
        ack?.({ ok: false, error: e?.message ?? 'join_failed' });
      }
    });

    socket.on('phonedown:leave', async (payload: unknown, ack?: (resp: unknown) => void) => {
      try {
        const sessionId =
          payload && typeof payload === 'object' && 'sessionId' in payload
            ? String((payload as { sessionId: unknown }).sessionId)
            : null;
        if (!sessionId) throw new Error('missing_sessionId');
        await socket.leave(phoneDownRoomName(sessionId));
        ack?.({ ok: true });
      } catch (e: any) {
        ack?.({ ok: false, error: e?.message ?? 'leave_failed' });
      }
    });

    socket.on('disconnect', () => {
      logger.debug({ userId: socket.data.userId, sid: socket.id }, 'socket disconnected');
    });
  });

  return io;
}

export function getIO(): IOServer {
  if (!io) throw new Error('Socket.IO not initialized — call initIO(server) first');
  return io;
}

export function huntRoomName(sessionId: string): string {
  return `hunt:s:${sessionId}`;
}

export function userRoomName(userId: string): string {
  return `user:${userId}`;
}

function parseCowalkReport(
  payload: unknown,
): { sessionId: string; steps: number; rssiSamples: number[] } | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.sessionId !== 'string') return null;
  if (typeof p.steps !== 'number' || !Number.isFinite(p.steps) || p.steps < 0) return null;
  if (!Array.isArray(p.rssiSamples)) return null;
  // Cap defensive pe payload incoming (anti-abuz: mobile spam-uieste cu lista
  // imensa). 600 samples = ~10 min la 1Hz, e tot ce am putea primi rezonabil.
  const samples: number[] = [];
  for (const v of p.rssiSamples.slice(0, 600)) {
    if (typeof v === 'number' && Number.isFinite(v) && v >= -120 && v <= 0) samples.push(v);
  }
  return {
    sessionId: p.sessionId,
    steps: Math.floor(p.steps),
    rssiSamples: samples,
  };
}

// Membru daca: e host, e in lobby, sau e in vreo echipa a sesiunii.
async function isSessionMember(sessionId: string, userId: string): Promise<boolean> {
  const session = await prisma.huntSession.findUnique({
    where: { id: sessionId },
    select: {
      hostId: true,
      lobby: { where: { userId }, select: { userId: true } },
      teams: {
        select: {
          members: { where: { userId }, select: { userId: true } },
        },
      },
    },
  });
  if (!session) return false;
  if (session.hostId === userId) return true;
  if (session.lobby.length > 0) return true;
  return session.teams.some((t) => t.members.length > 0);
}
