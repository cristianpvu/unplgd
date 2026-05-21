import { Router } from 'express';
import { z } from 'zod';
import type { Polygon, MultiPolygon } from 'geojson';
import {
  ChallengeOutcome,
  ChallengeType,
  FriendshipStatus,
  HuntStatus,
  MonsterStatus,
  type MonsterType,
  Prisma,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { getParksNear, pointInPark } from '../lib/hunt/overpass.js';
import { splitPolygonIntoZones, zoneAreaSqm } from '../lib/hunt/zones.js';
import { assignTeamsRandomly } from '../lib/hunt/teamAssign.js';
import {
  generateSpawns,
  loadActiveTemplates,
  MONSTER_POINTS,
  MONSTER_CHALLENGES_PER_MEMBER,
} from '../lib/hunt/spawn.js';
import { resolveTokens } from '../lib/bleToken.js';
import { distanceMeters, warmthForDistance, bearingDegrees } from '../lib/hunt/warmth.js';
import { judgeRiddleAnswer, judgeCountingAnswer, judgeMcqAnswer } from '../lib/hunt/judge.js';
import { awardXp, XP_REWARDS } from '../lib/xp.js';
import { env } from '../env.js';
import { createDevHereSession } from '../lib/hunt/devSession.js';
import { emitHuntUpdate } from '../lib/socket/huntEmit.js';
import { generateHuntHints, type HintRun } from '../lib/ai/huntHint.js';
import { resolvePetImagePath } from '../lib/petImage.js';

export const huntRouter = Router();
huntRouter.use(requireAuth);

// Numar minim de jucatori in lobby ca host sa poata apasa start. 4 = 2 echipe
// minim, conditie pentru competitivitate. Override-uibil prin env in dev pt
// testare singur (HUNT_MIN_PLAYERS=1).
const MIN_LOBBY_PLAYERS = Math.max(1, Number(process.env.HUNT_MIN_PLAYERS) || 4);

// Durate permise pentru sesiune (15 / 30 / 45 min).
const ALLOWED_DURATIONS = new Set([900, 1800, 2700]);

const nearbySchema = z.object({
  lat: z.coerce.number().gte(-90).lte(90),
  lng: z.coerce.number().gte(-180).lte(180),
});

// GET /hunt/parks/nearby?lat=...&lng=...
// Returneaza parcurile in raza de 5km. Cache OSM in DB cu refresh saptamanal.
// Mobile-ul foloseste lista pentru ecranul "alege un parc" la pornirea hunt-ului.
huntRouter.get('/parks/nearby', async (req, res, next) => {
  try {
    const parsed = nearbySchema.safeParse(req.query);
    if (!parsed.success) throw badRequest('invalid_coords', 'Coordonate GPS invalide');
    const { lat, lng } = parsed.data;

    const parks = await getParksNear(lat, lng);

    res.json({
      parks: parks.map((p) => ({
        id: p.id,
        osmId: p.osmId,
        name: p.name,
        polygon: JSON.parse(p.polygon),
        bbox: {
          minLat: p.bboxMinLat,
          maxLat: p.bboxMaxLat,
          minLng: p.bboxMinLng,
          maxLng: p.bboxMaxLng,
        },
        areaSqm: Math.round(p.areaSqm),
        city: p.city,
        distanceM: Math.round(p.distanceM),
      })),
    });
  } catch (e) {
    next(e);
  }
});

// POST /hunt/sessions
// Host porneste un lobby. Trebuie sa fie in interiorul polygon-ului parc-ului.
const createSchema = z.object({
  parkId: z.string().cuid(),
  durationSec: z.number().int(),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

// POST /hunt/dev/quick-here
// Doar daca HUNT_DEV_MODE=true in env. Creeaza pe loc o sesiune de test cu
// parc fictiv 50x50m la coords date + 3 demo useri + monstri spawn-ati la
// 4-13m. Pentru testare AR pe device fara teren.
const devQuickSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

huntRouter.post('/dev/quick-here', async (req, res, next) => {
  try {
    if (!env.HUNT_DEV_MODE) {
      throw notFound('not_found', 'Endpoint indisponibil');
    }
    const me = req.userId!;
    const { lat, lng } = devQuickSchema.parse(req.body);
    const result = await createDevHereSession({ hostId: me, lat, lng });
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
});

// GET /hunt/dev/enabled — mobile checkeaza la pornirea ecranului hunt daca
// poate afisa toggle-ul de dev mode. Mai sigur decat sa hardcodam in mobile.
huntRouter.get('/dev/enabled', async (_req, res) => {
  res.json({ enabled: env.HUNT_DEV_MODE });
});

huntRouter.post('/sessions', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { parkId, durationSec, lat, lng } = createSchema.parse(req.body);
    if (!ALLOWED_DURATIONS.has(durationSec)) {
      throw badRequest('invalid_duration', 'Durata trebuie sa fie 15, 30 sau 45 min');
    }

    const park = await prisma.park.findUnique({ where: { id: parkId } });
    if (!park) throw notFound('park_not_found', 'Parcul nu exista');
    if (!pointInPark(lat, lng, park.polygon)) {
      throw badRequest('not_in_park', 'Trebuie sa fii in parc ca sa pornesti hunt-ul');
    }

    // Closing any prior LOBBY/ACTIVE session of this host — un host poate gestiona
    // doar o sesiune odata. Orfanele se sterg prin cascade.
    await prisma.huntSession.updateMany({
      where: { hostId: me, status: { in: [HuntStatus.LOBBY, HuntStatus.ACTIVE] } },
      data: { status: HuntStatus.CANCELLED, endedAt: new Date() },
    });

    const session = await prisma.huntSession.create({
      data: {
        hostId: me,
        parkId,
        durationSec,
        status: HuntStatus.LOBBY,
        // Host se auto-adauga in lobby la creare — nu trebuie sa apese join separat.
        lobby: { create: { userId: me } },
      },
      include: { park: { select: { id: true, name: true } }, lobby: { select: { userId: true } } },
    });

    res.status(201).json({
      sessionId: session.id,
      parkName: session.park.name,
      durationSec: session.durationSec,
      status: session.status,
      lobby: session.lobby.map((l) => ({ userId: l.userId })),
    });
  } catch (e) {
    next(e);
  }
});

// GET /hunt/sessions/lobby/nearby
// Pentru friend-ul prezent in BLE proximity de host: vede lobby-urile active
// hostate de prieteni pe care i-a vazut prin BLE in ultima minuta. Backend
// rezolva token-urile la userId-uri si filtreaza prietenii ACCEPTED cu LOBBY
// activ. Mobile-ul trimite lista de token-uri BLE vazute recent.
const lobbyNearbySchema = z.object({
  bleTokens: z.array(z.string().length(8).regex(/^[0-9a-fA-F]+$/)).max(20),
});

huntRouter.post('/sessions/lobby/nearby', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { bleTokens } = lobbyNearbySchema.parse(req.body);
    if (bleTokens.length === 0) {
      res.json({ lobbies: [] });
      return;
    }

    const tokenMap = await resolveTokens(bleTokens);
    const candidateHostIds = [...new Set([...tokenMap.values()])].filter((id) => id !== me);
    if (candidateHostIds.length === 0) {
      res.json({ lobbies: [] });
      return;
    }

    // Filtru: doar prieteni acceptati ai mei.
    const friendships = await prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [
          { requesterId: me, receiverId: { in: candidateHostIds } },
          { requesterId: { in: candidateHostIds }, receiverId: me },
        ],
      },
      select: { requesterId: true, receiverId: true },
    });
    const friendIds = new Set(
      friendships.map((f) => (f.requesterId === me ? f.receiverId : f.requesterId)),
    );
    const validHostIds = candidateHostIds.filter((id) => friendIds.has(id));
    if (validHostIds.length === 0) {
      res.json({ lobbies: [] });
      return;
    }

    const lobbies = await prisma.huntSession.findMany({
      where: { hostId: { in: validHostIds }, status: HuntStatus.LOBBY },
      include: {
        host: { select: { id: true, name: true, level: true, avatar: { select: { svg: true } } } },
        park: { select: { id: true, name: true } },
        lobby: { select: { userId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      lobbies: lobbies.map((s) => ({
        sessionId: s.id,
        host: {
          id: s.host.id,
          name: s.host.name,
          level: s.host.level,
          avatarSvg: s.host.avatar?.svg ?? null,
        },
        parkName: s.park.name,
        durationSec: s.durationSec,
        playerCount: s.lobby.length,
        joined: s.lobby.some((l) => l.userId === me),
      })),
    });
  } catch (e) {
    next(e);
  }
});

// POST /hunt/sessions/:id/join
// Friend in BLE proximity intra in lobby. Trebuie sa fie prieten ACCEPTED cu
// host-ul. Idempotent: re-apel returneaza success fara modificari.
huntRouter.post('/sessions/:id/join', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { id } = req.params;
    if (!id) throw badRequest('missing_id', 'sessionId lipsa');

    const session = await prisma.huntSession.findUnique({
      where: { id },
      select: { id: true, hostId: true, status: true },
    });
    if (!session) throw notFound('session_not_found', 'Sesiune inexistenta');
    if (session.status !== HuntStatus.LOBBY) {
      throw conflict('lobby_closed', 'Sesiunea nu mai accepta jucatori');
    }
    if (session.hostId === me) {
      // Host e auto-adaugat la create — un POST de join e no-op.
      res.json({ joined: true });
      return;
    }

    const friendship = await prisma.friendship.findFirst({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [
          { requesterId: me, receiverId: session.hostId },
          { requesterId: session.hostId, receiverId: me },
        ],
      },
      select: { id: true },
    });
    if (!friendship) {
      throw forbidden('not_friends', 'Trebuie sa fii prieten cu host-ul');
    }

    await prisma.huntLobbyMember.upsert({
      where: { sessionId_userId: { sessionId: id, userId: me } },
      create: { sessionId: id, userId: me },
      update: {},
    });

    emitHuntUpdate(id, 'lobby_changed');
    res.json({ joined: true });
  } catch (e) {
    next(e);
  }
});

// POST /hunt/sessions/:id/leave
// Friend iese din lobby inainte de start. Host nu poate face leave (face
// /cancel separat).
huntRouter.post('/sessions/:id/leave', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { id } = req.params;
    if (!id) throw badRequest('missing_id', 'sessionId lipsa');

    const session = await prisma.huntSession.findUnique({
      where: { id },
      select: { hostId: true, status: true },
    });
    if (!session) throw notFound('session_not_found', 'Sesiune inexistenta');
    if (session.hostId === me) {
      throw forbidden('host_cannot_leave', 'Host-ul nu poate parasi — anuleaza sesiunea');
    }
    if (session.status !== HuntStatus.LOBBY) {
      throw conflict('lobby_closed', 'Sesiunea a inceput deja');
    }

    await prisma.huntLobbyMember.deleteMany({
      where: { sessionId: id, userId: me },
    });
    emitHuntUpdate(id, 'lobby_changed');
    res.json({ left: true });
  } catch (e) {
    next(e);
  }
});

// POST /hunt/sessions/:id/start
// Host apasa start. Validam minim 4 jucatori, asignam team-urile random,
// generam zonele si spawn-urile. Tot in tranzactie ca state-ul sa fie atomic.
huntRouter.post('/sessions/:id/start', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { id } = req.params;
    if (!id) throw badRequest('missing_id', 'sessionId lipsa');

    const session = await prisma.huntSession.findUnique({
      where: { id },
      include: {
        park: { select: { polygon: true } },
        lobby: { select: { userId: true } },
      },
    });
    if (!session) throw notFound('session_not_found', 'Sesiune inexistenta');
    if (session.hostId !== me) throw forbidden('not_host', 'Doar host-ul poate porni');
    if (session.status !== HuntStatus.LOBBY) {
      throw conflict('not_in_lobby', 'Sesiunea nu mai e in lobby');
    }
    if (session.lobby.length < MIN_LOBBY_PLAYERS) {
      throw badRequest(
        'not_enough_players',
        `Aveti nevoie de minim ${MIN_LOBBY_PLAYERS} jucatori (acum sunteti ${session.lobby.length})`,
      );
    }

    const memberIds = session.lobby.map((l) => l.userId);
    const teamPlans = assignTeamsRandomly(memberIds);
    const parkPolygon = JSON.parse(session.park.polygon) as Polygon | MultiPolygon;
    const zones = splitPolygonIntoZones(parkPolygon, teamPlans.length);

    if (zones.length < teamPlans.length) {
      throw badRequest('zone_split_failed', 'Parcul nu poate fi impartit suficient');
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + session.durationSec * 1000);

    // Incarcam template-urile de monstri INAINTE de tranzactie — evitam
    // un query DB inauntrul tranzactiei si fail-uim repede daca lipsesc
    // template-uri (mesaj clar inainte sa cream zone/echipe).
    const templatesByTier = await loadActiveTemplates(prisma);

    const result = await prisma.$transaction(async (tx) => {
      // Cream echipele cu zona si membri.
      const createdTeams: { id: string; zone: Polygon | MultiPolygon }[] = [];
      for (let i = 0; i < teamPlans.length; i++) {
        const plan = teamPlans[i]!;
        const zone = zones[i]!;
        // Lider random — telefonul lui e cel pe care ruleaza vanatoarea pt
        // toata echipa. Restul stau langa el fizic si discuta raspunsurile.
        const leaderId = plan.memberIds[Math.floor(Math.random() * plan.memberIds.length)]!;
        const team = await tx.huntTeam.create({
          data: {
            sessionId: id,
            name: plan.name,
            leaderId,
            zone: JSON.stringify(zone),
            zoneArea: zoneAreaSqm(zone),
            members: { create: plan.memberIds.map((userId) => ({ userId })) },
          },
        });
        createdTeams.push({ id: team.id, zone });
      }

      const { spawns, totalCount } = generateSpawns(createdTeams, templatesByTier);

      // Bulk create monsters per echipa.
      for (const sp of spawns) {
        if (sp.monsters.length === 0) continue;
        await tx.huntMonster.createMany({
          data: sp.monsters.map((m) => ({
            sessionId: id,
            teamId: sp.teamId,
            type: m.type,
            slug: m.slug,
            name: m.name,
            loreShort: m.loreShort,
            lat: m.lat,
            lng: m.lng,
          })),
        });
      }

      const updated = await tx.huntSession.update({
        where: { id },
        data: {
          status: HuntStatus.ACTIVE,
          startedAt: now,
          endsAt,
          monsterCount: totalCount,
        },
      });

      // Stergem lobby-ul — sursa de adevar pentru participanti devine teamMember.
      await tx.huntLobbyMember.deleteMany({ where: { sessionId: id } });

      return { session: updated, totalCount };
    });

    emitHuntUpdate(id, 'started');
    res.json({
      sessionId: id,
      status: result.session.status,
      startedAt: result.session.startedAt,
      endsAt: result.session.endsAt,
      monsterCount: result.totalCount,
      teamCount: teamPlans.length,
    });
  } catch (e) {
    next(e);
  }
});

// POST /hunt/sessions/:id/cancel
// Host anuleaza un lobby pe care nu a apucat sa-l porneasca.
huntRouter.post('/sessions/:id/cancel', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { id } = req.params;
    if (!id) throw badRequest('missing_id', 'sessionId lipsa');

    const session = await prisma.huntSession.findUnique({
      where: { id },
      select: { hostId: true, status: true },
    });
    if (!session) throw notFound('session_not_found', 'Sesiune inexistenta');
    if (session.hostId !== me) throw forbidden('not_host', 'Doar host-ul poate anula');
    if (session.status !== HuntStatus.LOBBY) {
      throw conflict('cannot_cancel', 'Sesiunea nu mai e in lobby');
    }

    await prisma.huntSession.update({
      where: { id },
      data: { status: HuntStatus.CANCELLED, endedAt: new Date() },
    });
    emitHuntUpdate(id, 'cancelled');
    res.json({ cancelled: true });
  } catch (e) {
    next(e);
  }
});

// GET /hunt/sessions/:id
// Polling state. Returneaza diferit in functie de stagiu:
//   - LOBBY: lista jucatori, durata configurata, isHost, joined
//   - ACTIVE: zone+monsters ale echipei mele, scor, time remaining
//   - COMPLETED: vezi /results
huntRouter.get('/sessions/:id', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { id } = req.params;
    if (!id) throw badRequest('missing_id', 'sessionId lipsa');

    const session = await prisma.huntSession.findUnique({
      where: { id },
      include: {
        park: { select: { id: true, name: true, polygon: true } },
        host: { select: { id: true, name: true, avatar: { select: { svg: true } } } },
        lobby: {
          include: {
            user: { select: { id: true, name: true, level: true, avatar: { select: { svg: true } } } },
          },
        },
        teams: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, avatar: { select: { svg: true } } },
                },
              },
            },
          },
          orderBy: { score: 'desc' },
        },
      },
    });
    if (!session) throw notFound('session_not_found', 'Sesiune inexistenta');

    const myTeam = session.teams.find((t) => t.members.some((m) => m.userId === me));
    const inLobby = session.lobby.some((l) => l.userId === me);
    const isHost = session.hostId === me;

    if (!isHost && !inLobby && !myTeam && session.status !== HuntStatus.COMPLETED) {
      throw forbidden('not_member', 'Nu participi la aceasta sesiune');
    }

    const base = {
      sessionId: session.id,
      status: session.status,
      isHost,
      durationSec: session.durationSec,
      startedAt: session.startedAt,
      endsAt: session.endsAt,
      endedAt: session.endedAt,
      park: { id: session.park.id, name: session.park.name },
      host: {
        id: session.host.id,
        name: session.host.name,
        avatarSvg: session.host.avatar?.svg ?? null,
      },
    };

    if (session.status === HuntStatus.LOBBY) {
      res.json({
        ...base,
        lobby: session.lobby.map((l) => ({
          userId: l.userId,
          name: l.user.name,
          level: l.user.level,
          avatarSvg: l.user.avatar?.svg ?? null,
        })),
        canStart: isHost && session.lobby.length >= MIN_LOBBY_PLAYERS,
        playersNeeded: Math.max(0, MIN_LOBBY_PLAYERS - session.lobby.length),
      });
      return;
    }

    // Pentru ACTIVE/COMPLETED returnam scoreboard + zona mea (nu zonele celorlalti).
    const myTeamLeader = myTeam
      ? session.teams.find((t) => t.id === myTeam.id)?.members.find((m) => m.userId === myTeam.leaderId)
      : null;
    res.json({
      ...base,
      monsterCount: session.monsterCount,
      parkPolygon: JSON.parse(session.park.polygon),
      teams: session.teams.map((t) => ({
        id: t.id,
        name: t.name,
        nameSet: t.nameSet,
        score: t.score,
        monstersDefeated: t.monstersDefeated,
        memberCount: t.members.length,
        // Zona se trimite DOAR pentru echipa mea.
        zone: myTeam?.id === t.id ? JSON.parse(t.zone) : null,
        members: t.members.map((m) => ({
          id: m.userId,
          name: m.user.name,
          avatarSvg: m.user.avatar?.svg ?? null,
        })),
      })),
      myTeamId: myTeam?.id ?? null,
      // Cine joaca pe telefonul lui pentru echipa mea — folosit de mobile ca sa
      // arate AR + harta doar liderului, restul vad doar scoreboard.
      iAmTeamLeader: !!myTeam && myTeam.leaderId === me,
      myTeamLeader: myTeamLeader
        ? {
            id: myTeamLeader.userId,
            name: myTeamLeader.user.name,
            avatarSvg: myTeamLeader.user.avatar?.svg ?? null,
          }
        : null,
    });
  } catch (e) {
    next(e);
  }
});

// POST /hunt/sessions/:id/teams/:teamId/name
// Liderul echipei alege/schimba numele dupa Start. Pana se face, membrii vad
// "asteptam pe lider sa numeasca echipa".
const teamNameSchema = z.object({
  name: z.string().trim().min(1).max(30),
});
huntRouter.post('/sessions/:id/teams/:teamId/name', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { id, teamId } = req.params;
    if (!id || !teamId) throw badRequest('missing_id', 'id-uri lipsa');
    const { name } = teamNameSchema.parse(req.body);

    const team = await prisma.huntTeam.findUnique({
      where: { id: teamId },
      select: { id: true, sessionId: true, leaderId: true },
    });
    if (!team || team.sessionId !== id) {
      throw notFound('team_not_found', 'Echipa inexistenta');
    }
    if (team.leaderId !== me) {
      throw forbidden('leader_only', 'Doar liderul poate numi echipa');
    }

    await prisma.huntTeam.update({
      where: { id: teamId },
      data: { name, nameSet: true },
    });

    emitHuntUpdate(id, 'team_named');
    res.json({ id: teamId, name, nameSet: true });
  } catch (e) {
    next(e);
  }
});

// Pragul in metri pentru a "descoperi" un monstru (engage). Sub el AR-ul se
// poate deschide pt lupta.
const ENGAGE_DISTANCE_M = 8;

// Fereastra de fight: 90 sec de la engage pana la finalize. Daca toate
// challenge-urile NU sunt CORRECT in interval, monstrul scapa.
const FIGHT_WINDOW_MS = 90_000;

// Helper: marcheaza ESCAPED monstrii ENGAGED a caror fereastra a expirat.
// Ruleaza in interiorul finalize-ului si lazy in heartbeat — fara cron.
async function expireEngagedMonsters(sessionId: string, now: Date): Promise<void> {
  const expired = await prisma.huntMonster.findMany({
    where: {
      sessionId,
      status: MonsterStatus.ENGAGED,
      expiresAt: { lt: now },
    },
    select: { id: true },
  });
  if (expired.length === 0) return;
  await prisma.huntMonster.updateMany({
    where: { id: { in: expired.map((m) => m.id) } },
    data: { status: MonsterStatus.ESCAPED },
  });
}

// Auto-complete: daca endsAt e in trecut, marcam COMPLETED. Lazy la fiecare
// heartbeat / GET. Returneaza true daca s-a tranzitionat acum.
async function autoCompleteIfExpired(
  sessionId: string,
  endsAt: Date | null,
  status: HuntStatus,
  now: Date,
): Promise<boolean> {
  if (status !== HuntStatus.ACTIVE || !endsAt || endsAt > now) return false;
  await prisma.huntSession.update({
    where: { id: sessionId },
    data: { status: HuntStatus.COMPLETED, endedAt: now },
  });
  return true;
}

// POST /hunt/sessions/:id/heartbeat
// Mobile trimite GPS-ul curent la fiecare ~5 sec. Backend valideaza ca user-ul
// e in zona echipei lui, calculeaza warmth pentru cel mai apropiat monstru
// HIDDEN si returneaza scor + time remaining + monstri ENGAGED in echipa
// (pt UI sincronizat intre teammates).
const heartbeatSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

huntRouter.post('/sessions/:id/heartbeat', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { id } = req.params;
    if (!id) throw badRequest('missing_id', 'sessionId lipsa');
    const { lat, lng } = heartbeatSchema.parse(req.body);

    const session = await prisma.huntSession.findUnique({
      where: { id },
      include: {
        park: { select: { polygon: true } },
        teams: {
          include: {
            members: { where: { userId: me }, select: { userId: true } },
          },
        },
      },
    });
    if (!session) throw notFound('session_not_found', 'Sesiune inexistenta');

    const now = new Date();
    const justCompleted = await autoCompleteIfExpired(
      session.id,
      session.endsAt,
      session.status,
      now,
    );
    if (session.status !== HuntStatus.ACTIVE && !justCompleted) {
      throw conflict('not_active', 'Sesiunea nu e activa');
    }
    if (justCompleted) {
      res.json({ status: HuntStatus.COMPLETED, autoCompleted: true });
      return;
    }

    const myTeam = session.teams.find((t) => t.members.length > 0);
    if (!myTeam) throw forbidden('not_member', 'Nu participi la aceasta sesiune');

    // Validari fizice (warning-uri, nu erori): user in parc, in zona lui.
    const inPark = pointInPark(lat, lng, session.park.polygon);
    const myZone = JSON.parse(myTeam.zone) as Polygon | MultiPolygon;
    const inZone = pointInPark(lat, lng, JSON.stringify(myZone));

    await expireEngagedMonsters(session.id, now);

    // Cel mai apropiat monstru HIDDEN din zona echipei mele. Folosit pentru
    // sageata busola + warmth bucket. NU includem ENGAGED ca sa nu spam-uim
    // warmth-ul "very_hot" cand un monstru e deja in lupta.
    const hiddenInMyZone = await prisma.huntMonster.findMany({
      where: { sessionId: id, teamId: myTeam.id, status: MonsterStatus.HIDDEN },
      select: { id: true, lat: true, lng: true, type: true },
    });

    let nearestDist = Infinity;
    let nearestBearing: number | null = null;
    let nearestType: MonsterType | null = null;
    let nearestPos: { lat: number; lng: number } | null = null;
    for (const m of hiddenInMyZone) {
      const d = distanceMeters(lat, lng, m.lat, m.lng);
      if (d < nearestDist) {
        nearestDist = d;
        nearestBearing = bearingDegrees(lat, lng, m.lat, m.lng);
        nearestType = m.type;
        nearestPos = { lat: m.lat, lng: m.lng };
      }
    }

    const warmth = nearestDist === Infinity ? 'cold' : warmthForDistance(nearestDist);

    // Daca user-ul e in raza de engage si exista un monstru, expunem id-ul si
    // pozitia exacta (pt AR-ul mobile sa-l randeze). Asta inlocuieste un
    // endpoint /discover separat — heartbeat-ul deserveste si rolul ala.
    let revealMonster: { id: string; lat: number; lng: number; type: MonsterType } | null = null;
    if (nearestDist <= ENGAGE_DISTANCE_M) {
      const closest = hiddenInMyZone.reduce<typeof hiddenInMyZone[number] | null>((best, m) => {
        const d = distanceMeters(lat, lng, m.lat, m.lng);
        if (!best) return m;
        const bestD = distanceMeters(lat, lng, best.lat, best.lng);
        return d < bestD ? m : best;
      }, null);
      if (closest) {
        revealMonster = {
          id: closest.id,
          lat: closest.lat,
          lng: closest.lng,
          type: closest.type,
        };
      }
    }

    // Monstri ENGAGED in echipa mea — UI sincron intre teammates. Includem lat/lng
    // pentru a-i randa pe harta (sunt deja revelati prin engage).
    const engagedInMyTeam = await prisma.huntMonster.findMany({
      where: {
        sessionId: id,
        teamId: myTeam.id,
        status: MonsterStatus.ENGAGED,
      },
      select: {
        id: true,
        type: true,
        name: true,
        loreShort: true,
        lat: true,
        lng: true,
        engagedAt: true,
        expiresAt: true,
      },
    });

    res.json({
      status: HuntStatus.ACTIVE,
      timeRemainingSec: session.endsAt
        ? Math.max(0, Math.floor((session.endsAt.getTime() - now.getTime()) / 1000))
        : 0,
      inPark,
      inZone,
      warmth,
      // Bearing si type ajuta UI sa coloreze sageata si sa indice monstrul.
      // NU expunem distanta sau pozitia exacta cat warmth nu e very_hot.
      nearestBearing: warmth === 'cold' ? null : nearestBearing,
      nearestType,
      // Pozitia nearest hidden — clientul recalculeaza warmth+bearing local
      // intre heartbeat-uri ca wedge-ul sa nu fie stale. Hidden cand cold.
      nearestPosition: warmth === 'cold' ? null : nearestPos,
      revealMonster,
      engagedMonsters: engagedInMyTeam,
    });
  } catch (e) {
    next(e);
  }
});

// POST /hunt/sessions/:id/monsters/:mid/engage
// User declanseaza lupta cu un monstru cand e la <ENGAGE_DISTANCE_M. Generam
// challenge runs per teammate dupa tipul monstrului. Idempotent: re-apel
// returneaza challenge-urile existente.
const engageSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

huntRouter.post('/sessions/:id/monsters/:mid/engage', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { id, mid } = req.params;
    if (!id || !mid) throw badRequest('missing_id', 'id-uri lipsa');
    const { lat, lng } = engageSchema.parse(req.body);

    const monster = await prisma.huntMonster.findUnique({
      where: { id: mid },
      include: {
        session: { select: { id: true, status: true, endsAt: true } },
        team: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    birthDate: true,
                    // Pet-ul fiecarui membru (cu specia) pt hint live — daca
                    // domain-ul monstrului ∈ expertiseDomains, pet-ul respectiv
                    // soptesste hint subtil pentru runs.
                    pet: {
                      select: {
                        id: true,
                        name: true,
                        species: {
                          select: {
                            name: true,
                            systemHint: true,
                            tone: true,
                            catchphrases: true,
                            expertiseDomains: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!monster || monster.session.id !== id) {
      throw notFound('monster_not_found', 'Monstru inexistent');
    }
    if (monster.session.status !== HuntStatus.ACTIVE) {
      throw conflict('not_active', 'Sesiunea nu e activa');
    }
    if (!monster.team) {
      throw badRequest('monster_no_team', 'Monstru fara echipa atribuita');
    }
    // Modelul "team-leader-only-phone": doar liderul echipei (random la Start)
    // joaca efectiv. Restul copiilor sunt fizic langa el si discuta raspunsurile.
    if (monster.team.leaderId !== me) {
      throw forbidden('leader_only', 'Doar liderul echipei tale joaca pe telefonul lui');
    }
    const myMembership = monster.team.members.find((m) => m.userId === me);
    if (!myMembership) {
      throw forbidden('leader_not_in_team', 'Liderul nu e in echipa monstrului');
    }
    if (monster.status === MonsterStatus.DEFEATED || monster.status === MonsterStatus.ESCAPED) {
      throw conflict('monster_closed', 'Monstrul a fost deja rezolvat');
    }

    const dist = distanceMeters(lat, lng, monster.lat, monster.lng);
    if (dist > ENGAGE_DISTANCE_M) {
      throw badRequest('too_far', `Apropie-te (esti la ${Math.round(dist)}m)`);
    }

    // Idempotent: daca e deja ENGAGED, returnam runs existente (cu hint-uri
    // deja salvate de la prima generare — nu regeneram).
    if (monster.status === MonsterStatus.ENGAGED) {
      const existing = await prisma.huntChallengeRun.findMany({
        where: { monsterId: mid },
        include: RUN_INCLUDE,
      });
      res.json({
        monsterId: mid,
        engagedAt: monster.engagedAt,
        expiresAt: monster.expiresAt,
        runs: await Promise.all(existing.map((r) => buildRunDto(r, me))),
      });
      return;
    }

    // Generam toate challenge-urile pentru host. Numarul scade din map-ul
    // MONSTER_CHALLENGES_PER_MEMBER (acum reinterpretat ca "per monstru"):
    // green=1, yellow=2, red=3, gold=4. Echipa discuta fizic intrebarile;
    // host-ul tap-uieste raspunsul ales de grup.
    const perMonster = MONSTER_CHALLENGES_PER_MEMBER[monster.type];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + FIGHT_WINDOW_MS);

    // Party age range — intrebarile sunt potrivite oricarui copil din echipa
    // (toti discuta raspunsul cu liderul). Folosim min/max in loc de doar
    // varsta liderului ca un echipaj de 14 sa nu primeasca intrebari de 6.
    const partyAges = monster.team.members.map((m) => ageFromBirthDate(m.user.birthDate));
    const partyMin = Math.min(...partyAges);
    const partyMax = Math.max(...partyAges);

    // Domain-ul monstrului din MonsterTemplate (lookup pe slug — nu avem FK
    // relation ca sa permitem monstri seedati cu slug-uri vechi). Fallback la
    // string gol = "fara filtru de domain" daca template-ul a fost sters.
    const template = await prisma.monsterTemplate.findUnique({
      where: { slug: monster.slug },
      select: { domain: true },
    });
    const monsterDomain = template?.domain ?? '';

    // Anti-repeat: exclud challenge-urile deja folosite de echipa mea in
    // sesiunea curenta. Pool-ul scade pe masura ce echipa progreseaza.
    const usedRuns = await prisma.huntChallengeRun.findMany({
      where: { monster: { sessionId: id, teamId: monster.teamId } },
      select: { challengeId: true },
    });
    const usedIds = usedRuns.map((r) => r.challengeId);

    const hardTier = monster.type === 'red' || monster.type === 'gold';
    const baseWhere: Prisma.HuntChallengeWhereInput = {
      active: true,
      id: { notIn: usedIds },
      ageMin: { lte: partyMax },
      ageMax: { gte: partyMin },
    };

    // Strategy fallback: incercam selectia tot mai relaxata pana strangem
    // suficiente intrebari ne-repetate pentru numarul cerut de monstru.
    // 1) Match exact: domain + party age + difficulty.
    let candidates = await prisma.huntChallenge.findMany({
      where: {
        ...baseWhere,
        ...(monsterDomain ? { domain: monsterDomain } : {}),
        ...(hardTier ? { difficulty: { gte: 2 } } : {}),
      },
      select: { id: true },
    });
    // 2) Relaxez dificultatea (pastrez domain + party age).
    if (candidates.length < perMonster && monsterDomain) {
      candidates = await prisma.huntChallenge.findMany({
        where: { ...baseWhere, domain: monsterDomain },
        select: { id: true },
      });
    }
    // 3) Relaxez domain (pastrez party age + difficulty).
    if (candidates.length < perMonster) {
      candidates = await prisma.huntChallenge.findMany({
        where: {
          ...baseWhere,
          ...(hardTier ? { difficulty: { gte: 2 } } : {}),
        },
        select: { id: true },
      });
    }
    // 4) Last resort: orice intrebare activa pentru party age, chiar repetate.
    if (candidates.length === 0) {
      candidates = await prisma.huntChallenge.findMany({
        where: {
          active: true,
          ageMin: { lte: partyMax },
          ageMax: { gte: partyMin },
        },
        select: { id: true },
      });
    }
    if (candidates.length === 0) {
      throw badRequest(
        'no_challenges',
        `Nu am gasit challenge-uri pentru party age ${partyMin}-${partyMax}`,
      );
    }
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const runsToCreate: Prisma.HuntChallengeRunCreateManyInput[] = [];
    for (let i = 0; i < perMonster; i++) {
      const c = shuffled[i % shuffled.length]!;
      runsToCreate.push({ monsterId: mid, userId: me, challengeId: c.id });
    }

    await prisma.$transaction(async (tx) => {
      await tx.huntMonster.update({
        where: { id: mid },
        data: {
          status: MonsterStatus.ENGAGED,
          engagedAt: now,
          expiresAt,
        },
      });
      await tx.huntChallengeRun.createMany({
        data: runsToCreate,
        skipDuplicates: true,
      });
    });

    const runs = await prisma.huntChallengeRun.findMany({
      where: { monsterId: mid },
      include: { challenge: true },
    });

    // Hunt hint live: cautam in party un pet a carui specie are domain-ul
    // monstrului in `expertiseDomains`. Preferam pet-ul liderului daca match;
    // altfel primul match din echipa. Apel Haiku sincron cu timeout — daca
    // pica, runs raman cu petHint=null si engagement-ul continua normal.
    if (monsterDomain) {
      const matchingMembers = monster.team.members.filter((m) =>
        m.user.pet?.species.expertiseDomains.includes(monsterDomain),
      );
      if (matchingMembers.length > 0) {
        const leaderMatch = matchingMembers.find((m) => m.userId === me);
        const chosen = leaderMatch ?? matchingMembers[0]!;
        const pet = chosen.user.pet!;
        const sp = pet.species;

        const hintRuns: HintRun[] = runs.map((r) => ({
          runId: r.id,
          prompt: r.challenge.prompt,
          options: r.challenge.options ? r.challenge.options.split('|').filter(Boolean) : null,
        }));

        const hints = await generateHuntHints(
          {
            petId: pet.id,
            petName: pet.name,
            speciesName: sp.name,
            systemHint: sp.systemHint,
            tone: sp.tone,
            catchphrases: sp.catchphrases,
            childName: chosen.user.name,
          },
          monster.name,
          monsterDomain,
          hintRuns,
        );

        if (hints.length > 0) {
          await Promise.all(
            hints.map((h) =>
              prisma.huntChallengeRun.update({
                where: { id: h.runId },
                data: { petHint: h.hint, petHintPetId: pet.id },
              }),
            ),
          );
        }
      }
    }

    // Re-fetch cu pet info pt DTO complet (include petHintPet pt atribuire
    // in UI: "Buddy al lui Maria iti soptesste...").
    const enrichedRuns = await prisma.huntChallengeRun.findMany({
      where: { monsterId: mid },
      include: RUN_INCLUDE,
    });

    emitHuntUpdate(id, 'monster_engaged');
    res.json({
      monsterId: mid,
      monster: {
        type: monster.type,
        name: monster.name,
        loreShort: monster.loreShort,
      },
      engagedAt: now,
      expiresAt,
      runs: await Promise.all(enrichedRuns.map((r) => buildRunDto(r, me))),
    });
  } catch (e) {
    next(e);
  }
});

// POST /hunt/sessions/:id/monsters/:mid/runs/:runId/answer
// User submit-eaza raspunsul lui la propriul challenge run. Pentru riddle:
// Claude judging. Pentru counting: comparator numeric. Photo se va rezolva
// in faza 4 cu vision API.
const answerSchema = z.object({
  answer: z.string().trim().min(1).max(500),
});

huntRouter.post(
  '/sessions/:id/monsters/:mid/runs/:runId/answer',
  async (req, res, next) => {
    try {
      const me = req.userId!;
      const { id, mid, runId } = req.params;
      if (!id || !mid || !runId) throw badRequest('missing_id', 'id-uri lipsa');
      const { answer } = answerSchema.parse(req.body);

      const run = await prisma.huntChallengeRun.findUnique({
        where: { id: runId },
        include: {
          challenge: true,
          monster: { select: { id: true, sessionId: true, status: true, expiresAt: true } },
        },
      });
      if (!run || run.monsterId !== mid || run.monster.sessionId !== id) {
        throw notFound('run_not_found', 'Challenge inexistent');
      }
      if (run.userId !== me) throw forbidden('not_your_run', 'Nu e challenge-ul tau');
      if (run.outcome !== ChallengeOutcome.PENDING) {
        throw conflict('already_answered', 'Ai raspuns deja la acest challenge');
      }
      if (run.monster.status !== MonsterStatus.ENGAGED) {
        throw conflict('monster_not_engaged', 'Lupta nu e activa');
      }
      const now = new Date();
      if (run.monster.expiresAt && run.monster.expiresAt < now) {
        // Marcam ESCAPED inainte sa raspundem cu eroare.
        await prisma.huntMonster.update({
          where: { id: mid },
          data: { status: MonsterStatus.ESCAPED },
        });
        throw conflict('time_up', 'Monstrul a scapat — timpul s-a scurs');
      }

      let result: { correct: boolean; feedback: string };
      if (run.challenge.type === ChallengeType.mcq) {
        const opts = (run.challenge.options ?? '').split('|').filter(Boolean);
        result = judgeMcqAnswer(run.challenge.expected, opts, answer);
      } else if (run.challenge.type === ChallengeType.riddle) {
        result = await judgeRiddleAnswer(
          run.challenge.prompt,
          run.challenge.expected,
          answer,
        );
      } else if (run.challenge.type === ChallengeType.counting) {
        result = judgeCountingAnswer(run.challenge.expected, answer);
      } else {
        // photo — Phase 4. Pentru moment refuzam grupand cu eroare clara.
        throw badRequest(
          'photo_not_implemented',
          'Photo challenges urmeaza in versiunea urmatoare',
        );
      }

      await prisma.huntChallengeRun.update({
        where: { id: runId },
        data: {
          outcome: result.correct ? ChallengeOutcome.CORRECT : ChallengeOutcome.WRONG,
          answer,
          feedback: result.feedback,
          finishedAt: now,
        },
      });

      emitHuntUpdate(id, 'run_answered');
      res.json({
        correct: result.correct,
        feedback: result.feedback,
      });
    } catch (e) {
      next(e);
    }
  },
);

// POST /hunt/sessions/:id/monsters/:mid/finalize
// Cand toata echipa a raspuns la toate challenge-urile, aceasta ruta calculeaza
// outcome-ul si acorda puncte daca toate sunt CORRECT. Idempotent prin
// HuntMonsterDefeat unique pe monsterId.
huntRouter.post('/sessions/:id/monsters/:mid/finalize', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { id, mid } = req.params;
    if (!id || !mid) throw badRequest('missing_id', 'id-uri lipsa');

    const monster = await prisma.huntMonster.findUnique({
      where: { id: mid },
      include: {
        session: { select: { id: true, status: true } },
        team: {
          include: {
            members: { select: { userId: true } },
          },
        },
        runs: true,
      },
    });
    if (!monster || monster.session.id !== id) {
      throw notFound('monster_not_found', 'Monstru inexistent');
    }
    if (!monster.team) throw badRequest('no_team', 'Monstru fara echipa');
    if (!monster.team.members.some((m) => m.userId === me)) {
      throw forbidden('not_my_team', 'Nu esti in echipa monstrului');
    }
    if (monster.status === MonsterStatus.DEFEATED || monster.status === MonsterStatus.ESCAPED) {
      // Idempotent — returnam state-ul curent.
      const defeat = await prisma.huntMonsterDefeat.findUnique({ where: { monsterId: mid } });
      res.json({
        status: monster.status,
        pointsAwarded: defeat?.pointsAwarded ?? 0,
      });
      return;
    }
    if (monster.status !== MonsterStatus.ENGAGED) {
      throw conflict('monster_not_engaged', 'Lupta nu a fost pornita');
    }

    const allCorrect =
      monster.runs.length > 0 && monster.runs.every((r) => r.outcome === ChallengeOutcome.CORRECT);
    const anyDone = monster.runs.every((r) => r.outcome !== ChallengeOutcome.PENDING);
    if (!anyDone) {
      throw conflict('runs_pending', 'Mai sunt challenge-uri neraspunse');
    }

    const now = new Date();
    if (allCorrect) {
      const points = MONSTER_POINTS[monster.type];
      const durationMs = monster.engagedAt
        ? now.getTime() - monster.engagedAt.getTime()
        : 0;
      await prisma.$transaction([
        prisma.huntMonster.update({
          where: { id: mid },
          data: { status: MonsterStatus.DEFEATED },
        }),
        prisma.huntMonsterDefeat.create({
          data: {
            monsterId: mid,
            teamId: monster.team.id,
            pointsAwarded: points,
            durationMs,
          },
        }),
        prisma.huntTeam.update({
          where: { id: monster.team.id },
          data: {
            score: { increment: points },
            monstersDefeated: { increment: 1 },
          },
        }),
      ]);
      emitHuntUpdate(id, 'monster_finalized');
      res.json({
        status: MonsterStatus.DEFEATED,
        pointsAwarded: points,
        durationMs,
      });
    } else {
      await prisma.huntMonster.update({
        where: { id: mid },
        data: { status: MonsterStatus.ESCAPED },
      });
      emitHuntUpdate(id, 'monster_finalized');
      res.json({
        status: MonsterStatus.ESCAPED,
        pointsAwarded: 0,
      });
    }
  } catch (e) {
    next(e);
  }
});

// GET /hunt/sessions/:id/results
// Leaderboard final + acordare XP rank-based (idempotent prin XpTransaction).
// Acceseaza orice participant. Daca sesiunea inca e ACTIVE dar endsAt e in
// trecut, auto-completeaza.
huntRouter.get('/sessions/:id/results', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { id } = req.params;
    if (!id) throw badRequest('missing_id', 'sessionId lipsa');

    const session = await prisma.huntSession.findUnique({
      where: { id },
      include: {
        teams: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatar: { select: { svg: true } },
                    pet: {
                      select: {
                        name: true,
                        species: { select: { imagePath: true } },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: [{ score: 'desc' }, { monstersDefeated: 'desc' }],
        },
      },
    });
    if (!session) throw notFound('session_not_found', 'Sesiune inexistenta');

    const now = new Date();
    await autoCompleteIfExpired(session.id, session.endsAt, session.status, now);

    const refreshed = await prisma.huntSession.findUniqueOrThrow({
      where: { id },
      select: { status: true, startedAt: true, endedAt: true },
    });
    if (refreshed.status !== HuntStatus.COMPLETED) {
      throw conflict('not_completed', 'Sesiunea nu s-a terminat inca');
    }

    const allUserIds = session.teams.flatMap((t) => t.members.map((m) => m.userId));
    if (!allUserIds.includes(me)) {
      throw forbidden('not_member', 'Nu ai participat la aceasta sesiune');
    }

    // Acordare XP rank-based — ruleaza o singura data per (user, sessionId)
    // prin unique constraint pe XpTransaction.
    const ranks = session.teams; // deja sortate desc
    const teamRanks = new Map<string, number>();
    ranks.forEach((t, i) => teamRanks.set(t.id, i));

    const xpAwards: Array<{ userId: string; amount: number; rank: number }> = [];
    for (const team of session.teams) {
      const rank = teamRanks.get(team.id) ?? 999;
      const amount =
        rank === 0
          ? XP_REWARDS.HUNT_RANK_1
          : rank === 1
            ? XP_REWARDS.HUNT_RANK_2
            : rank === 2
              ? XP_REWARDS.HUNT_RANK_3
              : XP_REWARDS.HUNT_PARTICIPATION;
      for (const member of team.members) {
        await awardXp(
          member.userId,
          amount,
          'hunt_rank',
          id,
          `Hunt rank ${rank + 1}`,
        );
        xpAwards.push({ userId: member.userId, amount, rank: rank + 1 });
      }
    }

    res.json({
      sessionId: id,
      startedAt: refreshed.startedAt,
      endedAt: refreshed.endedAt,
      teams: await Promise.all(
        session.teams.map(async (t, idx) => ({
          rank: idx + 1,
          id: t.id,
          name: t.name,
          score: t.score,
          monstersDefeated: t.monstersDefeated,
          members: await Promise.all(
            t.members.map(async (m) => ({
              id: m.userId,
              name: m.user.name,
              avatarSvg: m.user.avatar?.svg ?? null,
              petImageUrl: m.user.pet
                ? await resolvePetImagePath(m.user.pet.species.imagePath)
                : null,
            })),
          ),
        })),
      ),
      myXp: xpAwards
        .filter((a) => a.userId === me)
        .map((a) => ({ amount: a.amount, rank: a.rank }))[0] ?? null,
    });
  } catch (e) {
    next(e);
  }
});

// Helper: build DTO pentru un challenge run. Ascundem `expected` ca user sa
// nu primeasca raspunsul in payload. Marcam `mine: true` cand runId-ul e al
// userului care intreaba.
const RUN_INCLUDE = {
  challenge: true,
  petHintPet: {
    select: {
      id: true,
      name: true,
      user: { select: { name: true } },
      species: { select: { imagePath: true } },
    },
  },
} as const satisfies Prisma.HuntChallengeRunInclude;

type RunWithChallenge = Prisma.HuntChallengeRunGetPayload<{
  include: typeof RUN_INCLUDE;
}>;

async function buildRunDto(run: RunWithChallenge, me: string) {
  // MCQ: shuffle deterministic pe runId — pozitia variantei corecte e diferita
  // la fiecare run dar consistenta intre requests pentru acelasi run, ca
  // user-ul sa nu vada lista re-aranjata daca refresh-ueste.
  let options: string[] | null = null;
  if (run.challenge.type === ChallengeType.mcq && run.challenge.options) {
    const raw = run.challenge.options.split('|').filter(Boolean);
    options = stableShuffle(raw, run.id);
  }
  // Pet hint: cand exista, returnam textul + atributia + URL semnat catre
  // imaginea speciei (rezolvat prin resolvePetImagePath — handle GCS keys,
  // absolute URLs si static paths uniform). NULL daca niciun pet din party
  // nu match-uia domain-ul monstrului.
  const petHint =
    run.petHint && run.petHintPet
      ? {
          text: run.petHint,
          petName: run.petHintPet.name,
          ownerName: run.petHintPet.user.name,
          petImageUrl: await resolvePetImagePath(run.petHintPet.species.imagePath),
        }
      : null;
  return {
    id: run.id,
    userId: run.userId,
    mine: run.userId === me,
    challenge: {
      id: run.challenge.id,
      type: run.challenge.type,
      prompt: run.challenge.prompt,
      difficulty: run.challenge.difficulty,
      options,
    },
    outcome: run.outcome,
    feedback: run.feedback,
    finishedAt: run.finishedAt,
    petHint,
  };
}

// Deterministic shuffle: hash din seed produce indici mereu aceiasi.
// Folosit ca pozitia variantei corecte la MCQ sa fie stabila per run.
function stableShuffle<T>(arr: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function ageFromBirthDate(birthDate: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return Math.max(0, age);
}

// POST /hunt/sessions/:id/end
// Force-end de host. Auto-end la timeout va fi gestionat de un cron simplu
// sau lazy la urmatorul GET (verificam endsAt < now si trecem la COMPLETED).
huntRouter.post('/sessions/:id/end', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { id } = req.params;
    if (!id) throw badRequest('missing_id', 'sessionId lipsa');

    const session = await prisma.huntSession.findUnique({
      where: { id },
      select: { hostId: true, status: true },
    });
    if (!session) throw notFound('session_not_found', 'Sesiune inexistenta');
    if (session.hostId !== me) throw forbidden('not_host', 'Doar host-ul poate opri');
    if (session.status !== HuntStatus.ACTIVE) {
      throw conflict('not_active', 'Sesiunea nu e activa');
    }

    await prisma.huntSession.update({
      where: { id },
      data: { status: HuntStatus.COMPLETED, endedAt: new Date() },
    });
    emitHuntUpdate(id, 'ended');
    res.json({ ended: true });
  } catch (e) {
    next(e);
  }
});
