// Punct de inregistrare a StoryPack-urilor.
//
// CUM ADAUGI UN PET NOU:
//   1. Creezi `mobile/src/journey/stories/<slug>.ts` cu un StoryPack +
//      `registerStory(PACK)` la final
//   2. Adaugi un import aici: `import './<slug>';`
//
// Daca un pet nu are inca povesti, mobile arata mesaj "in curand" si poate
// merge prin lume fara obstacole/encounters.

import './darth-vader';
import './stitch';
import './yoda';
import './groot';
import './dog';

export { getStoryForPet, listStorySlugs } from './registry';
export type {
  Scene,
  SceneNarrate,
  ScenePetSays,
  SceneChallenge,
  SceneEncounter,
  SceneCheckpoint,
  Chapter,
  StoryPack,
  Voice,
} from './types';
