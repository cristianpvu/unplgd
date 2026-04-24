// Server-side DiceBear "Adventurer" rendering. We render the avatar SVG once
// at save time and cache it on the Avatar row, so reads (home screen, friends
// list) don't need to call DiceBear or do any work.
//
// "Adventurer" by Lisa Wischofsky (CC BY 4.0). DiceBear core is MIT.

import { createAvatar } from '@dicebear/core';
import * as adventurer from '@dicebear/adventurer';
import type { Options as AdventurerOptions } from '@dicebear/adventurer';
import { composeAvatar, type EquippedItems } from './body.js';

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

// Variant Adventurer cu ochii inchisi — folosit pentru frame-ul de blink.
// Crossfade pe mobil intre svg si svgBlink simuleaza clipitul fara a re-randa
// nimic la runtime.
export const BLINK_EYES_VARIANT: AdventurerVariant = 'variant22';

function itemsToOptions(items: EquippedItems, eyesOverride?: AdventurerVariant): AdventurerOptions {
  const skin = items.skin.feature ?? 'ecad80';
  const hairColor = items.hairColor.feature ?? '6a4e35';

  const opts: AdventurerOptions = {
    skinColor: [skin],
    hairColor: [hairColor],
    featuresProbability: 0,
  };

  const eyesFeature = eyesOverride ?? (items.eyes.feature as AdventurerVariant | undefined);
  if (eyesFeature) opts.eyes = [eyesFeature];
  if (items.mouth.feature) opts.mouth = [items.mouth.feature as NonNullable<AdventurerOptions['mouth']>[number]];
  if (items.eyebrows.feature) opts.eyebrows = [items.eyebrows.feature as NonNullable<AdventurerOptions['eyebrows']>[number]];

  for (const slot of Object.keys(OPTIONAL_PROB) as OptionalSlot[]) {
    const feature = items[slot].feature;
    const probKey = OPTIONAL_PROB[slot];
    if (feature) {
      (opts as Record<string, unknown>)[slot] = [feature];
      opts[probKey] = 100;
    } else {
      opts[probKey] = 0;
    }
  }

  return opts;
}

function renderHead(items: EquippedItems, eyesOverride?: AdventurerVariant): string {
  const options = itemsToOptions(items, eyesOverride);
  const head = createAvatar(adventurer, {
    seed: 'unplgd',
    backgroundColor: ['transparent'],
    ...options,
  }).toString();
  return composeAvatar(items, head);
}

export function renderAvatarSvg(items: EquippedItems): string {
  return renderHead(items);
}

export function renderAvatarBlinkSvg(items: EquippedItems): string {
  return renderHead(items, BLINK_EYES_VARIANT);
}
