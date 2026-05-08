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

type AdventurerEyes = NonNullable<AdventurerOptions['eyes']>[number];
type AdventurerMouth = NonNullable<AdventurerOptions['mouth']>[number];
type AdventurerEyebrows = NonNullable<AdventurerOptions['eyebrows']>[number];

// Variant Adventurer cu ambii ochi inchisi (curbe "u" simple, fara pupile) —
// folosit pentru frame-ul de blink. Crossfade pe mobil intre svg si svgBlink
// simuleaza clipitul fara a re-randa nimic la runtime. NU folosi variant22
// (e wink, doar un ochi).
export const BLINK_EYES_VARIANT: AdventurerEyes = 'variant20';

// Expresii faciale: overrides pe eyes/mouth/eyebrows aplicate peste outfitul
// curent al user-ului. Pre-randate la save (vezi routes/avatar.ts) si swap-uite
// pe mobil ca raspuns la evenimente (tap, level up, NFC scan, friend add).
// Variantele alese sunt sigure (subset al celor folosite deja in seed) ca sa
// nu crape DiceBear schema validation.
export type Expression = 'happy' | 'sad' | 'surprise' | 'focused';
export const EXPRESSIONS: readonly Expression[] = ['happy', 'sad', 'surprise', 'focused'] as const;

type FaceOverrides = {
  eyes?: AdventurerEyes;
  mouth?: AdventurerMouth;
  eyebrows?: AdventurerEyebrows;
};

const EXPRESSION_OVERRIDES: Record<Expression, FaceOverrides> = {
  happy:    { eyes: 'variant03', mouth: 'variant05', eyebrows: 'variant05' },
  sad:      { eyes: 'variant12', mouth: 'variant10', eyebrows: 'variant12' },
  surprise: { eyes: 'variant26', mouth: 'variant14', eyebrows: 'variant15' },
  focused:  { eyes: 'variant19', mouth: 'variant10', eyebrows: 'variant08' },
};

function itemsToOptions(items: EquippedItems, overrides: FaceOverrides = {}): AdventurerOptions {
  const skin = items.skin.feature ?? 'ecad80';
  const hairColor = items.hairColor.feature ?? '6a4e35';

  const opts: AdventurerOptions = {
    skinColor: [skin],
    hairColor: [hairColor],
    featuresProbability: 0,
  };

  const eyesFeature = overrides.eyes ?? (items.eyes.feature as AdventurerEyes | undefined);
  if (eyesFeature) opts.eyes = [eyesFeature];
  const mouthFeature = overrides.mouth ?? (items.mouth.feature as AdventurerMouth | undefined);
  if (mouthFeature) opts.mouth = [mouthFeature];
  const eyebrowsFeature = overrides.eyebrows ?? (items.eyebrows.feature as AdventurerEyebrows | undefined);
  if (eyebrowsFeature) opts.eyebrows = [eyebrowsFeature];

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

function renderHead(items: EquippedItems, overrides: FaceOverrides = {}): string {
  const options = itemsToOptions(items, overrides);
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
  return renderHead(items, { eyes: BLINK_EYES_VARIANT });
}

export function renderAvatarExpressionSvg(items: EquippedItems, expression: Expression): string {
  return renderHead(items, EXPRESSION_OVERRIDES[expression]);
}
