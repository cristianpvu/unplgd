/**
 * Script test E2E pentru hunt — atinge direct DB + Prisma, fara API.
 * Ruleaza din interiorul containerului backend (are .env + acces DB).
 *
 * Ce face:
 *   1. Identifica user-ul host dupa email (din arg sau HOST_EMAIL)
 *   2. Creeaza 3 useri demo (idempotent — refoloseste daca exista)
 *   3. Trimite friendships ACCEPTED reciprocii intre host si demo
 *   4. Identifica sau cache-uieste un parc OSM langa coords date
 *   5. Anuleaza orice sesiune host activa anterior
 *   6. Creeaza sesiune ACTIVE: split zone, spawn monsters, totul atomic
 *   7. Printeaza sessionId + lista de monstri (lat/lng + tip + nume)
 *
 * Usage (in container, dupa rebuild):
 *   docker exec -it unplgd_backend node dist/scripts/test-hunt.js \
 *     office@dinedroid.com 44.4360 26.0935
 */

import { hash } from 'bcryptjs';
import { HuntStatus } from '@prisma/client';
import type { Polygon, MultiPolygon } from 'geojson';
import { prisma } from '../lib/prisma.js';
import { getParksNear } from '../lib/hunt/overpass.js';
import { splitPolygonIntoZones, zoneAreaSqm } from '../lib/hunt/zones.js';
import { assignTeamsRandomly } from '../lib/hunt/teamAssign.js';
import { generateSpawns } from '../lib/hunt/spawn.js';

const args = process.argv.slice(2);
const HOST_EMAIL = args[0] ?? process.env.HOST_EMAIL;
const LAT = Number(args[1] ?? process.env.LAT);
const LNG = Number(args[2] ?? process.env.LNG);
const DURATION = Number(process.env.DURATION ?? 1800);
const DEMO_COUNT = Number(process.env.DEMO_COUNT ?? 3);
const DEMO_PASSWORD_PLAIN = 'TestHunt!1234';

if (!HOST_EMAIL || !Number.isFinite(LAT) || !Number.isFinite(LNG)) {
  console.error('Usage: tsx scripts/test-hunt.ts <hostEmail> <lat> <lng>');
  console.error('Example: tsx scripts/test-hunt.ts office@dinedroid.com 44.4360 26.0935');
  process.exit(1);
}

async function ensureDemoUser(i: number): Promise<{ id: string; name: string }> {
  const email = `hunt-demo-${i}@unplgd.test`;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { id: existing.id, name: existing.name };

  const passwordHash = await hash(DEMO_PASSWORD_PLAIN, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: `DemoCopil ${i + 1}`,
      passwordHash,
      birthDate: new Date('2014-01-01'),
    },
  });
  return { id: user.id, name: user.name };
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

async function main() {
  console.log(`Host: ${HOST_EMAIL}`);
  console.log(`Coords: ${LAT}, ${LNG}\n`);

  // 1. Host.
  const host = await prisma.user.findUnique({ where: { email: HOST_EMAIL } });
  if (!host) throw new Error(`User ${HOST_EMAIL} nu exista in DB. Inregistreaza-te in app intai.`);
  console.log(`[1/6] Host: ${host.name} (${host.id})`);

  // 2. Demo users.
  console.log(`\n[2/6] Inregistrez ${DEMO_COUNT} useri demo...`);
  const demos: { id: string; name: string }[] = [];
  for (let i = 0; i < DEMO_COUNT; i++) {
    const u = await ensureDemoUser(i);
    demos.push(u);
    console.log(`  ${u.name} (${u.id})`);
  }

  // 3. Friendships reciprocii.
  console.log('\n[3/6] Adaug prietenii...');
  for (const d of demos) {
    await ensureFriendship(host.id, d.id);
  }
  console.log('  done');

  // 4. Park.
  console.log('\n[4/6] Identific parc...');
  const parks = await getParksNear(LAT, LNG);
  if (parks.length === 0) {
    throw new Error('Niciun parc langa coordonate. Schimba LAT/LNG.');
  }
  const park = parks[0]!;
  console.log(`  ${park.name} (${park.id}) la ${Math.round(park.distanceM)}m`);

  // 5. Anulam sesiuni anterioare ale host-ului.
  console.log('\n[5/6] Curat sesiuni vechi...');
  const cancelled = await prisma.huntSession.updateMany({
    where: {
      hostId: host.id,
      status: { in: [HuntStatus.LOBBY, HuntStatus.ACTIVE] },
    },
    data: { status: HuntStatus.CANCELLED, endedAt: new Date() },
  });
  console.log(`  ${cancelled.count} sesiuni anulate`);

  // 6. Creeaza sesiune ACTIVE direct (skip lobby).
  console.log('\n[6/6] Creez sesiune ACTIVE...');
  const allMemberIds = [host.id, ...demos.map((d) => d.id)];
  const teamPlans = assignTeamsRandomly(allMemberIds);
  const parkPolygon = JSON.parse(park.polygon) as Polygon | MultiPolygon;
  const zones = splitPolygonIntoZones(parkPolygon, teamPlans.length);

  const now = new Date();
  const endsAt = new Date(now.getTime() + DURATION * 1000);

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.huntSession.create({
      data: {
        hostId: host.id,
        parkId: park.id,
        status: HuntStatus.ACTIVE,
        durationSec: DURATION,
        startedAt: now,
        endsAt,
      },
    });

    const createdTeams: { id: string; zone: Polygon | MultiPolygon }[] = [];
    for (let i = 0; i < teamPlans.length; i++) {
      const plan = teamPlans[i]!;
      const zone = zones[i]!;
      const team = await tx.huntTeam.create({
        data: {
          sessionId: created.id,
          name: plan.name,
          zone: JSON.stringify(zone),
          zoneArea: zoneAreaSqm(zone),
          members: { create: plan.memberIds.map((userId) => ({ userId })) },
        },
      });
      createdTeams.push({ id: team.id, zone });
    }

    const { spawns, totalCount } = generateSpawns(createdTeams);
    for (const sp of spawns) {
      if (sp.monsters.length === 0) continue;
      await tx.huntMonster.createMany({
        data: sp.monsters.map((m) => ({
          sessionId: created.id,
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

    return { session: created, totalCount };
  });

  console.log(`  sessionId=${session.session.id}`);
  console.log(`  ${teamPlans.length} echipe, ${session.totalCount} monstri`);
  console.log(`  ends at: ${endsAt.toISOString()}`);

  // Lista monstri din echipa host-ului.
  const myTeam = await prisma.huntTeam.findFirst({
    where: { sessionId: session.session.id, members: { some: { userId: host.id } } },
    include: { monsters: { orderBy: { type: 'desc' } } },
  });

  console.log(`\n=== MONSTRI ECHIPA TA (${myTeam?.name}) ===`);
  console.table(
    myTeam?.monsters.map((m) => ({
      type: m.type,
      name: m.name,
      lat: m.lat.toFixed(6),
      lng: m.lng.toFixed(6),
    })) ?? [],
  );

  console.log('\n=== READY ===');
  console.log(`Pe device:`);
  console.log(`  1. Deschide app → Vanatoare in parc → vei vedea sesiunea ACTIVE`);
  console.log(`  2. Mock GPS la unul din monstri (lat,lng de mai sus)`);
  console.log(`  3. Heartbeat-ul te aduce automat la AR encounter`);
}

main()
  .catch((err) => {
    console.error('\nFAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
