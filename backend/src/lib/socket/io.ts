import type { Server as HttpServer } from 'node:http';
import { Server as IOServer, type Socket } from 'socket.io';
import { verifyToken } from '../jwt.js';
import { logger } from '../logger.js';
import { prisma } from '../prisma.js';

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

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthSocket;
    logger.debug({ userId: socket.data.userId, sid: socket.id }, 'socket connected');

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
