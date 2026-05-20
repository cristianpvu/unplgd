import type { Polygon, MultiPolygon } from 'geojson';
import type { MonsterType, PrismaClient } from '@prisma/client';
import { randomPointsInPolygon, zoneAreaSqm } from './zones.js';

type AnyPolygon = Polygon | MultiPolygon;

// Numar de monstri per zona scaleaza cu marimea — 1 monstru la fiecare 800 m^2,
// cu min 5 si max 15 ca sa pastram densitatea jucabila.
function monsterCountForZone(areaSqm: number): number {
  return Math.max(5, Math.min(15, Math.floor(areaSqm / 800)));
}

// Distributie tipuri ordinare pe sesiune: 60% verde / 30% galben / 10% rosu.
// Goldul se aloca SEPARAT — exact 1 per sesiune (competitie pentru el).
function distributeTypes(count: number): MonsterType[] {
  const greens = Math.floor(count * 0.6);
  const yellows = Math.floor(count * 0.3);
  const reds = count - greens - yellows;
  const types: MonsterType[] = [];
  for (let i = 0; i < greens; i++) types.push('green');
  for (let i = 0; i < yellows; i++) types.push('yellow');
  for (let i = 0; i < reds; i++) types.push('red');
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = types[i]!;
    types[i] = types[j]!;
    types[j] = tmp;
  }
  return types;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// Subset al MonsterTemplate necesar la spawn. Caller-ul incarca templates-urile
// inainte de tranzactie si le transmite — evitam DB-call inauntru.
export type SpawnTemplate = {
  slug: string;
  name: string;
  loreShort: string;
  tier: MonsterType;
};

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

// Genereaza spawn-uri pentru toata sesiunea. Pentru fiecare echipa pune un
// numar de monstri ordinari in zona ei; o singura echipa (aleasa random)
// primeste si goldul. Template-urile sunt grupate pe tier — pentru un slot
// "green" picam random un MonsterTemplate cu tier=green din pool.
export function generateSpawns(
  teams: Array<{ id: string; zone: AnyPolygon }>,
  templates: Record<MonsterType, SpawnTemplate[]>,
): { spawns: SpawnPlan[]; totalCount: number } {
  if (templates.gold.length === 0) {
    throw new Error('Niciun MonsterTemplate activ pentru tier gold');
  }
  for (const t of ['green', 'yellow', 'red'] as const) {
    if (templates[t].length === 0) {
      throw new Error(`Niciun MonsterTemplate activ pentru tier ${t}`);
    }
  }

  const spawns: SpawnPlan[] = [];
  let totalCount = 0;

  const goldTeamIdx = Math.floor(Math.random() * teams.length);
  const goldTpl = pickRandom(templates.gold);

  for (let ti = 0; ti < teams.length; ti++) {
    const team = teams[ti]!;
    const area = zoneAreaSqm(team.zone);
    const baseCount = monsterCountForZone(area);
    const types = distributeTypes(baseCount);
    const positions = randomPointsInPolygon(team.zone, baseCount + (ti === goldTeamIdx ? 1 : 0));

    const monsters: SpawnPlan['monsters'] = [];
    for (let i = 0; i < types.length; i++) {
      const pos = positions[i];
      const type = types[i];
      if (!pos || !type) continue;
      const tpl = pickRandom(templates[type]);
      monsters.push({
        type,
        slug: tpl.slug,
        name: tpl.name,
        loreShort: tpl.loreShort,
        lat: pos.lat,
        lng: pos.lng,
      });
    }

    if (ti === goldTeamIdx) {
      const pos = positions[positions.length - 1];
      if (pos) {
        monsters.push({
          type: 'gold',
          slug: goldTpl.slug,
          name: goldTpl.name,
          loreShort: goldTpl.loreShort,
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

// Helper: incarca template-urile active grupate pe tier. Folosit de toti
// callers care apeleaza generateSpawns (hunt:start handler, devSession,
// test-hunt script).
export async function loadActiveTemplates(
  prismaClient: PrismaClient,
): Promise<Record<MonsterType, SpawnTemplate[]>> {
  const all = await prismaClient.monsterTemplate.findMany({
    where: { active: true },
    select: { slug: true, name: true, loreShort: true, tier: true },
  });
  return {
    green: all.filter((t) => t.tier === 'green'),
    yellow: all.filter((t) => t.tier === 'yellow'),
    red: all.filter((t) => t.tier === 'red'),
    gold: all.filter((t) => t.tier === 'gold'),
  };
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
