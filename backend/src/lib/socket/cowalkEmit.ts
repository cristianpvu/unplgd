import { getIO } from './io.js';
import { userRoomName } from './io.js';
import { prisma } from '../prisma.js';
import type { Participant, SyncEvent } from '../cowalk/session.js';
import { getPetSummariesByUserIds, type PetSummary } from '../petImage.js';

// Toate event-urile co-walk merg pe room-ul `user:<userId>` (auto-join la
// connection in io.ts). Recipients vin in event-ul insusi din state machine.

export type ThinParticipant = {
  userId: string;
  joinedAt: number;
  name: string;
  level: number;
  // SVG-ul capului (Avatar.svg din DB) cand exista — null daca user-ul nu si-a
  // generat inca avatarul. Mobile-ul il randeaza in stack-ul co-walk-ului.
  avatarSvg: string | null;
  // Pet-ul echipat al user-ului (mobile-l afiseaza ca un mic chip in coltul
  // avatarului). null cand userul n-are pet (extrem de rar — ensureDefaultPet
  // se ruleaza la register).
  pet: PetSummary | null;
};

type Resolved = {
  name: string;
  level: number;
  avatarSvg: string | null;
  pet: PetSummary | null;
};

// Cache mic in-memory pt nume/level/avatar — TTL 5 min ca update-urile (XP,
// level, avatar nou) sa apara fara reload de container. Acces la fiecare emit
// ar fi prea greu pe DB; cache-ul colapseaza load-ul aproape de 0 cand 2
// prieteni merg impreuna pe acelasi tick.
const NAME_CACHE_TTL_MS = 5 * 60 * 1000;
const nameCache = new Map<string, Resolved & { cachedAt: number }>();

export async function resolveParticipantInfo(
  userIds: string[],
): Promise<Map<string, Resolved>> {
  const out = new Map<string, Resolved>();
  const now = Date.now();
  const missing: string[] = [];
  for (const id of userIds) {
    const c = nameCache.get(id);
    if (c && now - c.cachedAt < NAME_CACHE_TTL_MS) {
      out.set(id, { name: c.name, level: c.level, avatarSvg: c.avatarSvg, pet: c.pet });
    } else {
      missing.push(id);
    }
  }
  if (missing.length > 0) {
    const [users, pets] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: missing } },
        select: {
          id: true,
          name: true,
          level: true,
          avatar: { select: { svg: true } },
        },
      }),
      getPetSummariesByUserIds(missing),
    ]);
    for (const u of users) {
      const entry: Resolved = {
        name: u.name,
        level: u.level,
        avatarSvg: u.avatar?.svg ?? null,
        pet: pets.get(u.id) ?? null,
      };
      nameCache.set(u.id, { ...entry, cachedAt: now });
      out.set(u.id, entry);
    }
  }
  return out;
}

async function thin(ps: Participant[]): Promise<ThinParticipant[]> {
  const info = await resolveParticipantInfo(ps.map((p) => p.userId));
  return ps.map((p) => {
    const n = info.get(p.userId);
    return {
      userId: p.userId,
      joinedAt: p.joinedAt,
      name: n?.name ?? 'Unknown',
      level: n?.level ?? 1,
      avatarSvg: n?.avatarSvg ?? null,
      pet: n?.pet ?? null,
    };
  });
}

// Toate payload-urile poarta `serverNow` ca mobile sa poata calcula offset-ul
// fata de ceasul propriu si sa rendere elapsed-ul corect chiar daca are
// telefonul nesincronizat NTP.
export type CowalkStartedPayload = {
  sessionId: string;
  startedAt: number;
  serverNow: number;
  participants: ThinParticipant[];
};

export type CowalkJoinedPayload = {
  sessionId: string;
  serverNow: number;
  participant: ThinParticipant;
  participants: ThinParticipant[];
};

// Mobile foloseste participant.userId / participants[].userId pt match-uri
// cu ce stie deja local. Numele e injectat aici ca toast/UI sa nu mai astepte
// resolve roundtrips inainte sa afiseze "Co-walk cu X".
export type CowalkLeftPayload = {
  sessionId: string;
  userId: string;
  remaining: ThinParticipant[];
};

export type CowalkEndedPayload = {
  sessionId: string;
};

export type CowalkCompletedPayload = {
  sessionId: string;
  userId: string;
  durationSec: number;
  squadSize: number;
};

export async function emitSyncEvents(events: SyncEvent[]): Promise<void> {
  if (events.length === 0) return;
  let io;
  try {
    io = getIO();
  } catch {
    return;
  }
  const serverNow = Date.now();
  for (const ev of events) {
    if (ev.recipients.length === 0) continue;
    const rooms = ev.recipients.map(userRoomName);
    switch (ev.type) {
      case 'started': {
        const participants = await thin(ev.participants);
        io.to(rooms).emit('cowalk:started', {
          sessionId: ev.sessionId,
          startedAt: ev.startedAt,
          serverNow,
          participants,
        } satisfies CowalkStartedPayload);
        break;
      }
      case 'joined': {
        const [participants, joinedThin] = await Promise.all([
          thin(ev.participants),
          thin([ev.participant]),
        ]);
        const joined = joinedThin[0];
        if (!joined) break;
        io.to(rooms).emit('cowalk:joined', {
          sessionId: ev.sessionId,
          serverNow,
          participant: joined,
          participants,
        } satisfies CowalkJoinedPayload);
        break;
      }
      case 'left': {
        const remaining = await thin(ev.remaining);
        io.to(rooms).emit('cowalk:left', {
          sessionId: ev.sessionId,
          userId: ev.userId,
          remaining,
        } satisfies CowalkLeftPayload);
        break;
      }
      case 'ended':
        io.to(rooms).emit('cowalk:ended', {
          sessionId: ev.sessionId,
        } satisfies CowalkEndedPayload);
        break;
      case 'completed':
        io.to(rooms).emit('cowalk:completed', {
          sessionId: ev.sessionId,
          userId: ev.userId,
          durationSec: ev.durationSec,
          squadSize: ev.squadSize,
        } satisfies CowalkCompletedPayload);
        break;
    }
  }
}
