// DiceBear "Adventurer" HTTP renderer.
//
// We call api.dicebear.com directly and cache SVG strings in memory by an
// option hash. Each unique avatar config gets fetched once per app session.
// In production a service worker / disk cache would extend this; for MVP
// in-memory is enough since the same avatar is normally re-rendered many
// times (home, friends list, edit screen, etc).

import { CATALOG, findItem, type AvatarPicks } from './catalog';

const API_BASE = 'https://api.dicebear.com/9.x/adventurer/svg';

type DicebearOptions = {
  seed: string;
  skinColor?: string;
  hairColor?: string;
  hair?: string;
  hairProbability?: number;
  eyes?: string;
  eyesProbability?: number;
  mouth?: string;
  mouthProbability?: number;
  eyebrows?: string;
  eyebrowsProbability?: number;
  glasses?: string;
  glassesProbability?: number;
  earrings?: string;
  earringsProbability?: number;
  backgroundColor: string;
  featuresProbability: number;
};

export function picksToOptions(picks: AvatarPicks): DicebearOptions {
  const skin = findItem('skin', picks.skin)?.feature ?? 'ecad80';
  const hairColor = findItem('hairColor', picks.hairColor)?.feature ?? '6a4e35';

  const opts: DicebearOptions = {
    seed: 'fixed',
    skinColor: skin,
    hairColor,
    backgroundColor: 'transparent',
    featuresProbability: 0,
  };

  const toggles: Array<['hair' | 'eyes' | 'mouth' | 'eyebrows' | 'glasses' | 'earrings', keyof DicebearOptions]> = [
    ['hair', 'hairProbability'],
    ['eyes', 'eyesProbability'],
    ['mouth', 'mouthProbability'],
    ['eyebrows', 'eyebrowsProbability'],
    ['glasses', 'glassesProbability'],
    ['earrings', 'earringsProbability'],
  ];

  for (const [slot, probKey] of toggles) {
    const item = CATALOG[slot].find((x) => x.id === picks[slot]);
    if (item?.feature) {
      (opts as any)[slot] = item.feature;
      (opts as any)[probKey] = 100;
    } else {
      (opts as any)[probKey] = 0;
    }
  }

  return opts;
}

export function optionsToUrl(opts: DicebearOptions): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(opts)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }
  return `${API_BASE}?${params.toString()}`;
}

const svgCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

export async function fetchAvatarSvg(opts: DicebearOptions): Promise<string> {
  const url = optionsToUrl(opts);
  const cached = svgCache.get(url);
  if (cached) return cached;
  const pending = inflight.get(url);
  if (pending) return pending;

  const promise = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`DiceBear ${res.status}`);
    const svg = await res.text();
    svgCache.set(url, svg);
    inflight.delete(url);
    return svg;
  })().catch((e) => {
    inflight.delete(url);
    throw e;
  });

  inflight.set(url, promise);
  return promise;
}
