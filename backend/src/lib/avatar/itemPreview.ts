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

// Override per feature pentru cazurile in care decupajul generic pe
// attachmentPoint nu cuprinde corect itemul (forme atipice). Cheia = id-ul
// din ACCESSORY_PARTS (feature inainte de `:`). Daca lipseste, cadem pe
// VIEWBOX_BY_ATTACHMENT.
//
// kite: rombul are y=180..420 (stroke-uri incluse), nu incape in HAND-ul
// default (y=40..330) si jumatate de jos se taie. Extindem vertical si
// shift-uim x ca diamantul (centre 655, 300) sa fie central.
const VIEWBOX_BY_FEATURE: Record<string, string> = {
  kite: '540 160 220 280',
};

// Inlocuieste `var(--name, #fallback)` cu `#fallback` ca SvgXml pe RN sa
// randeze culorile corect (nu suporta CSS vars).
function inlineVars(svgFragment: string): string {
  return svgFragment.replace(
    /var\(--[a-zA-Z0-9_-]+,\s*([^)]+)\)/g,
    (_match, fallback: string) => fallback.trim(),
  );
}

// Translateaza toate coord-urile dintr-un fragment SVG cu (-dx, -dy). Necesar
// pentru react-native-svg care are bug-uri silentioase cu viewBox cu origin
// non-zero SI cu <g transform>. Rescriem coords direct ca primitive plain.
// Suporta: circle (cx/cy), ellipse (cx/cy), rect (x/y), line (x1/y1/x2/y2),
// polygon/polyline (points), path (d cu M/L/Q/C/A/Z absolute si m/l/q/c/a/z
// relative — nu translateAm comenzile lowercase, deja sunt relative).
function translateFragment(svg: string, dx: number, dy: number): string {
  // Atribute simple X (cx, x, x1, x2) si Y (cy, y, y1, y2). Word boundary
  // `\b` previne match in mijlocul altui atribut (rx, ry, opacity).
  let out = svg.replace(/\b(c?x|x[12])\s*=\s*"([-\d.]+)"/g, (_m, k: string, v: string) =>
    `${k}="${(parseFloat(v) + dx).toString()}"`,
  );
  out = out.replace(/\b(c?y|y[12])\s*=\s*"([-\d.]+)"/g, (_m, k: string, v: string) =>
    `${k}="${(parseFloat(v) + dy).toString()}"`,
  );
  // points="x1,y1 x2,y2 ..." (cu virgule sau spatii).
  out = out.replace(/points\s*=\s*"([^"]+)"/g, (_m, pts: string) => {
    const tokens = pts.trim().split(/[\s,]+/);
    const translated = tokens.map((t, i) =>
      i % 2 === 0 ? (parseFloat(t) + dx).toString() : (parseFloat(t) + dy).toString(),
    );
    const pairs: string[] = [];
    for (let i = 0; i < translated.length; i += 2) {
      pairs.push(`${translated[i]},${translated[i + 1]}`);
    }
    return `points="${pairs.join(' ')}"`;
  });
  // path d="M x y L x y Q cx cy x y ...". Translateaza doar comenzi absolute
  // (uppercase); ignoram comenzi relative (deja relative la cursor).
  out = out.replace(/d\s*=\s*"([^"]+)"/g, (_m, d: string) => {
    const tokens = d.match(/[a-zA-Z]|-?\d+\.?\d*|\.\d+/g) ?? [];
    const result: string[] = [];
    let cmd: string | null = null;
    let coordIdx = 0;
    for (const tok of tokens) {
      if (/^[a-zA-Z]$/.test(tok)) {
        cmd = tok;
        coordIdx = 0;
        result.push(tok);
        continue;
      }
      const num = parseFloat(tok);
      // Pentru comenzi absolute (uppercase), parii sunt (x,y); A are
      // 7 parametri (rx ry rot largeArc sweep x y) — translateAm doar ultimii 2.
      // H = X-only, V = Y-only. Comenzi lowercase ignorate (relative).
      let translated = num;
      if (cmd && cmd === cmd.toUpperCase()) {
        if (cmd === 'A' || cmd === 'a') {
          // A: rx ry x-axis-rotation large-arc sweep x y — translate doar idx 5,6
          if (coordIdx === 5) translated = num + dx;
          else if (coordIdx === 6) translated = num + dy;
        } else if (cmd === 'H') {
          translated = num + dx;
        } else if (cmd === 'V') {
          translated = num + dy;
        } else {
          // M, L, T (x y); Q, S (x1 y1 x y); C (x1 y1 x2 y2 x y)
          translated = coordIdx % 2 === 0 ? num + dx : num + dy;
        }
      }
      result.push(translated.toString());
      coordIdx++;
    }
    // Re-emit cu separator " " — match-uri SVG paths standard.
    return `d="${result.join(' ').replace(/ ([a-zA-Z])/g, '$1').replace(/([a-zA-Z])/g, ' $1 ').trim()}"`;
  });
  return out;
}

export function renderItemPreviewSvg(item: {
  feature: string | null;
  attachmentPoint: AttachmentPoint | null;
}): { svg: string; viewBox: string } | null {
  if (!item.feature || !item.attachmentPoint) return null;
  const fragment = ACCESSORY_PARTS[item.feature];
  if (!fragment) return null;
  const featureId = item.feature.split(':')[0] ?? '';
  const vbStr = VIEWBOX_BY_FEATURE[featureId] ?? VIEWBOX_BY_ATTACHMENT[item.attachmentPoint];
  if (!vbStr) return null;
  const [x, y, w, h] = vbStr.split(/\s+/).map(Number);
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof w !== 'number' ||
    typeof h !== 'number'
  ) {
    return null;
  }
  // react-native-svg pe Android are bug-uri silentioase atat cu viewBox cu
  // origin non-zero, cat si cu <g transform>. Solutie portabila: rescriem
  // coords-urile direct, scoatem origin la 0,0.
  const inner = inlineVars(fragment);
  const translated = translateFragment(inner, -x, -y);
  const viewBox = `0 0 ${w} ${h}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100" height="100">${translated}</svg>`;
  return { svg, viewBox };
}

export { BODY_VIEWBOX };
