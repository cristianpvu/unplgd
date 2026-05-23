// API client pentru noile endpoint-uri /me/skills, /me/domains, /me/insight.
// Tinem separat de me.ts ca sa nu bloatam fisierul existent.

import { api } from './client';

export type SkillScore = {
  skill: string; // 'creativitate' | 'curiozitate' | 'sociabilitate' | 'perseverenta' | 'logica' | 'empatie'
  score: number;
  level: number; // 1..5
  levelName: string; // 'Novice' | 'Explorator' | 'Aventurier' | 'Erou' | 'Maestru'
};

export type DomainScore = {
  slug: string;
  parentSlug: string | null;
  name: string;
  icon: string | null;
  kind: string; // 'interest' | 'knowledge' | 'both'
  score: number;
  level: number;
  levelName: string;
};

export type Insight = {
  message: string;
  generatedAt: string;
  basedOn: {
    daysAnalyzed: number;
    topSkills: Array<{ skill: string; amount: number }>;
    topDomains: Array<{ slug: string; name: string; amount: number }>;
    activityCounts: Record<string, number>;
    eventTotal: number;
  };
};

export function getMySkills(): Promise<{ skills: SkillScore[] }> {
  return api('/me/skills');
}

export function getMyDomainsAll(): Promise<{ domains: DomainScore[] }> {
  return api('/me/domains');
}

export function getMyDomainsTop(limit: number = 10): Promise<{ domains: DomainScore[] }> {
  return api(`/me/domains/top?limit=${limit}`);
}

export function getMyInsight(opts: { fresh?: boolean } = {}): Promise<Insight> {
  return api(`/me/insight${opts.fresh ? '?fresh=1' : ''}`);
}

// Versiuni publice — orice user logat poate vedea skills/domains altui user.
// Folosit in profil public (profile/[id]). Insight-ul lipseste intentionat —
// reflectia saptamanii e privata copilului.

export function getUserSkills(userId: string): Promise<{ skills: SkillScore[] }> {
  return api(`/users/${userId}/skills`);
}

export function getUserDomainsTop(
  userId: string,
  limit: number = 10,
): Promise<{ domains: DomainScore[] }> {
  return api(`/users/${userId}/domains/top?limit=${limit}`);
}
