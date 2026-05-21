// Tipuri pt WorldPack — config-ul lumii per specie de pet.
//
// Cum se foloseste:
//   1. Creezi un fisier `worlds/<slug>.ts` care exporta `WorldPack`
//   2. Adaugi 1 linie in `worlds/index.ts`: `import './<slug>';`
//
// Daca pet-ul nu are config dedicat, registry-ul foloseste DEFAULT_WORLD.
// Scene.tsx nu stie nimic specific despre pet — primeste un WorldPack si
// apeleaza render-functiile lui.

import type { ReactNode } from 'react';

// Corp ceresc afisat in cer (soare, luna, planeta). Pozitia se exprima ca
// fractie din latime/inaltime — [0..1, 0..1] cu (0,0) = top-left.
export type CelestialConfig = {
  shape: 'sun' | 'moon' | 'planet';
  color: string;
  position: [number, number];
  size: number;
};

export type Biome = {
  // Identificator intern (ex. "day", "night", "dusk").
  key: string;
  // Nume afisat pe ecran sub forma "Padurea linistita / Galaxia stelara".
  name: string;
  // Culorile principale ale stratelor.
  skyColor: string;
  midColor: string;
  groundColor: string;
  // Accent pt obstacole + speech bubble.
  accent: string;
  // Corp ceresc (optional). Cand biome-ul se transforma, Scene cross-fade-uieste
  // intre cel de la `fromBiome` si cel de la `toBiome`.
  celestial?: CelestialConfig;
};

// Props primite de render-functiile de strat. World-ul poate desena ce vrea
// — Scene ofera doar dimensiunile si culorile biome-ului curent.
export type LayerRenderProps = {
  width: number;
  height: number;
  color: string;
};

// Props primite de un render de obstacol.
export type ObstacleRenderProps = {
  width: number;
  height: number;
  color: string;
};

export type ObstacleShape = {
  // Identificator (ex. "rock", "asteroid", "coral"). Folosit ca shape key
  // in `mock.JourneyObstacle.shape`.
  key: string;
  render: (props: ObstacleRenderProps) => ReactNode;
};

// Entitati care plutesc prin scena ca ambient (pasari, stele, fluturi).
// Densitatea (cati pe ecran simultan) + viteza + zona verticala definesc
// comportamentul; Scene face spawn/recycle automat.
export type AmbientEntity = {
  key: string;
  // Pe ce strat de adancime apare (afecteaza ordinea de randare).
  layer: 'back' | 'mid' | 'fore';
  // Cati pot fi pe ecran simultan (medie). Scene mentine cam atatia activi.
  density: number;
  // Banda verticala in care apar (fractiune din inaltimea ecranului, 0=sus, 1=jos).
  yRange: [number, number];
  // Marime in pixeli.
  sizeRange: [number, number];
  // Viteza orizontala in px/sec. Negativ = se misca stanga (pet merge dreapta);
  // pozitiv = se misca dreapta. Random uniform intre min si max.
  speedRange: [number, number];
  render: (props: { size: number }) => ReactNode;
};

export type WorldPack = {
  // Slug = trebuie sa coincida cu PetSpecies.slug ca registry sa-l gaseasca.
  // "default" e fallback-ul pt orice pet fara config dedicat.
  slug: string;
  // Nume world afisat pe ecran (ex. "Padurea linistita").
  name: string;
  // Biome-uri suportate (zi, noapte, dusk). Trec ciclic pe distanta.
  biomes: Biome[];
  // Obstacolele tipice lumii. Mock-ul/AI-ul aleg dupa `key` cand creeaza un
  // JourneyObstacle.
  obstacles: ObstacleShape[];
  // Entitati care plutesc prin scena ca decoratiune ambient.
  ambient: AmbientEntity[];
  // Render-functii pt straturile vizuale — fiecare lume isi face siluetele.
  // CRUCIAL: tile-urile trebuie sa fie SEAMLESS (start si end vizual identice).
  renderMidLayer: (props: LayerRenderProps) => ReactNode;
  renderGroundLayer: (props: LayerRenderProps) => ReactNode;
  renderCloudsLayer?: (props: { width: number; height: number }) => ReactNode;
  // Strat parallax extra in spate (munti departe, silueta foarte ploata) —
  // optional. Se misca la 0.18x viteza solului → adauga depth fara overhead.
  renderBackLayer?: (props: LayerRenderProps) => ReactNode;
  // Meta narativ — daca lipseste, AI naratorul foloseste PetSpecies din DB.
  narrator?: {
    toneOverride?: string;
    domainOverride?: string;
  };
};
