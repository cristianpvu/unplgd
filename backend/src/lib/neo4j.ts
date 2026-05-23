// Driver Neo4j singleton — lazy-connect cu fallback silent daca lipseste config.
//
// Sursa de adevar pentru evenimente ramane Postgres. Neo4j e proiectie
// denormalizata: noduri pt Child / Skill / Domain, edges cumulative pe greutati.
// Sync din awardSkillXp/awardDomainXp prin lib/graphSync.ts (fire-and-forget).
//
// Daca NEO4J_URI lipseste sau driver-ul nu poate conecta, getDriver() returneaza
// null si toate operatiile sync devin no-op — app-ul nu cade niciodata din
// cauza Neo4j.

import neo4j, { Driver } from 'neo4j-driver';
import { env } from '../env.js';
import { logger } from './logger.js';

let driver: Driver | null = null;
let initialized = false;

export function getDriver(): Driver | null {
  if (initialized) return driver;
  initialized = true;

  if (!env.NEO4J_URI || !env.NEO4J_PASSWORD) {
    logger.warn('Neo4j disabled: NEO4J_URI sau NEO4J_PASSWORD lipsesc');
    return null;
  }

  try {
    driver = neo4j.driver(
      env.NEO4J_URI,
      neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASSWORD),
      { connectionAcquisitionTimeout: 5000, maxConnectionPoolSize: 20 },
    );
    return driver;
  } catch (e) {
    logger.error({ err: e }, 'Neo4j driver init failed');
    driver = null;
    return null;
  }
}

// Helper pt query simpla — gestioneaza session lifecycle. Returneaza null la
// orice eroare (logged), ca apelantii sa nu fie obligati sa puna try/catch
// pe fiecare sync minor.
export async function runCypher<T = unknown>(
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<T[] | null> {
  const d = getDriver();
  if (!d) return null;

  const session = d.session();
  try {
    const result = await session.run(cypher, params);
    return result.records.map((r) => r.toObject() as T);
  } catch (e) {
    logger.warn({ err: e, cypher }, 'Neo4j query failed');
    return null;
  } finally {
    await session.close();
  }
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
    initialized = false;
  }
}
