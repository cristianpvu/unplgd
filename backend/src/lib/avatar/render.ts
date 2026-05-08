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

// "Sideways" — ochii privesc lateral, pastrand restul fetei. Folosit ca frame
// idle de tip "looking around" peste varianta neutrala a user-ului. Daca user-ul
// si-a ales chiar variant15 ca eyes, swap-ul devine no-op (frame identic) —
// nicio paguba.
export const GAZE_EYES_VARIANT: AdventurerEyes = 'variant15';

// Mapare gura inchisa -> gura deschisa "din aceeasi familie". Pre-randam un
// singur frame "MouthOpen" care intra scurt in loop idle (simuleaza respiratie
// /talking). Pentru gurile deja deschise (Surpriza/Ras mare) pereche-ul e
// identic → animatia devine no-op, OK.
const MOUTH_OPEN_PAIR: Record<string, AdventurerMouth> = {
  variant01: 'variant22', // Zambet mic   -> Dinti
  variant05: 'variant22', // Fericire     -> Dinti
  variant10: 'variant14', // Serios       -> Surpriza
  variant14: 'variant14', // Surpriza     -> identic (no-op)
  variant18: 'variant30', // Limba        -> Ras mare
  variant22: 'variant30', // Dinti        -> Ras mare
  variant26: 'variant14', // Buze         -> Surpriza
  variant30: 'variant30', // Ras mare     -> identic (no-op)
};

type FaceOverrides = {
  eyes?: AdventurerEyes;
  mouth?: AdventurerMouth;
  eyebrows?: AdventurerEyebrows;
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

export function renderAvatarGazeSvg(items: EquippedItems): string {
  return renderHead(items, { eyes: GAZE_EYES_VARIANT });
}

export function renderAvatarMouthOpenSvg(items: EquippedItems): string {
  const current = items.mouth.feature as AdventurerMouth | null | undefined;
  if (!current) return renderHead(items);
  const open: AdventurerMouth = MOUTH_OPEN_PAIR[current] ?? current;
  return renderHead(items, { mouth: open });
}
