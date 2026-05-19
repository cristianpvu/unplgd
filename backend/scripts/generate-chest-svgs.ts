// Genereaza fisierele SVG pentru chesturi in `backend/assets/chests/`.
// Ruleaza o data dupa adaugare tier nou sau modificare template:
//   npx tsx scripts/generate-chest-svgs.ts
//
// Dupa generare seed.ts citeste fisierele si scrie continutul in DB
// (ChestTierConfig.miniSvg / bodySvg / lidSvg).

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'assets', 'chests');

type TierColors = {
  bg: string;
  dark: string;
  fg: string;
  glow: string;
  bodyTop: string;
  bodyBot: string;
  metal: string;
  metalDark: string;
  metalLight: string;
  gem: string | null;
  gemHi: string;
  crown: boolean;
  label: string;
  sortOrder: number;
};

const TIERS: Record<string, TierColors> = {
  BRONZE: {
    bg: '#C68B59', dark: '#6B3F1A', fg: '#FFF6E8', glow: '#FFD7A8',
    bodyTop: '#E4A974', bodyBot: '#8E5A2E',
    metal: '#A86C3A', metalDark: '#6B3F1A', metalLight: '#D9A37A',
    gem: null, gemHi: '#FFFFFF', crown: false,
    label: 'Bronz', sortOrder: 10,
  },
  SILVER: {
    bg: '#C0CBD4', dark: '#5F6F7B', fg: '#1F3344', glow: '#F0F5F9',
    bodyTop: '#DCE4EB', bodyBot: '#8A98A4',
    metal: '#8E9CA8', metalDark: '#5F6F7B', metalLight: '#C8D2DA',
    gem: '#E8F4FF', gemHi: '#FFFFFF', crown: false,
    label: 'Argint', sortOrder: 20,
  },
  GOLD: {
    bg: '#F2C744', dark: '#7A5A0E', fg: '#5B3F00', glow: '#FFEFA8',
    bodyTop: '#FFE070', bodyBot: '#B58A14',
    metal: '#D6A012', metalDark: '#7A5A0E', metalLight: '#FFD968',
    gem: '#FF6A6A', gemHi: '#FFD0D0', crown: false,
    label: 'Aur', sortOrder: 30,
  },
  PLATINUM: {
    bg: '#7FE0D0', dark: '#1F6358', fg: '#0C3F38', glow: '#C2FFF4',
    bodyTop: '#B4EFE3', bodyBot: '#3FA597',
    metal: '#3FA597', metalDark: '#1F6358', metalLight: '#7CD5C6',
    gem: '#3FE0FF', gemHi: '#E6FAFF', crown: false,
    label: 'Platina', sortOrder: 40,
  },
  DIAMOND: {
    bg: '#9AB3FF', dark: '#2B3F8E', fg: '#1B2870', glow: '#E2EAFF',
    bodyTop: '#C7D5FF', bodyBot: '#5A77D4',
    metal: '#5A77D4', metalDark: '#2B3F8E', metalLight: '#A8BAFF',
    gem: '#9DF5FF', gemHi: '#FFFFFF', crown: false,
    label: 'Diamant', sortOrder: 50,
  },
  CHAMPION: {
    bg: '#FF7A59', dark: '#7A2812', fg: '#FFFFFF', glow: '#FFD9C2',
    bodyTop: '#FFA888', bodyBot: '#C04A2D',
    metal: '#D6A012', metalDark: '#7A5A0E', metalLight: '#FFD968',
    gem: '#FF3A3A', gemHi: '#FFC8C8', crown: true,
    label: 'Campion', sortOrder: 60,
  },
};

function miniSvg(c: TierColors, tier: string): string {
  const gid = `mini-${tier}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 24" width="34" height="32" fill="none">
  <defs>
    <linearGradient id="${gid}-body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c.bodyTop}"/>
      <stop offset="1" stop-color="${c.bodyBot}"/>
    </linearGradient>
    <linearGradient id="${gid}-lid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c.bodyTop}"/>
      <stop offset="1" stop-color="${c.bg}"/>
    </linearGradient>
  </defs>
  <path d="M3 12 H23 V21 a1.5 1.5 0 0 1 -1.5 1.5 H4.5 A1.5 1.5 0 0 1 3 21 Z" fill="url(#${gid}-body)" stroke="${c.dark}" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M3 12 V8 a4 4 0 0 1 4 -4 h12 a4 4 0 0 1 4 4 v4 Z" fill="url(#${gid}-lid)" stroke="${c.dark}" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M3 12 H23" stroke="${c.dark}" stroke-width="1.4" stroke-linecap="round"/>
  <rect x="11" y="13.5" width="4" height="5" rx="0.6" fill="${c.metalDark}"/>
  <circle cx="13" cy="15.2" r="0.7" fill="${c.dark}"/>
  <path d="M6 8 a5 5 0 0 1 5 -3" stroke="${c.glow}" stroke-width="0.9" stroke-linecap="round" fill="none" opacity="0.85"/>
</svg>`;
}

function bodySvg(c: TierColors, tier: string): string {
  const gid = `body-${tier}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70" width="160" height="112" fill="none">
  <defs>
    <linearGradient id="${gid}-body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c.bodyTop}"/>
      <stop offset="0.5" stop-color="${c.bg}"/>
      <stop offset="1" stop-color="${c.bodyBot}"/>
    </linearGradient>
    <linearGradient id="${gid}-metal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c.metalLight}"/>
      <stop offset="0.5" stop-color="${c.metal}"/>
      <stop offset="1" stop-color="${c.metalDark}"/>
    </linearGradient>
    <radialGradient id="${gid}-keyhole" cx="0.5" cy="0.45" r="0.6">
      <stop offset="0" stop-color="${c.metalDark}"/>
      <stop offset="1" stop-color="#000000"/>
    </radialGradient>
  </defs>
  <path d="M4 4 H96 V60 a6 6 0 0 1 -6 6 H10 a6 6 0 0 1 -6 -6 Z" fill="url(#${gid}-body)" stroke="${c.dark}" stroke-width="2.2" stroke-linejoin="round"/>
  <rect x="2" y="56" width="96" height="9" rx="2" fill="url(#${gid}-metal)" stroke="${c.dark}" stroke-width="1.6"/>
  <circle cx="10" cy="60.5" r="1.6" fill="${c.metalLight}" stroke="${c.dark}" stroke-width="0.8"/>
  <circle cx="50" cy="60.5" r="1.6" fill="${c.metalLight}" stroke="${c.dark}" stroke-width="0.8"/>
  <circle cx="90" cy="60.5" r="1.6" fill="${c.metalLight}" stroke="${c.dark}" stroke-width="0.8"/>
  <rect x="6" y="4" width="8" height="56" fill="url(#${gid}-metal)" stroke="${c.dark}" stroke-width="1.4"/>
  <rect x="86" y="4" width="8" height="56" fill="url(#${gid}-metal)" stroke="${c.dark}" stroke-width="1.4"/>
  <circle cx="10" cy="10" r="1.4" fill="${c.metalLight}" stroke="${c.dark}" stroke-width="0.7"/>
  <circle cx="10" cy="30" r="1.4" fill="${c.metalLight}" stroke="${c.dark}" stroke-width="0.7"/>
  <circle cx="10" cy="50" r="1.4" fill="${c.metalLight}" stroke="${c.dark}" stroke-width="0.7"/>
  <circle cx="90" cy="10" r="1.4" fill="${c.metalLight}" stroke="${c.dark}" stroke-width="0.7"/>
  <circle cx="90" cy="30" r="1.4" fill="${c.metalLight}" stroke="${c.dark}" stroke-width="0.7"/>
  <circle cx="90" cy="50" r="1.4" fill="${c.metalLight}" stroke="${c.dark}" stroke-width="0.7"/>
  <rect x="42" y="20" width="16" height="22" rx="2" fill="url(#${gid}-metal)" stroke="${c.dark}" stroke-width="1.6"/>
  <circle cx="50" cy="28" r="2.4" fill="url(#${gid}-keyhole)" stroke="${c.dark}" stroke-width="0.8"/>
  <path d="M50 30 L48.5 36 H51.5 Z" fill="${c.dark}"/>
  <rect x="17" y="6" width="2.5" height="48" fill="${c.glow}" opacity="0.25" rx="1"/>
</svg>`;
}

function lidSvg(c: TierColors, tier: string): string {
  const gid = `lid-${tier}`;
  const gemBlock = c.gem
    ? `  <defs>
    <radialGradient id="${gid}-gem" cx="0.4" cy="0.35" r="0.7">
      <stop offset="0" stop-color="${c.gemHi}"/>
      <stop offset="0.5" stop-color="${c.gem}"/>
      <stop offset="1" stop-color="${c.dark}"/>
    </radialGradient>
  </defs>
  <ellipse cx="50" cy="22" rx="7" ry="9" fill="url(#${gid}-gem)" stroke="${c.dark}" stroke-width="1.4"/>
  <ellipse cx="48" cy="19" rx="2" ry="3" fill="${c.gemHi}" opacity="0.85"/>`
    : '';
  const crownBlock = c.crown
    ? `  <g transform="translate(0 1)">
    <path d="M40 5 L44 -1 L50 4 L56 -1 L60 5 L60 9 L40 9 Z" fill="${c.metal}" stroke="${c.dark}" stroke-width="1.4" stroke-linejoin="round"/>
    <circle cx="44" cy="1" r="1.6" fill="${c.gem ?? c.glow}" stroke="${c.dark}" stroke-width="0.7"/>
    <circle cx="50" cy="4.5" r="1.6" fill="${c.gem ?? c.glow}" stroke="${c.dark}" stroke-width="0.7"/>
    <circle cx="56" cy="1" r="1.6" fill="${c.gem ?? c.glow}" stroke="${c.dark}" stroke-width="0.7"/>
  </g>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" width="160" height="80" fill="none">
  <defs>
    <linearGradient id="${gid}-lid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c.bodyTop}"/>
      <stop offset="0.65" stop-color="${c.bg}"/>
      <stop offset="1" stop-color="${c.bodyBot}"/>
    </linearGradient>
    <linearGradient id="${gid}-metal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c.metalLight}"/>
      <stop offset="1" stop-color="${c.metalDark}"/>
    </linearGradient>
  </defs>
  <path d="M4 46 V22 a18 18 0 0 1 18 -18 h56 a18 18 0 0 1 18 18 v24 Z" fill="url(#${gid}-lid)" stroke="${c.dark}" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M6 14 a16 16 0 0 1 8 -10 H14 V46 H6 Z" fill="url(#${gid}-metal)" stroke="${c.dark}" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M94 14 a16 16 0 0 0 -8 -10 H86 V46 H94 Z" fill="url(#${gid}-metal)" stroke="${c.dark}" stroke-width="1.4" stroke-linejoin="round"/>
  <circle cx="10" cy="42" r="1.4" fill="${c.metalLight}" stroke="${c.dark}" stroke-width="0.7"/>
  <circle cx="90" cy="42" r="1.4" fill="${c.metalLight}" stroke="${c.dark}" stroke-width="0.7"/>
  <circle cx="10" cy="20" r="1.4" fill="${c.metalLight}" stroke="${c.dark}" stroke-width="0.7"/>
  <circle cx="90" cy="20" r="1.4" fill="${c.metalLight}" stroke="${c.dark}" stroke-width="0.7"/>
  <rect x="2" y="42" width="96" height="6" fill="url(#${gid}-metal)" stroke="${c.dark}" stroke-width="1.4"/>
  <path d="M18 16 a14 14 0 0 1 14 -10" stroke="${c.glow}" stroke-width="2.2" stroke-linecap="round" fill="none" opacity="0.85"/>
${gemBlock}
${crownBlock}
</svg>`;
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const metaRows: string[] = ['tier,label,sortOrder,bgColor,darkColor,fgColor,glowColor,miniSvgPath,bodySvgPath,lidSvgPath'];
  for (const [tier, c] of Object.entries(TIERS)) {
    const slug = tier.toLowerCase();
    writeFileSync(join(OUT_DIR, `${slug}-mini.svg`), miniSvg(c, tier));
    writeFileSync(join(OUT_DIR, `${slug}-body.svg`), bodySvg(c, tier));
    writeFileSync(join(OUT_DIR, `${slug}-lid.svg`), lidSvg(c, tier));
    metaRows.push(
      `${tier},${c.label},${c.sortOrder},${c.bg},${c.dark},${c.fg},${c.glow},${slug}-mini.svg,${slug}-body.svg,${slug}-lid.svg`,
    );
  }
  writeFileSync(join(OUT_DIR, '_meta.csv'), metaRows.join('\n') + '\n');
  console.log(`Wrote ${Object.keys(TIERS).length * 3} SVG files + _meta.csv in ${OUT_DIR}`);
}

main();
