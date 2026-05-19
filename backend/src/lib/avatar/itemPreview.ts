// Renderer pentru SVG izolat al unui Item — folosit la loot reveal pe mobil,
// ca itemul castigat sa zboare efectiv din cufar (nu doar text). Fiecare item
// e desenat in body coords (762×1400) si avem nevoie de un viewBox decupat
// strans pe zona unde e atasat: gat, mana, cap etc.
//
// Output: SVG self-contained cu fallback colors inline (SvgXml din RN nu
// rezolva `var(--xxx)`, asa ca regex-replace-uim cu valoarea default).

import { AttachmentPoint } from '@prisma/client';
import { ACCESSORY_PARTS, BODY_VIEWBOX } from './bodyAssets.js';

// ViewBox per zona de atasare — decupaj strans in body coords pe ce conteaza
// pentru fiecare slot. Folosit ca preview "card-size" in loot reveal.
const VIEWBOX_BY_ATTACHMENT: Record<AttachmentPoint, string> = {
  HEAD: '270 30 220 110',
  NECK: '300 640 170 130',
  HAND: '430 70 330 950',
  BACK: '180 540 410 420',
  FEET: '270 1240 220 170',
};

// Inlocuieste `var(--name, #fallback)` cu `#fallback` ca SvgXml pe RN sa
// randeze culorile corect (nu suporta CSS vars).
function inlineVars(svgFragment: string): string {
  return svgFragment.replace(
    /var\(--[a-zA-Z0-9_-]+,\s*([^)]+)\)/g,
    (_match, fallback: string) => fallback.trim(),
  );
}

export function renderItemPreviewSvg(item: {
  feature: string | null;
  attachmentPoint: AttachmentPoint | null;
}): { svg: string; viewBox: string } | null {
  if (!item.feature || !item.attachmentPoint) return null;
  const fragment = ACCESSORY_PARTS[item.feature];
  if (!fragment) return null;
  const viewBox = VIEWBOX_BY_ATTACHMENT[item.attachmentPoint];
  const inner = inlineVars(fragment);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100" height="100">${inner}</svg>`;
  return { svg, viewBox };
}

export { BODY_VIEWBOX };
