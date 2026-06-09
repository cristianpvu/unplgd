import { Router } from 'express';
import { z } from 'zod';
import { FriendshipStatus, PhoneDownStatus, PhoneDownParticipantStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import {
  PHONE_DOWN_CAP_MS,
  effectiveDurationMs,
  endSession,
  finalizeIfExpired,
} from '../lib/phonedown/session.js';
import {
  emitPhoneDownInvite,
  emitPhoneDownUpdate,
} from '../lib/socket/phonedownEmit.js';
import { sendPushToUser } from '../lib/push/expoPush.js';
import { logger } from '../lib/logger.js';

export const phoneDownRouter = Router();

const createLobbySchema = z.object({
  // Prietenii din raza BLE pe care host-ul vrea sa-i invite. Server-ul filtreaza
  // sa fie cu adevarat prieteni (FriendshipStatus.ACCEPTED) — daca utilizatorul
  // trimite ID-uri arbitrare, le ignoram in tacere.
  invitedFriendIds: z.array(z.string().min(1)).max(50).default([]),
});

function serializeParticipant(p: {
  id: string;
  userId: string;
  status: PhoneDownParticipantStatus;
  joinedAt: Date;
  phoneDownAt: Date | null;
  surrenderedAt: Date | null;
  pausedAt: Date | null;
  pausedAccumMs: number;
  rank: number | null;
  durationMs: number | null;
  user: { id: string; name: string };
}, capAt: Date | null, now: Date) {
  const liveDuration = p.durationMs ?? effectiveDurationMs({
    phoneDownAt: p.phoneDownAt,
    surrenderedAt: p.surrenderedAt,
    pausedAt: p.pausedAt,
    pausedAccumMs: p.pausedAccumMs,
    capAt,
    now,
  });
  return {
    id: p.id,
    userId: p.userId,
    name: p.user.name,
    status: p.status,
    joinedAt: p.joinedAt,
    phoneDownAt: p.phoneDownAt,
    surrenderedAt: p.surrenderedAt,
    rank: p.rank,
    durationMs: liveDuration,
    isPaused: p.pausedAt !== null && p.status === PhoneDownParticipantStatus.PAUSED,
  };
}

const SESSION_INCLUDE = {
  participants: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { joinedAt: 'asc' },
  },
} as const;

async function loadSession(sessionId: string) {
  return prisma.phoneDownSession.findUnique({
    where: { id: sessionId },
    include: SESSION_INCLUDE,
  });
}

function serializeSession(
  session: NonNullable<Awaited<ReturnType<typeof loadSession>>>,
  now: Date,
) {
  return {
    id: session.id,
    status: session.status,
    hostId: session.hostId,
    startedAt: session.startedAt,
    capAt: session.capAt,
    endedAt: session.endedAt,
    serverNow: now,
    participants: session.participants.map((p) =>
      serializeParticipant(p, session.capAt, now),
    ),
  };
}

// Verifica daca user-ul e participant la o sesiune anumita (pentru
// autorizare la actiuni: surrender, pause etc.).
async function requireParticipant(sessionId: string, userId: string) {
  const part = await prisma.phoneDownParticipant.findUnique({
    where: { sessionId_userId: { sessionId, userId } },
  });
  if (!part) throw forbidden('not_participant', 'Not a participant in this session');
  return part;
}

// POST /phonedown/lobby — creeaza sesiunea + adauga host + invita prietenii.
phoneDownRouter.post('/lobby', requireAuth, async (req, res, next) => {
  try {
    const { invitedFriendIds } = createLobbySchema.parse(req.body);
    const userId = req.userId!;

    // Host-ul nu trebuie sa fie in vreo sesiune activa (in lobby sau jucand).
    const ongoing = await prisma.phoneDownParticipant.findFirst({
      where: {
        userId,
        session: { status: { in: [PhoneDownStatus.WAITING, PhoneDownStatus.PLAYING] } },
      },
    });
    if (ongoing) throw conflict('already_in_session', 'You are already in a Phone Down session');

    // Filtram prietenii reali (ACCEPTED in oricare directie). Restul de
    // friend-ids primite sunt ignorati silent — nu vrem sa rejectam request-ul
    // pentru ca BLE-ul a returnat un user random.
    const friendships = await prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [
          { requesterId: userId, receiverId: { in: invitedFriendIds } },
          { receiverId: userId, requesterId: { in: invitedFriendIds } },
        ],
      },
      select: { requesterId: true, receiverId: true },
    });
    const realFriendIds = friendships.map((f) =>
      f.requesterId === userId ? f.receiverId : f.requesterId,
    );

    const host = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    if (!host) throw notFound('user_not_found', 'User not found');

    const session = await prisma.phoneDownSession.create({
      data: {
        hostId: userId,
        status: PhoneDownStatus.WAITING,
        participants: {
          create: { userId, status: PhoneDownParticipantStatus.ACTIVE },
        },
      },
      include: SESSION_INCLUDE,
    });

    // Notificare directa la fiecare prieten — mobilul afiseaza un toast
    // "<host> te-a invitat la Phone Down" cu buton "Intra".
    for (const fid of realFriendIds) {
      emitPhoneDownInvite(fid, {
        sessionId: session.id,
        hostId: userId,
        hostName: host.name,
      });
    }

    // Push real (APNs/FCM via Expo) pe langa socketul in-app: invitatul e
    // notificat chiar daca app-ul e in background sau inchis — singura cale
    // sigura cand socketul nu e conectat. Fire-and-forget: nu intarziem
    // raspunsul host-ului si nu pica crearea lobby-ului daca pushul esueaza.
    for (const fid of realFriendIds) {
      void sendPushToUser(fid, {
        title: `${host.name} te-a invitat`,
        body: 'Last Phone Standing — cine rezista mai mult fara telefon',
        data: {
          kind: 'phonedown_invite',
          sessionId: session.id,
          hostId: userId,
          hostName: host.name,
        },
        channelId: 'social',
        sound: 'default',
      }).catch((err) => logger.warn({ err, fid }, 'phonedown_invite.push_failed'));
    }

    res.status(201).json(serializeSession(session, new Date()));
  } catch (e) {
    next(e);
  }
});

// POST /phonedown/sessions/:id/join — adera la un lobby pe baza unei invitatii.
phoneDownRouter.post('/sessions/:id/join', requireAuth, async (req, res, next) => {
  try {
    const sessionId = req.params.id as string;
    const userId = req.userId!;

    const session = await loadSession(sessionId);
    if (!session) throw notFound('session_not_found', 'Session not found');
    if (session.status !== PhoneDownStatus.WAITING) {
      throw conflict('lobby_closed', 'Lobby is no longer open');
    }
    if (session.participants.some((p) => p.userId === userId)) {
      // Idempotent — daca user-ul a apasat de doua ori "Intra", returnam
      // starea curenta fara eroare.
      return res.json(serializeSession(session, new Date()));
    }

    // Verifica ca user-ul nu e in alta sesiune activa.
    const ongoing = await prisma.phoneDownParticipant.findFirst({
      where: {
        userId,
        session: { status: { in: [PhoneDownStatus.WAITING, PhoneDownStatus.PLAYING] } },
      },
    });
    if (ongoing) throw conflict('already_in_session', 'You are already in another Phone Down session');

    await prisma.phoneDownParticipant.create({
      data: { sessionId, userId, status: PhoneDownParticipantStatus.ACTIVE },
    });

    const updated = await loadSession(sessionId);
    if (!updated) throw notFound('session_not_found', 'Session not found');
    emitPhoneDownUpdate(sessionId, 'lobby_changed');
    res.json(serializeSession(updated, new Date()));
  } catch (e) {
    next(e);
  }
});

// POST /phonedown/sessions/:id/leave — paraseste lobby-ul (doar pre-start).
phoneDownRouter.post('/sessions/:id/leave', requireAuth, async (req, res, next) => {
  try {
    const sessionId = req.params.id as string;
    const userId = req.userId!;
    const session = await loadSession(sessionId);
    if (!session) throw notFound('session_not_found', 'Session not found');
    if (session.status !== PhoneDownStatus.WAITING) {
      throw conflict('cannot_leave', 'Session already started');
    }

    if (session.hostId === userId) {
      // Host-ul paraseste = lobby anulat.
      await prisma.phoneDownSession.update({
        where: { id: sessionId },
        data: { status: PhoneDownStatus.CANCELLED, endedAt: new Date() },
      });
      emitPhoneDownUpdate(sessionId, 'cancelled');
    } else {
      await prisma.phoneDownParticipant.deleteMany({
        where: { sessionId, userId },
      });
      emitPhoneDownUpdate(sessionId, 'lobby_changed');
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// POST /phonedown/sessions/:id/start — host porneste runda.
phoneDownRouter.post('/sessions/:id/start', requireAuth, async (req, res, next) => {
  try {
    const sessionId = req.params.id as string;
    const userId = req.userId!;
    const session = await loadSession(sessionId);
    if (!session) throw notFound('session_not_found', 'Session not found');
    if (session.hostId !== userId) throw forbidden('not_host', 'Only host can start');
    if (session.status !== PhoneDownStatus.WAITING) {
      throw conflict('not_waiting', 'Session is not in lobby state');
    }
    if (session.participants.length < 2) {
      throw badRequest('need_two_players', 'Need at least 2 participants to start');
    }

    const startedAt = new Date();
    // Fara countdown — jocul porneste imediat. Mobile-ul afiseaza imediat
    // ecranul de blocare cu timer la 00:00 si pleaca de acolo.
    const capAt = new Date(startedAt.getTime() + PHONE_DOWN_CAP_MS);

    await prisma.$transaction(async (tx) => {
      await tx.phoneDownSession.update({
        where: { id: sessionId },
        data: {
          status: PhoneDownStatus.PLAYING,
          startedAt,
          capAt,
        },
      });
      await tx.phoneDownParticipant.updateMany({
        where: { sessionId },
        data: {
          status: PhoneDownParticipantStatus.ACTIVE,
          phoneDownAt: startedAt,
        },
      });
    });

    const updated = await loadSession(sessionId);
    if (!updated) throw notFound('session_not_found', 'Session not found');
    emitPhoneDownUpdate(sessionId, 'started');
    res.json(serializeSession(updated, new Date()));
  } catch (e) {
    next(e);
  }
});

// POST /phonedown/sessions/:id/surrender — am atins telefonul, ies din concurs.
phoneDownRouter.post('/sessions/:id/surrender', requireAuth, async (req, res, next) => {
  try {
    const sessionId = req.params.id as string;
    const userId = req.userId!;
    await finalizeIfExpired(sessionId);

    const session = await loadSession(sessionId);
    if (!session) throw notFound('session_not_found', 'Session not found');
    if (session.status !== PhoneDownStatus.PLAYING) {
      throw conflict('not_playing', 'Session is not active');
    }
    const me = session.participants.find((p) => p.userId === userId);
    if (!me) throw forbidden('not_participant', 'Not a participant');
    if (
      me.status !== PhoneDownParticipantStatus.ACTIVE &&
      me.status !== PhoneDownParticipantStatus.PAUSED
    ) {
      // Idempotent — daca a fost deja inregistrat (ex. retry), returnam state.
      return res.json(serializeSession(session, new Date()));
    }

    const now = new Date();
    // Daca era in pauza, finalizam si pauza curenta in accumulator inainte
    // sa calculam durata, ca durata sa nu includa fragmentul de apel.
    const extraPause = me.pausedAt
      ? Math.max(0, now.getTime() - me.pausedAt.getTime())
      : 0;
    const totalPaused = me.pausedAccumMs + extraPause;

    await prisma.phoneDownParticipant.update({
      where: { id: me.id },
      data: {
        status: PhoneDownParticipantStatus.SURRENDERED,
        surrenderedAt: now,
        pausedAccumMs: totalPaused,
        pausedAt: null,
      },
    });

    // Daca a mai ramas un singur participant activ → end (asta devine WINNER).
    // Daca au mai ramas 0 (toti SURRENDERED), end imediat (cazul cand ultimul
    // a cedat tot acum).
    const remainingActive = await prisma.phoneDownParticipant.count({
      where: {
        sessionId,
        status: {
          in: [PhoneDownParticipantStatus.ACTIVE, PhoneDownParticipantStatus.PAUSED],
        },
      },
    });
    if (remainingActive <= 1) {
      await endSession(sessionId);
    } else {
      emitPhoneDownUpdate(sessionId, 'participant_surrendered');
    }

    const final = await loadSession(sessionId);
    if (!final) throw notFound('session_not_found', 'Session not found');
    res.json(serializeSession(final, new Date()));
  } catch (e) {
    next(e);
  }
});

// POST /phonedown/sessions/:id/pause — incepe pauza pentru apel telefonic.
phoneDownRouter.post('/sessions/:id/pause', requireAuth, async (req, res, next) => {
  try {
    const sessionId = req.params.id as string;
    const userId = req.userId!;
    await finalizeIfExpired(sessionId);
    const me = await requireParticipant(sessionId, userId);
    if (me.status !== PhoneDownParticipantStatus.ACTIVE) {
      // Pauza dubla / participant care a iesit → no-op.
      return res.json({ ok: true });
    }
    await prisma.phoneDownParticipant.update({
      where: { id: me.id },
      data: {
        status: PhoneDownParticipantStatus.PAUSED,
        pausedAt: new Date(),
      },
    });
    emitPhoneDownUpdate(sessionId, 'participant_paused');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// POST /phonedown/sessions/:id/resume — apel terminat, reia ceasul.
phoneDownRouter.post('/sessions/:id/resume', requireAuth, async (req, res, next) => {
  try {
    const sessionId = req.params.id as string;
    const userId = req.userId!;
    await finalizeIfExpired(sessionId);
    const me = await requireParticipant(sessionId, userId);
    if (me.status !== PhoneDownParticipantStatus.PAUSED || !me.pausedAt) {
      return res.json({ ok: true });
    }
    const now = new Date();
    const fragment = Math.max(0, now.getTime() - me.pausedAt.getTime());
    await prisma.phoneDownParticipant.update({
      where: { id: me.id },
      data: {
        status: PhoneDownParticipantStatus.ACTIVE,
        pausedAt: null,
        pausedAccumMs: me.pausedAccumMs + fragment,
      },
    });
    emitPhoneDownUpdate(sessionId, 'participant_resumed');
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// GET /phonedown/sessions/:id — status + clasament live.
phoneDownRouter.get('/sessions/:id', requireAuth, async (req, res, next) => {
  try {
    const sessionId = req.params.id as string;
    await finalizeIfExpired(sessionId);
    const session = await loadSession(sessionId);
    if (!session) throw notFound('session_not_found', 'Session not found');
    // Doar participantii (sau invitatii pre-start) vad sesiunea.
    const isParticipant = session.participants.some((p) => p.userId === req.userId);
    if (!isParticipant) throw forbidden('not_participant', 'Not a participant');
    res.json(serializeSession(session, new Date()));
  } catch (e) {
    next(e);
  }
});

// GET /phonedown/current — sesiunea activa (WAITING/PLAYING) a user-ului.
// Util pentru mobile la deschidere — daca exista o sesiune in curs, redirect.
phoneDownRouter.get('/current', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const part = await prisma.phoneDownParticipant.findFirst({
      where: {
        userId,
        session: { status: { in: [PhoneDownStatus.WAITING, PhoneDownStatus.PLAYING] } },
      },
      orderBy: { joinedAt: 'desc' },
      select: { sessionId: true },
    });
    if (!part) return res.json({ session: null });
    await finalizeIfExpired(part.sessionId);
    const session = await loadSession(part.sessionId);
    if (!session) return res.json({ session: null });
    res.json({ session: serializeSession(session, new Date()) });
  } catch (e) {
    next(e);
  }
});
