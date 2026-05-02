import type { Polygon, MultiPolygon } from 'geojson';
import type { MonsterType } from '@prisma/client';
import { randomPointsInPolygon, zoneAreaSqm } from './zones.js';
import { pickGenericMonsters, pickGoldMonster } from './monsterPool.js';

type AnyPolygon = Polygon | MultiPolygon;

// Numar de monstri per zona scaleaza cu marimea — 1 monstru la fiecare 800 m^2,
// cu min 5 si max 15 ca sa pastram densitatea jucabila.
function monsterCountForZone(areaSqm: number): number {
  return Math.max(5, Math.min(15, Math.floor(areaSqm / 800)));
}

// Distributie tipuri pe sesiune: 60% verde / 30% galben / 10% rosu pentru
// rate of return decision. Goldul se aloca SEPARAT — exact 1 per sesiune,
// indiferent de numar de echipe (compeitie pentru el).
function distributeTypes(count: number): MonsterType[] {
  const greens = Math.floor(count * 0.6);
  const yellows = Math.floor(count * 0.3);
  const reds = count - greens - yellows;
  const types: MonsterType[] = [];
  for (let i = 0; i < greens; i++) types.push('green');
  for (let i = 0; i < yellows; i++) types.push('yellow');
  for (let i = 0; i < reds; i++) types.push('red');
  // Shuffle ca distributia spatiala sa nu fie predictibila.
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = types[i]!;
    types[i] = types[j]!;
    types[j] = tmp;
  }
  return types;
}

export type SpawnPlan = {
  teamId: string;
  monsters: Array<{
    type: MonsterType;
    slug: string;
    name: string;
    loreShort: string;
    lat: number;
    lng: number;
  }>;
};

// Genereaza spawn-uri pentru o sesiune intreaga. Pentru fiecare echipa,
// genereaza N monstri normali in zona ei. Goldul se atribuie uneia dintre
// echipe random (echitabil — toate au sansa la el de la inceput).
export function generateSpawns(
  teams: Array<{ id: string; zone: AnyPolygon }>,
): { spawns: SpawnPlan[]; totalCount: number } {
  const spawns: SpawnPlan[] = [];
  let totalCount = 0;

  // Decidem care echipa primeste goldul.
  const goldTeamIdx = Math.floor(Math.random() * teams.length);
  const goldMonster = pickGoldMonster();

  for (let ti = 0; ti < teams.length; ti++) {
    const team = teams[ti]!;
    const area = zoneAreaSqm(team.zone);
    const baseCount = monsterCountForZone(area);
    const types = distributeTypes(baseCount);
    const positions = randomPointsInPolygon(team.zone, baseCount + (ti === goldTeamIdx ? 1 : 0));

    const pool = pickGenericMonsters(types.length);
    const monsters: SpawnPlan['monsters'] = [];

    for (let i = 0; i < types.length; i++) {
      const pos = positions[i];
      const meta = pool[i];
      const type = types[i];
      if (!pos || !meta || !type) continue;
      monsters.push({
        type,
        slug: meta.slug,
        name: meta.name,
        loreShort: meta.loreShort,
        lat: pos.lat,
        lng: pos.lng,
      });
    }

    // Adaugam goldul daca echipa asta a fost aleasa.
    if (ti === goldTeamIdx) {
      const pos = positions[positions.length - 1];
      if (pos) {
        monsters.push({
          type: 'gold',
          slug: goldMonster.slug,
          name: goldMonster.name,
          loreShort: goldMonster.loreShort,
          lat: pos.lat,
          lng: pos.lng,
        });
      }
    }

    spawns.push({ teamId: team.id, monsters });
    totalCount += monsters.length;
  }

  return { spawns, totalCount };
}

// Mapping public pentru puncte per tip — folosit la finalize si la UI.
export const MONSTER_POINTS: Record<MonsterType, number> = {
  green: 50,
  yellow: 150,
  red: 400,
  gold: 1000,
};

// Mapping public pentru numar de challenge-uri per teammate.
export const MONSTER_CHALLENGES_PER_MEMBER: Record<MonsterType, number> = {
  green: 1,
  yellow: 2,
  red: 3,
  gold: 1, // 1 dificil per teammate
};
