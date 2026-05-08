import { Router } from 'express';
import { z } from 'zod';
import { FriendshipStatus } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { markSeen, viewersWhoSaw } from '../lib/presence.js';
import { prisma } from '../lib/prisma.js';
import {
  tickHeartbeat,
  getSessionForUser,
  leaveSession,
  isLeftRecently,
  filterRecentlyLeft,
} from '../lib/cowalk/session.js';
import { emitSyncEvents, resolveParticipantInfo } from '../lib/socket/cowalkEmit.js';
import { awardCowalkParticipant } from '../lib/cowalk/award.js';
export const presenceRouter = Router();
presenceRouter.use(requireAuth);

const heartbeatSchema = z.object({
  // Lista de userId-uri pe care user-ul curent le vede ACUM prin BLE.
  // Limita 50 = scenariu real (clasa de scoala) cu marja confortabila;
  // mai mult de atat e abuz si refuzam (blocheaza un atacator care
  // umple Redis cu peer-i fictivi).
  peers: z.array(z.string().cuid()).max(50),
});

// Heartbeat presence: client-ul mobil trimite la fiecare 20-30s lista
// prietenilor vazuti acum. Stocata in Redis cu TTL 90s. Dupa markSeen,
// rulam si tick-ul de session co-walk: identificam prietenii mutual
// vizibili, ii atragem in / cream sesiuni si emitem evenimente prin socket.
presenceRouter.post('/heartbeat', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { peers } = heartbeatSchema.parse(req.body);
    // Filtrari de baza: dedup si excludem self.
    const cleaned = [...new Set(peers.filter((id) => id !== me))];
    await markSeen(me, cleaned);

    // Determinam mutual peers care sunt si prieteni ACCEPTED. Doar acestia
    // intra in sesiuni de co-walk.
    const friendIds = cleaned.length ? await loadFriendIds(me, cleaned) : new Set<string>();
    const friendsSeen = cleaned.filter((id) => friendIds.has(id));
    const sawMe = friendsSeen.length
      ? await viewersWhoSaw(friendsSeen, me)
      : new Set<string>();
    let mutualPeers = friendsSeen.filter((id) => sawMe.has(id));

    // Guard "left recently": daca eu sau un peer am dat toggle off in
    // ultimele LEFT_GUARD_TTL_SECONDS, nu re-cream sesiuni cu el. Asta
    // acopera race-ul cand un heartbeat e in zbor in timp ce leaveSession
    // tocmai a destruit sesiunea — fara guard, tickHeartbeat ar prinde din
    // nou peer-ul mutual si ar emite cowalk:started, lasandu-l pe celalalt
    // user blocat in sesiune fantoma.
    if (await isLeftRecently(me)) {
      mutualPeers = [];
    } else if (mutualPeers.length > 0) {
      const guarded = await filterRecentlyLeft(mutualPeers);
      if (guarded.size > 0) {
        mutualPeers = mutualPeers.filter((id) => !guarded.has(id));
      }
    }

    const { events } = await tickHeartbeat(me, mutualPeers, Date.now(), async (args) => {
      await awardCowalkParticipant({
        userId: args.userId,
        peerIds: args.peerIds,
        sessionId: args.sessionId,
        durationSec: args.durationSec,
        steps: args.steps,
        rssiStdDev: args.rssiStdDev,
      });
    });
    await emitSyncEvents(events);

    res.json({ ok: true, count: cleaned.length, sessionEvents: events.length });
  } catch (e) {
    next(e);
  }
});

// Scoate user-ul din sesiunea curenta de co-walk imediat (fara sa astepte
// grace-ul de 90s). Folosit cand user-ul dezactiveaza manual feature-ul:
// vrem ca ceilalti membri sa primeasca cowalk:left in <1s, nu dupa 90s.
// Sterge si markSeen ca nu mai apara in heartbeat-urile altora pana la
// urmatoarea lor sincronizare.
presenceRouter.post('/cowalk/leave', async (req, res, next) => {
  try {
    const me = req.userId!;
    const events = await leaveSession(me);
    await markSeen(me, []);
    await emitSyncEvents(events);
    res.json({ ok: true, leftEvents: events.length });
  } catch (e) {
    next(e);
  }
});

// Returneaza sesiunea curenta de co-walk a userului (daca exista). Folosit
// la reconnect: mobile-ul cere starea curenta si reia UI-ul de unde a ramas.
presenceRouter.get('/cowalk/current', async (req, res, next) => {
  try {
    const me = req.userId!;
    const session = await getSessionForUser(me);
    if (!session) {
      res.json({ serverNow: Date.now(), session: null });
      return;
    }
    const participantIds = Object.keys(session.participants);
    const info = await resolveParticipantInfo(participantIds);
    res.json({
      serverNow: Date.now(),
      session: {
        id: session.id,
        startedAt: session.startedAt,
        participants: Object.values(session.participants).map((p) => {
          const u = info.get(p.userId);
          return {
            userId: p.userId,
            joinedAt: p.joinedAt,
            awarded: p.awarded,
            name: u?.name ?? 'Unknown',
            level: u?.level ?? 1,
            avatarSvg: u?.avatarSvg ?? null,
          };
        }),
      },
    });
  } catch (e) {
    next(e);
  }
});

async function loadFriendIds(me: string, candidates: string[]): Promise<Set<string>> {
  if (candidates.length === 0) return new Set();
  const fs = await prisma.friendship.findMany({
    where: {
      status: FriendshipStatus.ACCEPTED,
      OR: [
        { requesterId: me, receiverId: { in: candidates } },
        { receiverId: me, requesterId: { in: candidates } },
      ],
    },
    select: { requesterId: true, receiverId: true },
  });
  const ids = new Set<string>();
  for (const f of fs) ids.add(f.requesterId === me ? f.receiverId : f.requesterId);
  return ids;
}

