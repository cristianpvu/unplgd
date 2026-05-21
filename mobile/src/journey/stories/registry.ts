// Registry pentru StoryPack-uri — analog cu worlds/registry.ts.

import type { StoryPack } from './types';

const REGISTRY = new Map<string, StoryPack>();

export function registerStory(pack: StoryPack): void {
  if (REGISTRY.has(pack.petSlug)) {
    // eslint-disable-next-line no-console
    console.warn(`[stories] StoryPack duplicat pt slug="${pack.petSlug}" — il suprascriu`);
  }
  REGISTRY.set(pack.petSlug, pack);
}

export function getStoryForPet(petSlug: string | null | undefined): StoryPack | null {
  if (!petSlug) return null;
  return REGISTRY.get(petSlug) ?? null;
}

export function listStorySlugs(): string[] {
  return [...REGISTRY.keys()];
}
