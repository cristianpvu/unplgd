// Park matcher — pentru un user, gaseste top N slot-uri (park × day × hour)
// cu profil de pasiuni similar cu al lui. Similaritate = cosine intre vectorul
// de domenii al user-ului si vectorul agregat al slot-ului.
//
// Returneaza scor + label-uri ready pt UI / pet chat / notificare.

import { prisma } from '../prisma.js';
import { logger } from '../logger.js';
import {
  getParkAggregates,
  type ParkSlot,
  HOUR_BUCKETS,
  DAYS_OF_WEEK,
} from './parkAggregates.js';

const USER_DOMAIN_LOOKBACK_DAYS = 60;
const MS_PER_DAY = 86400000;

export type ParkMatch = {
  parkId: string;
  parkName: string;
  parkOsmId: string;
  dayOfWeek: number;
  dayLabel: string;
  hourBucket: string;
  hourLabel: string;
  hourStart: number;
  hourEnd: number;
  uniqueKids: number;
  similarity: number;        // 0..1, cosine
  sharedDomains: Array<{ slug: string; weight: number }>; // top 3 domenii comune
};

function userProfile(events: Array<{ domainSlug: string; amount: number }>, rootSet: Set<string>): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of events) {
    if (!rootSet.has(e.domainSlug)) continue;
    m.set(e.domainSlug, (m.get(e.domainSlug) ?? 0) + e.amount);
  }
  return m;
}

function normalize(m: Map<string, number>): Map<string, number> {
  const total = [...m.values()].reduce((s, v) => s + v, 0);
  if (total === 0) return m;
  const out = new Map<string, number>();
  for (const [k, v] of m) out.set(k, v / total);
  return out;
}

function cosineSimilarity(a: Map<string, number>, b: Record<string, number>): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const [k, v] of a) {
    magA += v * v;
    const bv = b[k];
    if (bv) dot += v * bv;
  }
  for (const v of Object.values(b)) magB += v * v;
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Top N matches pt user. Skip slot-urile parcurilor in care user-ul deja
 * frecventeaza puternic (>5 sessions) — sugeram destinatii noi, nu unde deja
 * merge. Daca user-ul nu are nicio activitate, return [].
 */
export async function getTopParkMatchesForUser(
  userId: string,
  limit: number = 3,
): Promise<ParkMatch[]> {
  const since = new Date(Date.now() - USER_DOMAIN_LOOKBACK_DAYS * MS_PER_DAY);

  const [domainEvents, rootDomains, userOwnSessions] = await Promise.all([
    prisma.domainXpTransaction.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { domainSlug: true, amount: true },
    }),
    prisma.domain.findMany({
      where: { active: true, parentSlug: null },
      select: { slug: true },
    }),
    prisma.huntSession.findMany({
      where: {
        OR: [
          { hostId: userId, status: 'COMPLETED' },
          { lobby: { some: { userId } }, status: 'COMPLETED' },
        ],
        startedAt: { gte: since, not: null },
      },
      select: { parkId: true },
    }),
  ]);

  const rootSet = new Set(rootDomains.map((d) => d.slug));
  const rawProfile = userProfile(domainEvents, rootSet);
  if (rawProfile.size === 0) {
    logger.info({ userId }, 'park_matcher.user_profile_empty');
    return [];
  }
  const normProfile = normalize(rawProfile);

  // Park-urile pe care user-ul le frecventeaza DEJA — nu vrem sa-i sugeram
  // unde merge oricum. Threshold 4 sessions / parc = "deja al lui".
  const ownParkCount = new Map<string, number>();
  for (const s of userOwnSessions) {
    ownParkCount.set(s.parkId, (ownParkCount.get(s.parkId) ?? 0) + 1);
  }
  const ownParks = new Set([...ownParkCount.entries()].filter(([, c]) => c >= 4).map(([id]) => id));

  const aggregates = await getParkAggregates();
  if (aggregates.slots.length === 0) return [];

  // Scoreaza fiecare slot, filtreaza, sorteaza, returneaza top N.
  const scored = aggregates.slots
    .filter((slot) => !ownParks.has(slot.parkId)) // sare park-urile deja frecventate
    .map((slot) => ({
      slot,
      similarity: cosineSimilarity(normProfile, slot.domainProfile),
    }))
    .filter((x) => x.similarity > 0.1) // sub 0.1 e zgomot
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return scored.map(({ slot, similarity }) => buildMatch(slot, normProfile, similarity));
}

function buildMatch(
  slot: ParkSlot,
  userProfile: Map<string, number>,
  similarity: number,
): ParkMatch {
  // Top 3 domenii comune — produsul ponderilor user × slot, descrescator.
  const overlap = new Map<string, number>();
  for (const [d, uw] of userProfile) {
    const sw = slot.domainProfile[d] ?? 0;
    if (sw > 0) overlap.set(d, uw * sw);
  }
  const sharedDomains = [...overlap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([slug, weight]) => ({ slug, weight }));

  const bucket = HOUR_BUCKETS.find((b) => b.id === slot.hourBucket);
  const day = DAYS_OF_WEEK.find((d) => d.id === slot.dayOfWeek);

  return {
    parkId: slot.parkId,
    parkName: slot.parkName,
    parkOsmId: slot.parkOsmId,
    dayOfWeek: slot.dayOfWeek,
    dayLabel: day?.label ?? slot.dayLabel,
    hourBucket: slot.hourBucket,
    hourLabel: bucket?.label ?? slot.hourLabel,
    hourStart: bucket?.start ?? 0,
    hourEnd: bucket?.end ?? 0,
    uniqueKids: slot.uniqueKids,
    similarity,
    sharedDomains,
  };
}
