// Helper-uri pt WorldPack-uri. Tine-l mic, doar utilitati pure.

import type { Biome, WorldPack } from './types';

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

// Calculeaza biome-ul efectiv pe baza distantei parcurse. Logica:
//   - Fiecare biome "ocupa" `metersPerBiome` (de ex. 500m)
//   - 80% din timp ramane in biome-ul curent ("settled")
//   - In ultimii 20% face tranzitie smooth catre urmatorul
// Asta da senzatia ca lumea "se schimba treptat" la finalul fiecarui segment,
// nu un crossfade constant care nu lasa timp sa apreciezi vibe-ul curent.
export function computeEffectiveBiome(
  world: WorldPack,
  distance: number,
  metersPerBiome: number,
): Biome {
  const cycleLen = world.biomes.length;
  if (cycleLen === 1) return world.biomes[0];
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
  return lerpBiome(world.biomes[fromIdx], world.biomes[toIdx], smoothstep(tRaw));
}
