// Punct unic de inregistrare a WorldPack-urilor.
//
// CUM ADAUGI UN PET NOU:
//   1. Creezi `mobile/src/journey/worlds/<slug>.ts` care:
//      - defineste un `WorldPack` cu slug=<slug>
//      - apeleaza `registerWorld(PACK)` la final (side-effect on import)
//   2. Adaugi UN SINGUR rand mai jos: `import './<slug>';`
//
// Atat. Daca uiti pasul 2 → pet-ul vede DEFAULT_WORLD automat (nu crapa).

import './darth-vader';
import './stitch';
import './yoda';
import './groot';
import './dog';

export { getWorldForPet, listRegisteredSlugs } from './registry';
export type { WorldPack, Biome, ObstacleShape, AmbientEntity } from './types';
