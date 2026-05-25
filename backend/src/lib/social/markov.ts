// Markov chain de ordin 1 pe ROOT domains.
//
// Ce raspunde: "Un copil care a inceput sa exploreze domeniul A, in ce alt
// domeniu B este probabil sa se aprinda urmator?"
//
// Algoritm:
//   1. Pentru fiecare user, gasim "first touch" per root domain (cel mai vechi
//      DomainXpTransaction in care apare un slug care e root SAU se urca prin
//      parentSlug la un root).
//   2. Sortam first-touch-urile fiecarui user cronologic. Asta da o SECVENTA de
//      root domains in ordinea descoperirii: [spatiu, dinozauri, tehnologie, ...].
//   3. Pentru fiecare pereche consecutiva (A, B) in secvente, incrementam un
//      contor counts[A][B]. Aggregam peste TOTI userii.
//   4. Normalizam fiecare rand: p(B|A) = counts[A][B] / sum(counts[A][*]).
//   5. Aplicam filtru de support: rand cu < MIN_ROW_SUPPORT transitii nu e
//      considerat (zgomot prea mare).
//
// Predictie pt user:
//   - Determinam root domain-ul lor curent dominant (cel mai mult XP in
//      ultimele DOMAIN_LOOKBACK_DAYS).
//   - Lookup matricii: row[currentTop].
//   - Excludem domeniile pe care user-ul le-a atins deja semnificativ.
//   - Returnam top-1 candidate daca probabilitatea >= MIN_PROB_FOR_PREDICTION.
//
// Cache 24h in Redis. Rebuild via cron 06:15 (inainte de notify hints 08:00).

import { prisma } from '../prisma.js';
import { redis } from '../redis.js';
import { logger } from '../logger.js';

const CACHE_KEY = 'social:markov:matrix:v1';
const CACHE_TTL_SEC = 24 * 3600;
const MIN_ROW_SUPPORT = 2; // randul A trebuie sa aiba >=2 tranzitii totale ca sa fie folosit
const MIN_PROB_FOR_PREDICTION = 0.25; // sub asta consideram zgomot
const DOMAIN_LOOKBACK_DAYS = 30; // pentru "current top domain"
const ALREADY_KNOWN_THRESHOLD_XP = 50; // peste asta consideram ca "stie deja"
const MS_PER_DAY = 86400000;

export type MatrixRow = {
  fromSlug: string;
  fromName: string;
  total: number; // suma tranzitiilor din randul asta
  transitions: {
    slug: string;
    name: string;
    count: number;
    probability: number;
  }[];
};

export type DomainTransitionMatrix = {
  builtAt: string;
  version: number; // bumpat cand schimbam algoritmul
  totalUsers: number;
  totalRootDomains: number;
  totalTransitions: number;
  rows: Record<string, MatrixRow>;
};

type FirstTouch = { userId: string; rootSlug: string; firstAt: Date };

const MATRIX_VERSION = 1;

async function loadRootDomainMap(): Promise<{
  rootBySlug: Map<string, string>; // slug -> rootSlug
  nameBySlug: Map<string, string>; // rootSlug -> display name
}> {
  const all = await prisma.domain.findMany({
    where: { active: true },
    select: { slug: true, parentSlug: true, name: true },
  });

  const parentMap = new Map<string, string | null>();
  const nameMap = new Map<string, string>();
  for (const d of all) {
    parentMap.set(d.slug, d.parentSlug);
    nameMap.set(d.slug, d.name);
  }

  const rootBySlug = new Map<string, string>();
  const nameBySlug = new Map<string, string>();
  for (const d of all) {
    // urca prin parent pana la root
    let cur = d.slug;
    let safety = 0;
    while (safety++ < 10) {
      const p = parentMap.get(cur);
      if (p == null) break; // e root
      cur = p;
    }
    rootBySlug.set(d.slug, cur);
    if (parentMap.get(d.slug) == null) {
      nameBySlug.set(d.slug, d.name);
    }
  }

  // ne asiguram ca pt roots avem si name-ul
  for (const d of all) {
    if (parentMap.get(d.slug) == null) {
      nameBySlug.set(d.slug, d.name);
    }
  }

  return { rootBySlug, nameBySlug };
}

/**
 * Rebuild matricea de la zero din DB. Heavy — apel din cron sau admin trigger.
 */
export async function rebuildDomainTransitionMatrix(): Promise<DomainTransitionMatrix> {
  const { rootBySlug, nameBySlug } = await loadRootDomainMap();
  const rootSlugs = new Set(nameBySlug.keys());

  // Aggregat firstTouch per (userId, rootSlug). MIN(createdAt) la rollup root.
  // Folosim findMany cu groupBy emulat in cod ca sa nu fortam SQL custom.
  const allEvents = await prisma.domainXpTransaction.findMany({
    select: { userId: true, domainSlug: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const firstTouchMap = new Map<string, FirstTouch>(); // key = userId|rootSlug
  for (const e of allEvents) {
    const root = rootBySlug.get(e.domainSlug);
    if (!root || !rootSlugs.has(root)) continue;
    const key = `${e.userId}|${root}`;
    if (!firstTouchMap.has(key)) {
      firstTouchMap.set(key, { userId: e.userId, rootSlug: root, firstAt: e.createdAt });
    }
  }

  // Grupare per user, sortare cronologica, extragere perechi consecutive.
  const byUser = new Map<string, FirstTouch[]>();
  for (const t of firstTouchMap.values()) {
    const arr = byUser.get(t.userId) ?? [];
    arr.push(t);
    byUser.set(t.userId, arr);
  }

  const counts = new Map<string, Map<string, number>>(); // from -> to -> count
  let totalTransitions = 0;
  for (const seq of byUser.values()) {
    seq.sort((a, b) => a.firstAt.getTime() - b.firstAt.getTime());
    for (let i = 0; i < seq.length - 1; i++) {
      const a = seq[i];
      const b = seq[i + 1];
      if (!a || !b) continue;
      const from = a.rootSlug;
      const to = b.rootSlug;
      if (from === to) continue; // safety
      const row = counts.get(from) ?? new Map<string, number>();
      row.set(to, (row.get(to) ?? 0) + 1);
      counts.set(from, row);
      totalTransitions += 1;
    }
  }

  // Normalizare + filtru support.
  const rows: Record<string, MatrixRow> = {};
  for (const [from, row] of counts.entries()) {
    let total = 0;
    for (const c of row.values()) total += c;
    if (total < MIN_ROW_SUPPORT) continue;

    const transitions: MatrixRow['transitions'] = [];
    for (const [to, c] of row.entries()) {
      transitions.push({
        slug: to,
        name: nameBySlug.get(to) ?? to,
        count: c,
        probability: c / total,
      });
    }
    transitions.sort((a, b) => b.probability - a.probability);
    rows[from] = {
      fromSlug: from,
      fromName: nameBySlug.get(from) ?? from,
      total,
      transitions,
    };
  }

  const matrix: DomainTransitionMatrix = {
    builtAt: new Date().toISOString(),
    version: MATRIX_VERSION,
    totalUsers: byUser.size,
    totalRootDomains: rootSlugs.size,
    totalTransitions,
    rows,
  };

  try {
    await redis.set(CACHE_KEY, JSON.stringify(matrix), 'EX', CACHE_TTL_SEC);
  } catch (err) {
    logger.warn({ err }, 'markov.cache_write_failed');
  }

  logger.info(
    {
      users: matrix.totalUsers,
      rows: Object.keys(matrix.rows).length,
      transitions: matrix.totalTransitions,
    },
    'markov.matrix_built',
  );

  return matrix;
}

/**
 * Returneaza matricea din cache; daca lipseste, o rebuild-uieste.
 */
export async function getDomainTransitionMatrix(options?: {
  forceFresh?: boolean;
}): Promise<DomainTransitionMatrix> {
  if (!options?.forceFresh) {
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) return JSON.parse(cached) as DomainTransitionMatrix;
    } catch (err) {
      logger.warn({ err }, 'markov.cache_read_failed');
    }
  }
  return rebuildDomainTransitionMatrix();
}

export type NextDomainPrediction = {
  slug: string;
  name: string;
  probability: number;
  fromSlug: string;
  fromName: string;
};

/**
 * Prezice ce root domain ar putea sa atraga user-ul ca urmator interes.
 * Returneaza null daca:
 *   - user n-are istoric pe vreun root domain,
 *   - randul matricii pt top-ul lui nu exista sau e prea slab,
 *   - toate candidatele sunt deja "stiute" (XP >= ALREADY_KNOWN_THRESHOLD_XP).
 */
export async function predictNextRootDomain(
  userId: string,
): Promise<NextDomainPrediction | null> {
  const since = new Date(Date.now() - DOMAIN_LOOKBACK_DAYS * MS_PER_DAY);

  const [{ rootBySlug, nameBySlug }, events] = await Promise.all([
    loadRootDomainMap(),
    prisma.domainXpTransaction.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { domainSlug: true, amount: true },
    }),
  ]);

  if (events.length === 0) return null;

  // XP per root domain.
  const xpByRoot = new Map<string, number>();
  for (const e of events) {
    const root = rootBySlug.get(e.domainSlug);
    if (!root) continue;
    xpByRoot.set(root, (xpByRoot.get(root) ?? 0) + e.amount);
  }
  if (xpByRoot.size === 0) return null;

  const topEntry = [...xpByRoot.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!topEntry) return null;
  const topRoot = topEntry[0];

  const matrix = await getDomainTransitionMatrix();
  const row = matrix.rows[topRoot];
  if (!row) return null;

  // Excludem domeniile deja "stiute" de user.
  const known = new Set<string>();
  for (const [slug, xp] of xpByRoot.entries()) {
    if (xp >= ALREADY_KNOWN_THRESHOLD_XP) known.add(slug);
  }

  const candidate = row.transitions.find(
    (t) => !known.has(t.slug) && t.probability >= MIN_PROB_FOR_PREDICTION,
  );
  if (!candidate) return null;

  return {
    slug: candidate.slug,
    name: candidate.name,
    probability: candidate.probability,
    fromSlug: topRoot,
    fromName: nameBySlug.get(topRoot) ?? topRoot,
  };
}
