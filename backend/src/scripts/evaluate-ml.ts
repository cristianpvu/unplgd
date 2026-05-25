// Evaluation script pentru lucrarea de licenta — masoara calitatea celor doi
// algoritmi ML (link prediction precision@k), cu baseline-uri de comparatie.
//
// 1. MARKOV next-domain (lant ordin 1 pe root domains)
//    Metoda: leave-last-out temporal. Pt fiecare user cu secventa first-touch
//    [d1..dn] (n>=2), ascundem dn. Construim matricea din TOATE tranzitiile
//    MAI PUTIN ultima a fiecarui user de test. Prezicem din d_{n-1}, verificam
//    rangul lui dn. Baseline: popularity (prezice cel mai frecvent domeniu).
//
// 2. PARK matching (cosine similarity profil user vs agregat parc)
//    Metoda: leave-one-out. Ground truth = parcul unde user-ul are cele mai
//    multe sesiuni. Construim profilul fiecarui parc din participantii lui
//    EXCLUZAND user-ul de test. Rank parcuri dupa cosine. Baseline: popularity
//    (rank dupa nr. participanti).
//
// Metrici: Hit@1, Hit@3, MRR (mean reciprocal rank).
//
// Usage:
//   node dist/scripts/evaluate-ml.js            # doar useri test-social-
//   node dist/scripts/evaluate-ml.js --all      # toti userii din DB

import { prisma } from '../lib/prisma.js';

const TEST_EMAIL_PREFIX = 'test-social-';

// ---------- Utilitare metrici ----------

type RankResult = { rank: number | null }; // 1-based; null daca nu e in lista

function summarize(results: RankResult[]): { hit1: number; hit3: number; mrr: number; n: number } {
  const n = results.length;
  if (n === 0) return { hit1: 0, hit3: 0, mrr: 0, n: 0 };
  let hit1 = 0, hit3 = 0, mrrSum = 0;
  for (const r of results) {
    if (r.rank == null) continue;
    if (r.rank <= 1) hit1 += 1;
    if (r.rank <= 3) hit3 += 1;
    mrrSum += 1 / r.rank;
  }
  return { hit1: hit1 / n, hit3: hit3 / n, mrr: mrrSum / n, n };
}

function pct(x: number): string {
  return (x * 100).toFixed(1) + '%';
}

function normalizeMap(m: Map<string, number>): Map<string, number> {
  const total = [...m.values()].reduce((s, v) => s + v, 0);
  if (total === 0) return m;
  const out = new Map<string, number>();
  for (const [k, v] of m) out.set(k, v / total);
  return out;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, magA = 0, magB = 0;
  for (const [k, v] of a) {
    magA += v * v;
    const bv = b.get(k);
    if (bv) dot += v * bv;
  }
  for (const v of b.values()) magB += v * v;
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ---------- Date ----------

async function loadRootMap(): Promise<{ rootBySlug: Map<string, string>; roots: Set<string> }> {
  const all = await prisma.domain.findMany({
    where: { active: true },
    select: { slug: true, parentSlug: true },
  });
  const parent = new Map<string, string | null>();
  for (const d of all) parent.set(d.slug, d.parentSlug);
  const rootBySlug = new Map<string, string>();
  const roots = new Set<string>();
  for (const d of all) {
    let cur = d.slug;
    let guard = 0;
    while (guard++ < 10) {
      const p = parent.get(cur);
      if (p == null) break;
      cur = p;
    }
    rootBySlug.set(d.slug, cur);
    if (parent.get(d.slug) == null) roots.add(d.slug);
  }
  return { rootBySlug, roots };
}

async function getUserIds(all: boolean): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: all ? {} : { email: { startsWith: TEST_EMAIL_PREFIX } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

// ---------- 1. Markov next-domain ----------

async function evaluateMarkov(userIds: string[]): Promise<void> {
  const { rootBySlug } = await loadRootMap();

  // Pt fiecare user, secventa first-touch (root domains in ordinea descoperirii).
  const events = await prisma.domainXpTransaction.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, domainSlug: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const seqByUser = new Map<string, string[]>();
  const firstSeen = new Map<string, Set<string>>();
  for (const e of events) {
    const root = rootBySlug.get(e.domainSlug);
    if (!root) continue;
    const seen = firstSeen.get(e.userId) ?? new Set<string>();
    if (seen.has(root)) continue;
    seen.add(root);
    firstSeen.set(e.userId, seen);
    const seq = seqByUser.get(e.userId) ?? [];
    seq.push(root);
    seqByUser.set(e.userId, seq);
  }

  // Tranzitii per user.
  const transByUser = new Map<string, Array<{ from: string; to: string }>>();
  for (const [userId, seq] of seqByUser) {
    const ts: Array<{ from: string; to: string }> = [];
    for (let i = 0; i < seq.length - 1; i++) ts.push({ from: seq[i]!, to: seq[i + 1]! });
    transByUser.set(userId, ts);
  }

  // Matrice GLOBALA (toti userii, secvente complete) + popularity globala.
  // Pt leave-one-user-out scadem contributia user-ului de test (subtractie
  // O(1) pe rand), nu rebuild — corect + eficient.
  const globalCounts = new Map<string, Map<string, number>>();
  const destPopularity = new Map<string, number>();
  for (const ts of transByUser.values()) {
    for (const { from, to } of ts) {
      const row = globalCounts.get(from) ?? new Map<string, number>();
      row.set(to, (row.get(to) ?? 0) + 1);
      globalCounts.set(from, row);
      destPopularity.set(to, (destPopularity.get(to) ?? 0) + 1);
    }
  }
  const popRanked = [...destPopularity.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d);

  // Useri eligibili: secventa >= 2.
  const testUsers = [...seqByUser.entries()].filter(([, s]) => s.length >= 2);

  const markovResults: RankResult[] = [];
  const popResults: RankResult[] = [];

  for (const [userId, seq] of testUsers) {
    const context = seq[seq.length - 2]!;
    const target = seq[seq.length - 1]!;

    // Leave-one-user-out: copiem row[context] si scadem tranzitiile user-ului
    // de test. Asa nu invatam din propriul lui istoric.
    const baseRow = globalCounts.get(context);
    const row = new Map<string, number>(baseRow ?? []);
    for (const t of transByUser.get(userId) ?? []) {
      if (t.from === context) {
        const cur = row.get(t.to) ?? 0;
        if (cur <= 1) row.delete(t.to);
        else row.set(t.to, cur - 1);
      }
    }

    if (row.size > 0) {
      const ranked = [...row.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d);
      const idx = ranked.indexOf(target);
      markovResults.push({ rank: idx >= 0 ? idx + 1 : null });
    } else {
      markovResults.push({ rank: null });
    }

    const pidx = popRanked.indexOf(target);
    popResults.push({ rank: pidx >= 0 ? pidx + 1 : null });
  }

  const mk = summarize(markovResults);
  const pop = summarize(popResults);

  console.log('\n=== 1. MARKOV next-domain (leave-last-out) ===');
  console.log(`Useri evaluati: ${mk.n} (secventa >= 2 domenii)`);
  console.log('');
  console.log('Model                Hit@1     Hit@3     MRR');
  console.log('-------------------- --------- --------- ---------');
  console.log(`Markov chain         ${pad(pct(mk.hit1))} ${pad(pct(mk.hit3))} ${pad(mk.mrr.toFixed(3))}`);
  console.log(`Popularity baseline  ${pad(pct(pop.hit1))} ${pad(pct(pop.hit3))} ${pad(pop.mrr.toFixed(3))}`);
}

// ---------- 2. Park matching cosine ----------

async function evaluatePark(userIds: string[]): Promise<void> {
  const { rootBySlug } = await loadRootMap();

  // Profil de domenii per user (root only, normalizat).
  const domainEvents = await prisma.domainXpTransaction.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, domainSlug: true, amount: true },
  });
  const profileByUser = new Map<string, Map<string, number>>();
  for (const e of domainEvents) {
    const root = rootBySlug.get(e.domainSlug);
    if (!root) continue;
    const m = profileByUser.get(e.userId) ?? new Map<string, number>();
    m.set(root, (m.get(root) ?? 0) + e.amount);
    profileByUser.set(e.userId, m);
  }

  // Sesiuni COMPLETED cu participanti (host + lobby).
  const sessions = await prisma.huntSession.findMany({
    where: {
      status: 'COMPLETED',
      OR: [
        { hostId: { in: userIds } },
        { lobby: { some: { userId: { in: userIds } } } },
      ],
    },
    select: {
      parkId: true,
      hostId: true,
      lobby: { select: { userId: true } },
    },
  });

  // park -> lista de (userId) participari (cu repetare = nr sesiuni)
  const parkParticipants = new Map<string, string[]>();
  // user -> park -> nr sesiuni (pt ground truth home park)
  const userParkCount = new Map<string, Map<string, number>>();

  for (const s of sessions) {
    const members = new Set<string>([s.hostId, ...s.lobby.map((l) => l.userId)]);
    for (const uid of members) {
      const arr = parkParticipants.get(s.parkId) ?? [];
      arr.push(uid);
      parkParticipants.set(s.parkId, arr);

      const upc = userParkCount.get(uid) ?? new Map<string, number>();
      upc.set(s.parkId, (upc.get(s.parkId) ?? 0) + 1);
      userParkCount.set(uid, upc);
    }
  }

  const parkIds = [...parkParticipants.keys()];
  if (parkIds.length < 2) {
    console.log('\n=== 2. PARK matching ===');
    console.log('Insuficiente parcuri cu sesiuni — skip. Ruleaza seed-ul intai.');
    return;
  }

  const cosineResults: RankResult[] = [];
  const popResults: RankResult[] = [];

  // Useri de test: cei care au profil + macar o sesiune.
  const testUsers = userIds.filter(
    (uid) => profileByUser.has(uid) && userParkCount.has(uid),
  );

  for (const uid of testUsers) {
    const profile = normalizeMap(profileByUser.get(uid)!);

    // Ground truth: parcul cu cele mai multe sesiuni ale user-ului.
    const upc = userParkCount.get(uid)!;
    const homePark = [...upc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!homePark) continue;

    // Profil per parc EXCLUZAND user-ul (leave-one-out).
    const parkScores: Array<{ parkId: string; sim: number; pop: number }> = [];
    for (const pid of parkIds) {
      const participants = parkParticipants.get(pid)!.filter((u) => u !== uid);
      if (participants.length === 0) {
        parkScores.push({ parkId: pid, sim: 0, pop: 0 });
        continue;
      }
      // Agregat = suma profilurilor participantilor (root domains).
      const agg = new Map<string, number>();
      for (const pUid of participants) {
        const pProfile = profileByUser.get(pUid);
        if (!pProfile) continue;
        for (const [k, v] of pProfile) agg.set(k, (agg.get(k) ?? 0) + v);
      }
      const sim = cosine(profile, normalizeMap(agg));
      parkScores.push({ parkId: pid, sim, pop: new Set(participants).size });
    }

    // Cosine ranking.
    const cosRanked = [...parkScores].sort((a, b) => b.sim - a.sim).map((x) => x.parkId);
    const cidx = cosRanked.indexOf(homePark);
    cosineResults.push({ rank: cidx >= 0 ? cidx + 1 : null });

    // Popularity ranking (nr participanti unici, ignora profil).
    const popRanked = [...parkScores].sort((a, b) => b.pop - a.pop).map((x) => x.parkId);
    const pidx = popRanked.indexOf(homePark);
    popResults.push({ rank: pidx >= 0 ? pidx + 1 : null });
  }

  const cos = summarize(cosineResults);
  const pop = summarize(popResults);

  console.log('\n=== 2. PARK matching (cosine, leave-one-out) ===');
  console.log(`Useri evaluati: ${cos.n} · parcuri: ${parkIds.length}`);
  console.log('');
  console.log('Model                Hit@1     Hit@3     MRR');
  console.log('-------------------- --------- --------- ---------');
  console.log(`Cosine similarity    ${pad(pct(cos.hit1))} ${pad(pct(cos.hit3))} ${pad(cos.mrr.toFixed(3))}`);
  console.log(`Popularity baseline  ${pad(pct(pop.hit1))} ${pad(pct(pop.hit3))} ${pad(pop.mrr.toFixed(3))}`);
}

function pad(s: string): string {
  return s.padEnd(9);
}

async function main() {
  const all = process.argv.includes('--all');
  const userIds = await getUserIds(all);
  console.log(`Evaluare pe ${userIds.length} useri (${all ? 'TOTI' : 'doar test-social-'})`);

  if (userIds.length === 0) {
    console.error('Niciun user. Ruleaza intai seed-social-data.js');
    process.exit(1);
  }

  await evaluateMarkov(userIds);
  await evaluatePark(userIds);

  console.log('\n[done]');
}

main()
  .catch((err) => {
    console.error('[fatal]', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
