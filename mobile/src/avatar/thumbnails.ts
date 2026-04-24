// Thumbnail URLs for the avatar picker. We hit DiceBear's public PNG endpoint
// directly — they're tiny, cacheable by the native Image component, and the
// picker only shows ~80 unique items total. The real avatar render still
// happens server-side; this is just for the picker UI.

import type { Slot } from './catalog';
import type { CatalogItem } from '../api/avatar';

const BASE = 'https://api.dicebear.com/9.x/adventurer/png';

const DEFAULT_SKIN = 'ecad80';
const DEFAULT_HAIR_COLOR = '6a4e35';
const DEFAULT_HAIR = 'short02';
const DEFAULT_EYES = 'variant01';
const DEFAULT_MOUTH = 'variant01';
const DEFAULT_EYEBROWS = 'variant08';

export function thumbnailUri(slot: Slot, item: CatalogItem, size = 96): string {
  const params = new URLSearchParams();
  params.set('seed', 'thumb');
  params.set('size', String(size));
  params.set('backgroundColor', 'ffffff');
  // No radius clipping; long hair otherwise gets cut off. Slight zoom-out
  // (scale<100) gives breathing room for tall hairstyles.
  params.set('scale', '85');
  params.set('translateY', '-5');
  params.set('featuresProbability', '0');

  const skin = slot === 'skin' && item.feature ? item.feature : DEFAULT_SKIN;
  const hairColor = slot === 'hairColor' && item.feature ? item.feature : DEFAULT_HAIR_COLOR;
  params.set('skinColor', skin);
  params.set('hairColor', hairColor);

  // Hair: show this hair feature; hide for "Fara" (null) which doesn't exist for hair anyway.
  if (slot === 'hair' && item.feature) {
    params.set('hair', item.feature);
    params.set('hairProbability', '100');
  } else if (slot !== 'hair') {
    // Other slots get baseline hair so the face has framing.
    params.set('hair', DEFAULT_HAIR);
    params.set('hairProbability', '100');
  } else {
    params.set('hairProbability', '0');
  }

  // Eyes / mouth / eyebrows: always shown. Use the picked feature for its slot,
  // baseline for the others.
  params.set('eyes', slot === 'eyes' && item.feature ? item.feature : DEFAULT_EYES);
  params.set('mouth', slot === 'mouth' && item.feature ? item.feature : DEFAULT_MOUTH);
  params.set('eyebrows', slot === 'eyebrows' && item.feature ? item.feature : DEFAULT_EYEBROWS);

  // Optional toggles: glasses + earrings.
  if (slot === 'glasses' && item.feature) {
    params.set('glasses', item.feature);
    params.set('glassesProbability', '100');
  } else {
    params.set('glassesProbability', '0');
  }
  if (slot === 'earrings' && item.feature) {
    params.set('earrings', item.feature);
    params.set('earringsProbability', '100');
  } else {
    params.set('earringsProbability', '0');
  }

  return `${BASE}?${params.toString()}`;
}
