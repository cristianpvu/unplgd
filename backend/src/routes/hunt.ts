import { Router } from 'express';
import { z } from 'zod';
import type { Polygon, MultiPolygon } from 'geojson';
import { FriendshipStatus, HuntStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { getParksNear, pointInPark } from '../lib/hunt/overpass.js';
import { splitPolygonIntoZones, zoneAreaSqm } from '../lib/hunt/zones.js';
import { assignTeamsRandomly } from '../lib/hunt/teamAssign.js';
import { generateSpawns } from '../lib/hunt/spawn.js';
import { resolveTokens } from '../lib/bleToken.js';

export const huntRouter = Router();
huntRouter.use(requireAuth);

// Numar minim de jucatori in lobby ca host sa poata apasa start. 4 = 2 echipe
// minim, conditie pentru competitivitate.
const MIN_LOBBY_PLAYERS = 4;

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

    const result = await prisma.$transaction(async (tx) => {
      // Cream echipele cu zona si membri.
      const createdTeams: { id: string; zone: Polygon | MultiPolygon }[] = [];
      for (let i = 0; i < teamPlans.length; i++) {
        const plan = teamPlans[i]!;
        const zone = zones[i]!;
        const team = await tx.huntTeam.create({
          data: {
            sessionId: id,
            name: plan.name,
            zone: JSON.stringify(zone),
            zoneArea: zoneAreaSqm(zone),
            members: { create: plan.memberIds.map((userId) => ({ userId })) },
          },
        });
        createdTeams.push({ id: team.id, zone });
      }

      const { spawns, totalCount } = generateSpawns(createdTeams);

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
    res.json({
      ...base,
      monsterCount: session.monsterCount,
      teams: session.teams.map((t) => ({
        id: t.id,
        name: t.name,
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
    });
  } catch (e) {
    next(e);
  }
});

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
    res.json({ ended: true });
  } catch (e) {
    next(e);
  }
});
