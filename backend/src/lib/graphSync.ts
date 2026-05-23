// Proiectia evenimentelor Postgres in graful Neo4j. Sync-ul e fire-and-forget
// (apelat cu `void ...catch(() => {})` din awardSkillXp / awardDomainXp), deci
// orice failure aici e silent. Rebuild-ul complet ruleaza dintr-un cron job
// (rebuildGraphFromScratch) ca sa garantam consistency in caz de outage Neo4j.
//
// Schema graf:
//   (:Child {userId})
//   (:Skill {slug})
//   (:Domain {slug, parentSlug, kind})
//
//   (:Child)-[:DEMONSTRATED {weight: float, lastTs: datetime}]->(:Skill)
//   (:Child)-[:INTERESTED_IN {weight: float, lastTs: datetime}]->(:Domain)
//   (:Domain)-[:CHILD_OF]->(:Domain)
//
// `weight` se acumuleaza incremental (MERGE + SET weight = weight + amount).
// `lastTs` se updateaza la fiecare event.

import { prisma } from './prisma.js';
import { runCypher, getDriver } from './neo4j.js';
import { logger } from './logger.js';

// MERGE pe nod child + skill, apoi MERGE pe edge cu acumulare weight.
export async function syncSkillEvent(
  userId: string,
  skill: string,
  amount: number,
): Promise<void> {
  if (!getDriver()) return;

  await runCypher(
    `
    MERGE (c:Child {userId: $userId})
    MERGE (s:Skill {slug: $skill})
    MERGE (c)-[r:DEMONSTRATED]->(s)
    ON CREATE SET r.weight = $amount, r.lastTs = datetime()
    ON MATCH  SET r.weight = r.weight + $amount, r.lastTs = datetime()
    `,
    { userId, skill, amount },
  );
}

export async function syncDomainEvent(
  userId: string,
  domainSlug: string,
  amount: number,
): Promise<void> {
  if (!getDriver()) return;

  await runCypher(
    `
    MERGE (c:Child {userId: $userId})
    MERGE (d:Domain {slug: $domainSlug})
    MERGE (c)-[r:INTERESTED_IN]->(d)
    ON CREATE SET r.weight = $amount, r.lastTs = datetime()
    ON MATCH  SET r.weight = r.weight + $amount, r.lastTs = datetime()
    `,
    { userId, domainSlug, amount },
  );
}

/**
 * Sterge tot graful si il reconstruieste din Postgres. Ruleaza dintr-un cron
 * job nocturn (sau manual din admin) ca sa corecteze drift-ul cauzat de
 * eventual outage Neo4j sau bug-uri de sync incremental.
 *
 * NU aplica decay aici — weight-urile in graf sunt suma BRUTA pe toata
 * istoria. Decay-ul se calculeaza la query (in lib/skills.ts si
 * lib/domains.ts) sau in Cypher daca devine necesar. Asa graful e o sursa
 * stabila de "afinitate cumulativa" iar UI-ul afiseaza decay-uit.
 */
export async function rebuildGraphFromScratch(): Promise<{
  ok: boolean;
  childCount: number;
  edgeCount: number;
}> {
  const driver = getDriver();
  if (!driver) {
    logger.warn('rebuildGraphFromScratch: Neo4j unavailable');
    return { ok: false, childCount: 0, edgeCount: 0 };
  }

  // 1. Sterge totul. Pe MVP scale (sub 1M nodes) e ok.
  await runCypher('MATCH (n) DETACH DELETE n');

  // 2. Seed taxonomia de domenii ca nodes + ierarhie.
  const domains = await prisma.domain.findMany({ where: { active: true } });
  for (const d of domains) {
    await runCypher(
      `MERGE (n:Domain {slug: $slug})
       SET n.name = $name, n.kind = $kind, n.parentSlug = $parentSlug`,
      { slug: d.slug, name: d.name, kind: d.kind, parentSlug: d.parentSlug },
    );
    if (d.parentSlug) {
      await runCypher(
        `MATCH (c:Domain {slug: $childSlug}), (p:Domain {slug: $parentSlug})
         MERGE (c)-[:CHILD_OF]->(p)`,
        { childSlug: d.slug, parentSlug: d.parentSlug },
      );
    }
  }

  // 3. Re-acumulam skill events (toate, BRUT — fara decay).
  const skillEvents = await prisma.skillXpTransaction.groupBy({
    by: ['userId', 'skill'],
    _sum: { amount: true },
    _max: { createdAt: true },
  });
  for (const ev of skillEvents) {
    await runCypher(
      `
      MERGE (c:Child {userId: $userId})
      MERGE (s:Skill {slug: $skill})
      MERGE (c)-[r:DEMONSTRATED]->(s)
      SET r.weight = $amount, r.lastTs = datetime($lastTs)
      `,
      {
        userId: ev.userId,
        skill: ev.skill,
        amount: ev._sum.amount ?? 0,
        lastTs: (ev._max.createdAt ?? new Date()).toISOString(),
      },
    );
  }

  // 4. Re-acumulam domain events.
  const domainEvents = await prisma.domainXpTransaction.groupBy({
    by: ['userId', 'domainSlug'],
    _sum: { amount: true },
    _max: { createdAt: true },
  });
  for (const ev of domainEvents) {
    await runCypher(
      `
      MERGE (c:Child {userId: $userId})
      MERGE (d:Domain {slug: $domainSlug})
      MERGE (c)-[r:INTERESTED_IN]->(d)
      SET r.weight = $amount, r.lastTs = datetime($lastTs)
      `,
      {
        userId: ev.userId,
        domainSlug: ev.domainSlug,
        amount: ev._sum.amount ?? 0,
        lastTs: (ev._max.createdAt ?? new Date()).toISOString(),
      },
    );
  }

  // Numaratoare pt log + raspuns admin.
  const countResult = await runCypher<{ children: number; edges: number }>(
    `MATCH (c:Child) WITH count(c) AS children
     MATCH ()-[r]->() WITH children, count(r) AS edges
     RETURN children, edges`,
  );
  const stats = countResult?.[0] ?? { children: 0, edges: 0 };
  logger.info({ stats }, 'Neo4j rebuilt from Postgres');
  return { ok: true, childCount: stats.children, edgeCount: stats.edges };
}
