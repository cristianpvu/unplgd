// Body composition. Uses pre-designed SVG fragments from `bodyAssets.ts`
// (extracted from the designer prototype) layered over a 762×1400 viewBox.
// Layer order matches the prototype: body-base → bottom (skipped if dress) →
// top → shoes → head (head drawn last so its outline overlaps the neck).

import type { Item } from '@prisma/client';
import type { Slot } from './catalog.js';
import { BODY_PARTS, BODY_VIEWBOX } from './bodyAssets.js';

export const VIEWBOX_W = BODY_VIEWBOX.w;
export const VIEWBOX_H = BODY_VIEWBOX.h;

const SKIN_FALLBACK = 'ecad80';
const TOP_FALLBACK = 'e8e3d5';
const BOTTOM_FALLBACK = '3d6fa3';
const SHOES_FALLBACK = '2c2c2a';

type TopKey = 'top-tshirt' | 'top-sweater' | 'top-hoodie' | 'top-dress';
type BottomKey = 'bottom-pants' | 'bottom-shorts' | 'bottom-skirt';
type ShoesKey = 'shoes-sneakers' | 'shoes-boots';

export type EquippedItems = Record<Slot, Item>;

function featureParts(item: Item): string[] {
  return item.feature ? item.feature.split(':') : [];
}

function topKey(items: EquippedItems): TopKey {
  const [type, , , sub] = featureParts(items.top);
  if (type === 'dress') return 'top-dress';
  if (type === 'hoodie') return 'top-hoodie';
  if (sub === 'long' || sub === '3q') return 'top-sweater';
  return 'top-tshirt';
}

function bottomKey(items: EquippedItems): BottomKey {
  const [type, , , length] = featureParts(items.bottom);
  if (type === 'skirt') return 'bottom-skirt';
  if (length === 'short') return 'bottom-shorts';
  return 'bottom-pants';
}

function shoesKey(items: EquippedItems): ShoesKey {
  const [type] = featureParts(items.footwear);
  if (type === 'boots') return 'shoes-boots';
  return 'shoes-sneakers';
}

function colors(items: EquippedItems) {
  return {
    skin: items.skin.feature ?? SKIN_FALLBACK,
    top: featureParts(items.top)[1] ?? TOP_FALLBACK,
    bottom: featureParts(items.bottom)[1] ?? BOTTOM_FALLBACK,
    shoes: featureParts(items.footwear)[1] ?? SHOES_FALLBACK,
  };
}

// SvgXml on RN doesn't expand CSS variables. The asset SVGs use literal
// `var(--name, #fallback)` placeholders so the prototype renders standalone;
// we string-replace them with the literal hex picked from the catalog.
function fillVars(
  svg: string,
  vars: { skin: string; top: string; bottom: string; shoes: string },
): string {
  return svg.replace(/var\(--(\w+),\s*#?([0-9a-fA-F]{6})\)/g, (_m, name, fallback) => {
    const v = (vars as Record<string, string | undefined>)[name];
    const hex = (v ?? fallback).replace(/^#/, '');
    return `#${hex}`;
  });
}

// Wrap DiceBear's full <svg> as a positioned nested viewport. Adventurer
// renders a head-only avatar in a 762×762 viewBox (chin at ~y=580). We size
// 720×720 centered horizontally and y-offset so the chin lands at ~y=540 —
// exactly where body-base's neck top begins, so the head naturally caps the
// neck without a visible seam.
function wrapHead(headSvg: string): string {
  return headSvg.replace(
    /<svg\b[^>]*viewBox="([^"]+)"[^>]*>/,
    (_m, viewBox) => `<svg x="21" y="-8" width="720" height="720" viewBox="${viewBox}">`,
  );
}

export function composeAvatar(items: EquippedItems, headSvg: string): string {
  const c = colors(items);
  const tk = topKey(items);
  const bk = bottomKey(items);
  const sk = shoesKey(items);
  const head = wrapHead(headSvg);
  const renderBottom = tk !== 'top-dress';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" width="100%" height="100%">` +
    fillVars(BODY_PARTS['body-base'], c) +
    (renderBottom ? fillVars(BODY_PARTS[bk], c) : '') +
    fillVars(BODY_PARTS[tk], c) +
    fillVars(BODY_PARTS[sk], c) +
    head +
    `</svg>`
  );
}
