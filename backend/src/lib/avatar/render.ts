// Server-side DiceBear "Adventurer" rendering. We render the avatar SVG once
// at save time and cache it on the Avatar row, so reads (home screen, friends
// list) don't need to call DiceBear or do any work.
//
// "Adventurer" by Lisa Wischofsky (CC BY 4.0). DiceBear core is MIT.

import { createAvatar } from '@dicebear/core';
import * as adventurer from '@dicebear/adventurer';
import type { Options as AdventurerOptions } from '@dicebear/adventurer';
import { findItem, type AvatarPicks } from './catalog.js';

// Adventurer always renders eyes/mouth/eyebrows (no probability gate). The
// optional features (hair, glasses, earrings) take an *Probability scalar in
// addition to the array, which we use as an on/off switch.
type OptionalSlot = 'hair' | 'glasses' | 'earrings';

const OPTIONAL_PROB: Record<OptionalSlot, 'hairProbability' | 'glassesProbability' | 'earringsProbability'> = {
  hair: 'hairProbability',
  glasses: 'glassesProbability',
  earrings: 'earringsProbability',
};

type AdventurerVariant = NonNullable<AdventurerOptions['eyes']>[number];

function picksToOptions(picks: AvatarPicks): AdventurerOptions {
  const skin = findItem('skin', picks.skin)?.feature ?? 'ecad80';
  const hairColor = findItem('hairColor', picks.hairColor)?.feature ?? '6a4e35';
  const eyes = findItem('eyes', picks.eyes)?.feature;
  const mouth = findItem('mouth', picks.mouth)?.feature;
  const eyebrows = findItem('eyebrows', picks.eyebrows)?.feature;

  const opts: AdventurerOptions = {
    skinColor: [skin],
    hairColor: [hairColor],
    featuresProbability: 0,
  };

  if (eyes) opts.eyes = [eyes as AdventurerVariant];
  if (mouth) opts.mouth = [mouth as NonNullable<AdventurerOptions['mouth']>[number]];
  if (eyebrows) opts.eyebrows = [eyebrows as NonNullable<AdventurerOptions['eyebrows']>[number]];

  for (const slot of Object.keys(OPTIONAL_PROB) as OptionalSlot[]) {
    const item = findItem(slot, picks[slot]);
    const probKey = OPTIONAL_PROB[slot];
    if (item?.feature) {
      (opts as Record<string, unknown>)[slot] = [item.feature];
      opts[probKey] = 100;
    } else {
      opts[probKey] = 0;
    }
  }

  return opts;
}

export function renderAvatarSvg(picks: AvatarPicks): string {
  const options = picksToOptions(picks);
  const result = createAvatar(adventurer, {
    seed: 'unplgd',
    backgroundColor: ['transparent'],
    ...options,
  });
  return result.toString();
}
