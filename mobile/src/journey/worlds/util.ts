// Helper-uri pt WorldPack-uri. Tine-l mic, doar utilitati pure.

import type { Biome, WorldPack } from './types';

// Rezultat compus pt UI — Scene foloseste asta ca sa randeze atat culorile
// interpolate cat si celestial-urile cross-fade.
export type BiomeTransition = {
  // Biome cu culori interpolate (sky/mid/ground/accent).
  effective: Biome;
  // Biome de la care plecam (full state, fara interpolare).
  from: Biome;
  // Biome catre care mergem (full state).
  to: Biome;
  // Progres tranzitie 0..1 (smoothstep aplicat).
  t: number;
};

const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// Mic ajustator pt nuante (mai inchis/mai deschis). Accepta hex "#RRGGBB".
export function shade(hex: string, amt: number): string {
  const [r, g, b] = parseHex(hex);
  const delta = Math.round(255 * amt);
  return `#${toHex(r + delta)}${toHex(g + delta)}${toHex(b + delta)}`;
}

// Interpoleaza liniar intre doua culori hex.
export function lerpColor(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return `#${toHex(ar + (br - ar) * t)}${toHex(ag + (bg - ag) * t)}${toHex(ab + (bb - ab) * t)}`;
}

// Smoothstep — ramp 0→1 cu derivata 0 la capete. Tranzitia se simte "easeInOut".
export function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

// Returneaza un Biome cu culorile interpolate intre a si b. Numele = a.name
// pana cand t >= 0.5, apoi b.name — caller-ul decide cum afiseaza.
export function lerpBiome(a: Biome, b: Biome, t: number): Biome {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return {
    key: `${a.key}~${b.key}`,
    name: t < 0.5 ? a.name : b.name,
    skyColor: lerpColor(a.skyColor, b.skyColor, t),
    midColor: lerpColor(a.midColor, b.midColor, t),
    groundColor: lerpColor(a.groundColor, b.groundColor, t),
    accent: lerpColor(a.accent, b.accent, t),
  };
}

// Calculeaza tranzitia de biome pe baza distantei parcurse. Logica:
//   - Fiecare biome "ocupa" `metersPerBiome` (de ex. 500m)
//   - 80% din timp ramane in biome-ul curent ("settled")
//   - In ultimii 20% face tranzitie smooth catre urmatorul
export function computeBiomeTransition(
  world: WorldPack,
  distance: number,
  metersPerBiome: number,
): BiomeTransition {
  const cycleLen = world.biomes.length;
  if (cycleLen === 1) {
    const only = world.biomes[0];
    return { effective: only, from: only, to: only, t: 0 };
  }
  const phase = distance / metersPerBiome;
  const phaseInCycle = ((phase % cycleLen) + cycleLen) % cycleLen;
  const fromIdx = Math.floor(phaseInCycle);
  const toIdx = (fromIdx + 1) % cycleLen;
  const localPhase = phaseInCycle - fromIdx;
  const TRANSITION_START = 0.8;
  const tRaw =
    localPhase < TRANSITION_START
      ? 0
      : (localPhase - TRANSITION_START) / (1 - TRANSITION_START);
  const t = smoothstep(tRaw);
  const from = world.biomes[fromIdx];
  const to = world.biomes[toIdx];
  return { effective: lerpBiome(from, to, t), from, to, t };
}
