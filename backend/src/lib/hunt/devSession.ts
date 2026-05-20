import { hash } from 'bcryptjs';
import { HuntStatus } from '@prisma/client';
import type { Polygon, MultiPolygon } from 'geojson';
import { prisma } from '../prisma.js';
import { splitPolygonIntoZones, zoneAreaSqm } from './zones.js';
import { assignTeamsRandomly } from './teamAssign.js';
import { generateSpawns, loadActiveTemplates } from './spawn.js';

const DEMO_PASSWORD_PLAIN = 'TestHunt!1234';
const DEFAULT_DEMO_COUNT = 3;
const DEFAULT_DURATION_SEC = 1800;

async function ensureDemoUser(i: number): Promise<{ id: string }> {
  const email = `hunt-demo-${i}@unplgd.test`;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { id: existing.id };
  const passwordHash = await hash(DEMO_PASSWORD_PLAIN, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: `DemoCopil ${i + 1}`,
      passwordHash,
      birthDate: new Date('2014-01-01'),
    },
  });
  return { id: user.id };
}

async function ensureFriendship(hostId: string, demoId: string): Promise<void> {
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: hostId, receiverId: demoId },
        { requesterId: demoId, receiverId: hostId },
      ],
    },
  });
  if (existing) {
    if (existing.status !== 'ACCEPTED') {
      await prisma.friendship.update({
        where: { id: existing.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
    }
    return;
  }
  await prisma.friendship.create({
    data: {
      requesterId: hostId,
      receiverId: demoId,
      status: 'ACCEPTED',
      connectedVia: 'manual',
      acceptedAt: new Date(),
    },
  });
}

// Creeaza un parc fictiv 50x50m centrat pe (lat, lng). Idempotent prin osmId
// stable bazat pe coords rotunjite — re-apel cu aceleasi coords actualizeaza
// in loc sa duplique.
async function ensureFakeParkHere(
  lat: number,
  lng: number,
): Promise<{ id: string; polygon: string }> {
  const osmId = `dev/here/${lat.toFixed(5)}_${lng.toFixed(5)}`;
  const dLat = 25 / 111_000;
  const dLng = 25 / (111_000 * Math.cos((lat * Math.PI) / 180));
  const minLat = lat - dLat;
  const maxLat = lat + dLat;
  const minLng = lng - dLng;
  const maxLng = lng + dLng;
  const polygon = {
    type: 'Polygon' as const,
    coordinates: [
      [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ],
    ],
  };
  const polygonStr = JSON.stringify(polygon);
  const areaSqm = 50 * 50;
  const park = await prisma.park.upsert({
    where: { osmId },
    create: {
      osmId,
      name: 'Test Park (la tine)',
      polygon: polygonStr,
      bboxMinLat: minLat,
      bboxMaxLat: maxLat,
      bboxMinLng: minLng,
      bboxMaxLng: maxLng,
      areaSqm,
      city: 'dev',
    },
    update: {
      polygon: polygonStr,
      bboxMinLat: minLat,
      bboxMaxLat: maxLat,
      bboxMinLng: minLng,
      bboxMaxLng: maxLng,
      areaSqm,
      lastFetchedAt: new Date(),
    },
  });
  return { id: park.id, polygon: park.polygon };
}

export type DevSessionResult = {
  sessionId: string;
  parkName: string;
  monsterCount: number;
  teamCount: number;
  endsAt: Date;
};

// Creeaza o sesiune ACTIVE de test cu parc fictiv + demo users + monstri
// spawn-ati la 4-13m de coords date. Idempotent in sensul ca anuleaza orice
// sesiune ACTIVE/LOBBY anterioara a host-ului inainte sa porneasca una noua.
export async function createDevHereSession(opts: {
  hostId: string;
  lat: number;
  lng: number;
  durationSec?: number;
  demoCount?: number;
}): Promise<DevSessionResult> {
  const durationSec = opts.durationSec ?? DEFAULT_DURATION_SEC;
  const demoCount = opts.demoCount ?? DEFAULT_DEMO_COUNT;

  // Demo users + friendships idempotent.
  const demos: { id: string }[] = [];
  for (let i = 0; i < demoCount; i++) {
    demos.push(await ensureDemoUser(i));
  }
  for (const d of demos) {
    await ensureFriendship(opts.hostId, d.id);
  }

  // Parc fictiv.
  const park = await ensureFakeParkHere(opts.lat, opts.lng);

  // Cancel sesiuni anterioare ale host-ului.
  await prisma.huntSession.updateMany({
    where: {
      hostId: opts.hostId,
      status: { in: [HuntStatus.LOBBY, HuntStatus.ACTIVE] },
    },
    data: { status: HuntStatus.CANCELLED, endedAt: new Date() },
  });

  // Sesiune ACTIVE.
  const allMemberIds = [opts.hostId, ...demos.map((d) => d.id)];
  const teamPlans = assignTeamsRandomly(allMemberIds);
  const parkPolygon = JSON.parse(park.polygon) as Polygon | MultiPolygon;
  const zones = splitPolygonIntoZones(parkPolygon, teamPlans.length);
  const now = new Date();
  const endsAt = new Date(now.getTime() + durationSec * 1000);

  const templatesByTier = await loadActiveTemplates(prisma);

  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.huntSession.create({
      data: {
        hostId: opts.hostId,
        parkId: park.id,
        status: HuntStatus.ACTIVE,
        durationSec,
        startedAt: now,
        endsAt,
      },
    });

    const createdTeams: { id: string; zone: Polygon | MultiPolygon; hasHost: boolean }[] = [];
    for (let i = 0; i < teamPlans.length; i++) {
      const plan = teamPlans[i]!;
      const zone = zones[i]!;
      // Dev mode: forteaza host-ul ca lider in echipa lui (sa joace pe propriul
      // telefon). In alte echipe, alegem un demo random — n-are importanta in
      // dev oricum, demo-ii sunt boti.
      const isHostTeam = plan.memberIds.includes(opts.hostId);
      const leaderId = isHostTeam
        ? opts.hostId
        : plan.memberIds[Math.floor(Math.random() * plan.memberIds.length)]!;
      const team = await tx.huntTeam.create({
        data: {
          sessionId: session.id,
          name: plan.name,
          leaderId,
          zone: JSON.stringify(zone),
          zoneArea: zoneAreaSqm(zone),
          members: { create: plan.memberIds.map((userId) => ({ userId })) },
        },
      });
      createdTeams.push({ id: team.id, zone, hasHost: isHostTeam });
    }

    const { spawns, totalCount } = generateSpawns(createdTeams, templatesByTier);
    for (const sp of spawns) {
      if (sp.monsters.length === 0) continue;
      const team = createdTeams.find((t) => t.id === sp.teamId);
      // Pentru echipa host-ului: rearanjam monstrii in cerc concentric la
      // 4-13m ca AR-ul sa porneasca imediat la primul heartbeat.
      const positioned = sp.monsters.map((m, idx) => {
        if (team?.hasHost) {
          const distM = 4 + (idx % 4) * 3;
          const angle = (idx / sp.monsters.length) * 2 * Math.PI;
          const dLat = (distM * Math.cos(angle)) / 111_000;
          const dLng =
            (distM * Math.sin(angle)) / (111_000 * Math.cos((opts.lat * Math.PI) / 180));
          return { ...m, lat: opts.lat + dLat, lng: opts.lng + dLng };
        }
        return m;
      });
      await tx.huntMonster.createMany({
        data: positioned.map((m) => ({
          sessionId: session.id,
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

    return { sessionId: session.id, totalCount };
  });

  return {
    sessionId: result.sessionId,
    parkName: 'Test Park (la tine)',
    monsterCount: result.totalCount,
    teamCount: teamPlans.length,
    endsAt,
  };
}
