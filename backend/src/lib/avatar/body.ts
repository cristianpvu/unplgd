// Body composition. We hand-tune chibi proportions in a 200x340 viewBox:
// the DiceBear head occupies the top ~150 px (face centered around the neck),
// the rest is original body geometry built from the picks. T-pose, soft
// rounded shapes, single solid skin layer + clothing layered on top.

import type { AvatarPicks } from './catalog.js';
import { findItem } from './catalog.js';

export const VIEWBOX_W = 200;
export const VIEWBOX_H = 340;

const SKIN_FALLBACK = 'ecad80';

const SHAPE = {
  slim: { torsoX: 76, torsoW: 48, armW: 44, hipFlare: 0 },
  medium: { torsoX: 70, torsoW: 60, armW: 44, hipFlare: 2 },
  robust: { torsoX: 62, torsoW: 76, armW: 42, hipFlare: 4 },
} as const;

type ShapeKey = keyof typeof SHAPE;

const Y = {
  neckTop: 138,
  shoulderTop: 152,
  armCenter: 174,
  hipBottom: 240,
  bottomShortEnd: 268,
  bottomLongEnd: 305,
  shoeTop: 305,
  shoeBottom: 320,
  stage: 332,
};

function skinHex(picks: AvatarPicks): string {
  return findItem('skin', picks.skin)?.feature ?? SKIN_FALLBACK;
}

function shapeKey(picks: AvatarPicks): ShapeKey {
  const f = findItem('bodyShape', picks.bodyShape)?.feature;
  if (f === 'slim' || f === 'medium' || f === 'robust') return f;
  return 'medium';
}

function stage(): string {
  return `<ellipse cx="100" cy="${Y.stage}" rx="68" ry="6" fill="#2D2A4A" opacity="0.12"/>`;
}

function legs(skin: string): string {
  const top = Y.hipBottom;
  const h = Y.bottomLongEnd - Y.hipBottom + 4;
  return (
    `<rect x="82" y="${top}" width="14" height="${h}" rx="7" fill="#${skin}"/>` +
    `<rect x="104" y="${top}" width="14" height="${h}" rx="7" fill="#${skin}"/>`
  );
}

function neckAndTorso(skin: string, key: ShapeKey): string {
  const s = SHAPE[key];
  const tx = s.torsoX;
  const tw = s.torsoW;
  const sh = Y.shoulderTop;
  const hb = Y.hipBottom;
  return (
    `<rect x="92" y="${Y.neckTop}" width="16" height="${sh - Y.neckTop + 6}" rx="6" fill="#${skin}"/>` +
    `<path d="M ${tx} ${sh}` +
    ` Q ${tx} ${sh - 6} ${tx + 8} ${sh - 6}` +
    ` L ${tx + tw - 8} ${sh - 6}` +
    ` Q ${tx + tw} ${sh - 6} ${tx + tw} ${sh}` +
    ` L ${tx + tw + s.hipFlare} ${hb}` +
    ` Q ${tx + tw + s.hipFlare} ${hb + 4} ${tx + tw + s.hipFlare - 6} ${hb + 4}` +
    ` L ${tx - s.hipFlare + 6} ${hb + 4}` +
    ` Q ${tx - s.hipFlare} ${hb + 4} ${tx - s.hipFlare} ${hb}` +
    ` Z" fill="#${skin}"/>`
  );
}

function arms(skin: string, key: ShapeKey): string {
  const s = SHAPE[key];
  const cy = Y.armCenter;
  const leftEnd = s.torsoX + 4;
  const leftStart = leftEnd - s.armW;
  const rightStart = s.torsoX + s.torsoW - 4;
  const rightEnd = rightStart + s.armW;
  return (
    `<rect x="${leftStart}" y="${cy - 8}" width="${s.armW}" height="16" rx="8" fill="#${skin}"/>` +
    `<rect x="${rightStart}" y="${cy - 8}" width="${s.armW}" height="16" rx="8" fill="#${skin}"/>` +
    `<circle cx="${leftStart + 2}" cy="${cy}" r="11" fill="#${skin}"/>` +
    `<circle cx="${rightEnd - 2}" cy="${cy}" r="11" fill="#${skin}"/>`
  );
}

function topShape(picks: AvatarPicks, key: ShapeKey): string {
  const feature = findItem('top', picks.top)?.feature ?? 'tee:e8e3d5:d4ccb8:short';
  const [type, fill = 'e8e3d5', shadow = 'd4ccb8', sub = 'short'] = feature.split(':');
  const s = SHAPE[key];
  const tx = s.torsoX;
  const tw = s.torsoW;
  const sh = Y.shoulderTop;
  const hb = Y.hipBottom;

  if (type === 'dress') {
    const hem = Y.bottomShortEnd + 4;
    const flareL = tx - 22;
    const flareR = tx + tw + 22;
    return (
      `<path d="M ${tx - 2} ${sh}` +
      ` Q ${tx - 2} ${sh - 6} ${tx + 6} ${sh - 6}` +
      ` L ${tx + tw - 6} ${sh - 6}` +
      ` Q ${tx + tw + 2} ${sh - 6} ${tx + tw + 2} ${sh}` +
      ` L ${flareR} ${hem}` +
      ` Q ${flareR} ${hem + 6} ${flareR - 6} ${hem + 6}` +
      ` L ${flareL + 6} ${hem + 6}` +
      ` Q ${flareL} ${hem + 6} ${flareL} ${hem}` +
      ` Z" fill="#${fill}"/>` +
      `<rect x="${flareL}" y="${hem - 4}" width="${flareR - flareL}" height="4" fill="#${shadow}" opacity="0.6"/>`
    );
  }

  // Sleeve coverage by sub: short stops near shoulder, 3q to mid-arm, long full-arm
  const sleevePadL = sub === 'long' ? 30 : sub === '3q' ? 50 : tx - 10;
  const sleevePadR = sub === 'long' ? 170 : sub === '3q' ? 150 : tx + tw + 10;
  const sleeveH = sub === 'long' || sub === '3q' ? 18 : 14;

  let hood = '';
  if (type === 'hoodie') {
    hood =
      `<path d="M ${tx + 8} ${sh - 2}` +
      ` Q 100 ${Y.neckTop - 22} ${tx + tw - 8} ${sh - 2} Z" fill="#${shadow}"/>`;
  }

  // Left sleeve patch (under torso, covers part of arm)
  const leftSleeveX = sleevePadL;
  const leftSleeveW = tx + 6 - leftSleeveX;
  const rightSleeveX = tx + tw - 6;
  const rightSleeveW = sleevePadR - rightSleeveX;

  const torsoPath =
    `M ${tx - 2} ${sh}` +
    ` Q ${tx - 2} ${sh - 6} ${tx + 6} ${sh - 6}` +
    ` L ${tx + tw - 6} ${sh - 6}` +
    ` Q ${tx + tw + 2} ${sh - 6} ${tx + tw + 2} ${sh}` +
    ` L ${tx + tw + s.hipFlare + 2} ${hb + 6}` +
    ` Q ${tx + tw + s.hipFlare + 2} ${hb + 10} ${tx + tw + s.hipFlare - 4} ${hb + 10}` +
    ` L ${tx - s.hipFlare + 4} ${hb + 10}` +
    ` Q ${tx - s.hipFlare - 2} ${hb + 10} ${tx - s.hipFlare - 2} ${hb + 6}` +
    ` Z`;

  return (
    `<rect x="${leftSleeveX}" y="${Y.armCenter - sleeveH / 2}" width="${leftSleeveW}" height="${sleeveH}" rx="${sleeveH / 2}" fill="#${shadow}"/>` +
    `<rect x="${rightSleeveX}" y="${Y.armCenter - sleeveH / 2}" width="${rightSleeveW}" height="${sleeveH}" rx="${sleeveH / 2}" fill="#${shadow}"/>` +
    `<path d="${torsoPath}" fill="#${fill}"/>` +
    hood
  );
}

function bottomShape(picks: AvatarPicks, key: ShapeKey): string {
  const feature = findItem('bottom', picks.bottom)?.feature ?? 'pants:3d6fa3:2a5283:long';
  const [type, fill = '3d6fa3', shadow = '2a5283', length = 'long'] = feature.split(':');
  const s = SHAPE[key];
  const isShort = length === 'short';
  const yEnd = isShort ? Y.bottomShortEnd : Y.bottomLongEnd;

  if (type === 'skirt') {
    const flareL = s.torsoX - 22;
    const flareR = s.torsoX + s.torsoW + 22;
    return (
      `<path d="M ${s.torsoX - s.hipFlare} ${Y.hipBottom - 2}` +
      ` L ${s.torsoX + s.torsoW + s.hipFlare} ${Y.hipBottom - 2}` +
      ` L ${flareR} ${Y.bottomShortEnd}` +
      ` Q ${flareR} ${Y.bottomShortEnd + 6} ${flareR - 6} ${Y.bottomShortEnd + 6}` +
      ` L ${flareL + 6} ${Y.bottomShortEnd + 6}` +
      ` Q ${flareL} ${Y.bottomShortEnd + 6} ${flareL} ${Y.bottomShortEnd}` +
      ` Z" fill="#${fill}"/>` +
      `<rect x="${flareL}" y="${Y.bottomShortEnd - 3}" width="${flareR - flareL}" height="3" fill="#${shadow}" opacity="0.6"/>`
    );
  }

  const legLeftX = 80;
  const legRightX = 102;
  const legW = 18;
  const h = yEnd - Y.hipBottom + 4;
  return (
    `<rect x="${legLeftX}" y="${Y.hipBottom - 2}" width="${legW}" height="${h}" rx="${legW / 2}" fill="#${fill}"/>` +
    `<rect x="${legRightX}" y="${Y.hipBottom - 2}" width="${legW}" height="${h}" rx="${legW / 2}" fill="#${fill}"/>` +
    `<rect x="${s.torsoX - s.hipFlare - 2}" y="${Y.hipBottom - 4}" width="${s.torsoW + 2 * s.hipFlare + 4}" height="6" rx="2" fill="#${shadow}"/>`
  );
}

function footwearShape(picks: AvatarPicks): string {
  const feature = findItem('footwear', picks.footwear)?.feature ?? 'shoes:f5f2ea:cfc7b5';
  const [, fill = 'f5f2ea', shadow = 'cfc7b5'] = feature.split(':');
  return (
    `<rect x="76" y="${Y.shoeTop}" width="26" height="${Y.shoeBottom - Y.shoeTop}" rx="7" fill="#${fill}"/>` +
    `<rect x="98" y="${Y.shoeTop}" width="26" height="${Y.shoeBottom - Y.shoeTop}" rx="7" fill="#${fill}"/>` +
    `<rect x="76" y="${Y.shoeBottom - 4}" width="26" height="4" rx="2" fill="#${shadow}"/>` +
    `<rect x="98" y="${Y.shoeBottom - 4}" width="26" height="4" rx="2" fill="#${shadow}"/>`
  );
}

function outerwearShape(picks: AvatarPicks, key: ShapeKey): string {
  const item = findItem('outerwear', picks.outerwear);
  if (!item || !item.feature) return '';
  const [, fill = '4a4340', shadow = '2d2826'] = item.feature.split(':');
  const s = SHAPE[key];
  const tx = s.torsoX;
  const tw = s.torsoW;
  const sh = Y.shoulderTop - 6;
  const hb = Y.hipBottom + 8;
  // Two flaps of equal width on each side; gap in the middle reveals top.
  const flapW = 16;
  return (
    `<path d="M ${tx - 4} ${sh} L ${tx + flapW} ${sh} L ${tx + flapW} ${hb} L ${tx - s.hipFlare - 4} ${hb} Z" fill="#${fill}"/>` +
    `<path d="M ${tx + tw + 4} ${sh} L ${tx + tw - flapW} ${sh} L ${tx + tw - flapW} ${hb} L ${tx + tw + s.hipFlare + 4} ${hb} Z" fill="#${fill}"/>` +
    `<line x1="${tx + flapW}" y1="${sh}" x2="${tx + flapW}" y2="${hb}" stroke="#${shadow}" stroke-width="1.5"/>` +
    `<line x1="${tx + tw - flapW}" y1="${sh}" x2="${tx + tw - flapW}" y2="${hb}" stroke="#${shadow}" stroke-width="1.5"/>`
  );
}

function holdingShape(picks: AvatarPicks, key: ShapeKey): string {
  const item = findItem('holding', picks.holding);
  if (!item || !item.feature) return '';
  const parts = item.feature.split(':');
  const obj = parts[parts.length - 1];
  const s = SHAPE[key];
  // Right hand position
  const cx = s.torsoX + s.torsoW - 4 + s.armW - 2;
  const cy = Y.armCenter + 4;
  switch (obj) {
    case 'book':
      return (
        `<rect x="${cx - 9}" y="${cy - 11}" width="18" height="22" rx="2" fill="#c45a4a"/>` +
        `<line x1="${cx}" y1="${cy - 11}" x2="${cx}" y2="${cy + 11}" stroke="#8a3d34" stroke-width="1"/>`
      );
    case 'ball':
      return (
        `<circle cx="${cx}" cy="${cy}" r="11" fill="#5BCEFA"/>` +
        `<path d="M ${cx - 9} ${cy} Q ${cx} ${cy - 7} ${cx + 9} ${cy}" stroke="#FFFFFF" fill="none" stroke-width="1.5"/>`
      );
    case 'phone':
      return (
        `<rect x="${cx - 7}" y="${cy - 12}" width="14" height="24" rx="3" fill="#2D2A4A"/>` +
        `<rect x="${cx - 5}" y="${cy - 9}" width="10" height="16" fill="#5BCEFA"/>`
      );
    case 'plant':
      return (
        `<rect x="${cx - 8}" y="${cy + 2}" width="16" height="11" rx="2" fill="#8a6a44"/>` +
        `<path d="M ${cx} ${cy + 2} Q ${cx - 12} ${cy - 8} ${cx - 4} ${cy - 16} Q ${cx + 4} ${cy - 16} ${cx + 12} ${cy - 8} Q ${cx + 4} ${cy + 2} ${cx} ${cy + 2}" fill="#5ea06a"/>`
      );
    case 'skateboard':
      return (
        `<rect x="${cx - 16}" y="${cy + 5}" width="32" height="6" rx="3" fill="#8a6a44"/>` +
        `<circle cx="${cx - 11}" cy="${cy + 13}" r="3" fill="#2D2A4A"/>` +
        `<circle cx="${cx + 11}" cy="${cy + 13}" r="3" fill="#2D2A4A"/>`
      );
    default:
      return '';
  }
}

// Wrap DiceBear's full <svg> as a positioned nested viewport. We keep its
// viewBox and override width/height/x/y so it fits the head slot in our outer
// canvas.
function wrapHead(headSvg: string): string {
  return headSvg.replace(
    /<svg\b[^>]*viewBox="([^"]+)"[^>]*>/,
    (_m, viewBox) => `<svg x="20" y="-10" width="160" height="160" viewBox="${viewBox}">`,
  );
}

export function composeAvatar(picks: AvatarPicks, headSvg: string): string {
  const skin = skinHex(picks);
  const key = shapeKey(picks);
  const head = wrapHead(headSvg);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" width="100%" height="100%">` +
    stage() +
    legs(skin) +
    neckAndTorso(skin, key) +
    arms(skin, key) +
    bottomShape(picks, key) +
    footwearShape(picks) +
    topShape(picks, key) +
    outerwearShape(picks, key) +
    head +
    holdingShape(picks, key) +
    `</svg>`
  );
}
