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
//
// HAND-urile (balon, zmeu) sunt desenate sus, deasupra capului (cca y=50-310).
// Decupajul HAND e ales sa cuprinda DOAR partea distinctiva (varful balonului/
// zmeului), nu si sfoara care urca pana la pumn — altfel imaginea apare goala
// cu o linie subtire in stanga. Sfoara ramane in avatarul mare (composer), aici
// ne intereseaza doar "obiectul cucerit".
const VIEWBOX_BY_ATTACHMENT: Record<AttachmentPoint, string> = {
  HEAD: '270 30 220 110',
  NECK: '300 630 180 150',
  HAND: '540 40 240 290',
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
  if (!viewBox) return null;
  const inner = inlineVars(fragment);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100" height="100">${inner}</svg>`;
  return { svg, viewBox };
}

export { BODY_VIEWBOX };
