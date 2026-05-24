// Park aggregation — pentru fiecare (parkId, dayOfWeek, hourBucket), calculam:
//   - sessionCount: cate hunt sessions au avut loc in ultimele LOOKBACK_DAYS
//   - uniqueKids: cati useri distincti au participat
//   - aggregateProfile: profil de domenii agregat al participantilor (normalizat)
//
// Aceste agregari sunt SURSA de adevar pentru sugestii "vino in parc X
// sambata dimineata". User-ul target are propriul profil → calculam similaritate
// (cosine) cu fiecare slot → top 1-3 e ce-i sugeram.
//
// Cache: 24h in Redis (cheia globala, nu per user — agregarile sunt globale).
// Cron-ul nostru (sau on-demand) recalculeaza la trecerea peste 24h.

import { prisma } from '../prisma.js';
import { redis } from '../redis.js';
import { logger } from '../logger.js';

const CACHE_TTL_SEC = 24 * 3600;
const CACHE_KEY = 'social:park-aggregates:v1';
const LOOKBACK_DAYS = 60;
const MIN_KIDS_PER_SLOT = 5; // sub asta nu sugeram slotul (sa nu zicem "vino pt 2 copii")

// Buckete orare — 4 ferestre acopera tot ce conteaza pt outdoor games.
// Hunt-urile dureaza 15-45min, asa ca bucket-ul de 3h prinde majoritatea.
export const HOUR_BUCKETS = [
  { id: 'morning', label: 'dimineata', start: 9, end: 12 },
  { id: 'noon', label: 'amiaza', start: 12, end: 15 },
  { id: 'afternoon', label: 'dupa-amiaza', start: 15, end: 18 },
  { id: 'evening', label: 'seara', start: 18, end: 21 },
] as const;
export type HourBucketId = (typeof HOUR_BUCKETS)[number]['id'];

export const DAYS_OF_WEEK = [
  { id: 0, label: 'duminica' },
  { id: 1, label: 'luni' },
  { id: 2, label: 'marti' },
  { id: 3, label: 'miercuri' },
  { id: 4, label: 'joi' },
  { id: 5, label: 'vineri' },
  { id: 6, label: 'sambata' },
] as const;

function bucketFor(hour: number): HourBucketId | null {
  for (const b of HOUR_BUCKETS) {
    if (hour >= b.start && hour < b.end) return b.id;
  }
  return null;
}

export type ParkSlot = {
  parkId: string;
  parkName: string;
  parkOsmId: string;
  dayOfWeek: number;        // 0-6 (duminica-sambata)
  dayLabel: string;
  hourBucket: HourBucketId;
  hourLabel: string;
  sessionCount: number;
  uniqueKids: number;
  // domain slug → pondere normalizata (suma = 1.0 daca exista activitate).
  // Profilul e calculat din scorurile domeniilor agregate ale copiilor care
  // au venit acolo, ponderat de numarul lor de sessions in slot.
  domainProfile: Record<string, number>;
};

export type ParkAggregatesPayload = {
  generatedAt: string;
  lookbackDays: number;
  slots: ParkSlot[];
};

/**
 * Computeaza agregarile pe TOATE slot-urile (park, day, hour). Operatie
 * scumpa — sa ruleze la cron daily, NU per-request. Cache 24h in Redis.
 *
 * Returneaza din cache daca exista si nu `forceFresh`.
 */
export async function getParkAggregates(
  opts: { forceFresh?: boolean } = {},
): Promise<ParkAggregatesPayload> {
  if (!opts.forceFresh) {
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) return JSON.parse(cached) as ParkAggregatesPayload;
    } catch (err) {
      logger.warn({ err }, 'park_aggregates.cache_read_failed');
    }
  }

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600_000);

  // Cele mai recente hunt sessions completate, cu participantii din lobby
  // (cei care au intrat efectiv, nu doar host-ul).
  const sessions = await prisma.huntSession.findMany({
    where: {
      status: 'COMPLETED',
      startedAt: { gte: since, not: null },
    },
    include: {
      park: { select: { id: true, name: true, osmId: true } },
      lobby: { select: { userId: true } },
    },
  });

  // Acumulator: cheia "parkId|day|hour" → { sessionCount, uniqueKidIds: Set, parkInfo }
  type Acc = {
    parkId: string;
    parkName: string;
    parkOsmId: string;
    dayOfWeek: number;
    hourBucket: HourBucketId;
    sessionCount: number;
    uniqueKidIds: Set<string>;
  };
  const acc = new Map<string, Acc>();

  for (const s of sessions) {
    if (!s.startedAt) continue;
    const d = new Date(s.startedAt);
    const dayOfWeek = d.getDay();
    const hourBucket = bucketFor(d.getHours());
    if (hourBucket === null) continue; // in afara ferestrelor (noapte, devreme)

    const key = `${s.parkId}|${dayOfWeek}|${hourBucket}`;
    let entry = acc.get(key);
    if (!entry) {
      entry = {
        parkId: s.parkId,
        parkName: s.park.name,
        parkOsmId: s.park.osmId,
        dayOfWeek,
        hourBucket,
        sessionCount: 0,
        uniqueKidIds: new Set(),
      };
      acc.set(key, entry);
    }
    entry.sessionCount += 1;
    for (const m of s.lobby) entry.uniqueKidIds.add(m.userId);
    // Host-ul nu apare neaparat in lobby (depinde de schema) — adaugam si pe el.
    entry.uniqueKidIds.add(s.hostId);
  }

  // Pentru fiecare slot cu suficienti copii, calculam profilul agregat de
  // domenii. Strangem TOATE userId-urile distincte pe slot si tragem un
  // singur query SUM groupBy peste DomainXpTransaction.
  const eligible = [...acc.values()].filter(
    (a) => a.uniqueKidIds.size >= MIN_KIDS_PER_SLOT,
  );

  // Optimizare: un singur query pe TOTI userii din slot-urile eligible,
  // apoi aggregare in JS pe slot-uri.
  const allUserIds = new Set<string>();
  for (const a of eligible) for (const u of a.uniqueKidIds) allUserIds.add(u);

  if (allUserIds.size === 0) {
    const payload: ParkAggregatesPayload = {
      generatedAt: new Date().toISOString(),
      lookbackDays: LOOKBACK_DAYS,
      slots: [],
    };
    try {
      await redis.set(CACHE_KEY, JSON.stringify(payload), 'EX', CACHE_TTL_SEC);
    } catch (err) {
      logger.warn({ err }, 'park_aggregates.cache_write_failed');
    }
    return payload;
  }

  // Filtru: doar la radacini ca lista de domenii sa fie scurta + interpretabila.
  const rootDomains = await prisma.domain.findMany({
    where: { active: true, parentSlug: null },
    select: { slug: true },
  });
  const rootSet = new Set(rootDomains.map((d) => d.slug));

  const domainEvents = await prisma.domainXpTransaction.findMany({
    where: {
      userId: { in: [...allUserIds] },
      createdAt: { gte: since },
    },
    select: { userId: true, domainSlug: true, amount: true },
  });

  // Per user → suma scoruri pe domenii (root-only).
  const userDomainScore = new Map<string, Map<string, number>>();
  for (const e of domainEvents) {
    if (!rootSet.has(e.domainSlug)) continue;
    let u = userDomainScore.get(e.userId);
    if (!u) {
      u = new Map();
      userDomainScore.set(e.userId, u);
    }
    u.set(e.domainSlug, (u.get(e.domainSlug) ?? 0) + e.amount);
  }

  const slots: ParkSlot[] = eligible.map((a) => {
    // Agregat per slot: sumam scoruri per domeniu peste toti userii.
    const slotDomain = new Map<string, number>();
    for (const userId of a.uniqueKidIds) {
      const u = userDomainScore.get(userId);
      if (!u) continue;
      for (const [d, v] of u) slotDomain.set(d, (slotDomain.get(d) ?? 0) + v);
    }
    // Normalizam la suma 1.0.
    const total = [...slotDomain.values()].reduce((s, v) => s + v, 0);
    const profile: Record<string, number> = {};
    if (total > 0) {
      for (const [d, v] of slotDomain) profile[d] = v / total;
    }

    const dayLabel = DAYS_OF_WEEK[a.dayOfWeek]?.label ?? 'zi';
    const hourLabel = HOUR_BUCKETS.find((b) => b.id === a.hourBucket)?.label ?? 'ora';

    return {
      parkId: a.parkId,
      parkName: a.parkName,
      parkOsmId: a.parkOsmId,
      dayOfWeek: a.dayOfWeek,
      dayLabel,
      hourBucket: a.hourBucket,
      hourLabel,
      sessionCount: a.sessionCount,
      uniqueKids: a.uniqueKidIds.size,
      domainProfile: profile,
    };
  });

  const payload: ParkAggregatesPayload = {
    generatedAt: new Date().toISOString(),
    lookbackDays: LOOKBACK_DAYS,
    slots,
  };

  try {
    await redis.set(CACHE_KEY, JSON.stringify(payload), 'EX', CACHE_TTL_SEC);
  } catch (err) {
    logger.warn({ err }, 'park_aggregates.cache_write_failed');
  }
  return payload;
}
