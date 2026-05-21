// Registry-ul WorldPack-urilor. Fiecare fisier de pet se inregistreaza pe
// sine apeland `registerWorld(PACK)` la nivel de modul. `worlds/index.ts`
// importa toate fisierele ca side-effect → ele se auto-inregistreaza la
// startul aplicatiei.
//
// `getWorldForPet(slug)` returneaza fie pack-ul dedicat, fie DEFAULT_WORLD
// — niciodata nu crapa daca un pet nu are config.

import { DEFAULT_WORLD } from './default';
import type { WorldPack } from './types';

const REGISTRY = new Map<string, WorldPack>();
REGISTRY.set('default', DEFAULT_WORLD);

export function registerWorld(pack: WorldPack): void {
  if (REGISTRY.has(pack.slug)) {
    // eslint-disable-next-line no-console
    console.warn(`[journey] WorldPack duplicat pt slug="${pack.slug}" — il suprascriu`);
  }
  REGISTRY.set(pack.slug, pack);
}

export function getWorldForPet(speciesSlug: string | null | undefined): WorldPack {
  if (!speciesSlug) return DEFAULT_WORLD;
  return REGISTRY.get(speciesSlug) ?? DEFAULT_WORLD;
}

export function listRegisteredSlugs(): string[] {
  return [...REGISTRY.keys()];
}
