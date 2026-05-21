// Tipuri pentru sistemul de povesti predefinite per pet.
//
// CUM ADAUGI UN PET NOU:
//   1. Creezi `mobile/src/journey/stories/<slug>.ts` cu un `StoryPack` care
//      apeleaza `registerStory(PACK)` la final
//   2. Adaugi un import in `stories/index.ts`: `import './<slug>';`
//
// Voce TTS:
//   - 'narrator' = voce generala (Edge/Eleven narator)
//   - 'pet'      = voce a pet-ului echipat (sau a vizitatorului — vezi mai jos)
//
// Visitor (encounter):
//   - 'random-friend' = backend trimite un pet al unui prieten aleatoriu;
//                       textele cu placeholders {friend} / {friendPet} sunt
//                       inlocuite la runtime; cand vizitatorul vorbeste,
//                       vocea folosita e a SPECIEI vizitatorului.
//   - 'fixed-yoda' etc. = vizitator fixat (legacy / NPC specific)
//
// Efecte vizuale (vfx) — scena reactioneaza la moment narativ. Optional pe
// orice scena de tip narrate / pet_says / encounter / challenge.

export type Voice = 'narrator' | 'pet';

// Efectul vizual aplicat scenei. Mobile interpreteaza si declanseaza animatii.
// Generice (camera/lumina):
//   - 'flash'    = alb-overlay scurt (fulger, lumina dramatica)
//   - 'shake'    = camera tremur scurt (izbire, impact)
//   - 'darken'   = scena se intuneca temporar (suspans, umbra)
//   - 'rumble'   = camera tremur usor prelungit (energie crescanda)
//   - 'zoom-in'  = scena se apropie usor (focus dramatic)
// Specifice (entitati care traverseaza scena — "se intampla fix ce zice"):
//   - 'meteor'      = un meteorit traverseaza cerul cu dara
//   - 'lightning'   = fulger ramificat + flash
//   - 'shooting-stars' = ploaie de stele cazatoare scurta
//   - 'dust-gust'   = rafala de praf/particule de la dreapta la stanga
//   - 'glow-pulse'  = un puls de lumina colorata din centru (relicva, cristal)
export type SceneVfx =
  | 'flash'
  | 'shake'
  | 'darken'
  | 'rumble'
  | 'zoom-in'
  | 'meteor'
  | 'lightning'
  | 'shooting-stars'
  | 'dust-gust'
  | 'glow-pulse';

export type SceneNarrate = {
  kind: 'narrate';
  id: string;
  text: string;
  voice?: Voice;
  vfx?: SceneVfx;
};

export type ScenePetSays = {
  kind: 'pet_says';
  id: string;
  text: string;
  vfx?: SceneVfx;
};

export type SceneChallenge = {
  kind: 'challenge';
  id: string;
  // Narator inainte de obstacol (acelasi pentru toata lumea).
  intro: string;
  // Forma vizuala in WorldPack.obstacles (rock, asteroid, palm_log, etc.).
  shapeKey: string;
  // Domeniul intrebarii — engine cere intrebari random de la backend pe acest
  // domain, filtrate dupa varsta copilului. Asa intrebarile difera intre copii.
  // Valori uzuale: 'spatiu' | 'ocean' | 'padure' | 'desert' | 'oras' | 'general'.
  domain: string;
  vfx?: SceneVfx;
};

// Pe `encounter`, dialogul foloseste placeholders:
//   {friend}     → numele prietenului
//   {friendPet}  → numele pet-ului prietenului
// Cand visitorMode='fixed' sunt ignorate.
export type EncounterDialogLine = {
  // 'visitor' = vizitatorul vorbeste cu VOCEA SPECIEI lui
  // 'pet'     = pet-ul tau vorbeste cu vocea proprie
  // 'narrator'= narator citeste
  speaker: 'visitor' | 'pet' | 'narrator';
  text: string;
};

export type SceneEncounter = {
  kind: 'encounter';
  id: string;
  // Daca 'random-friend' → mobile face fetch la /journey/random-friend. Daca un
  // slug concret (ex. 'yoda') → vizitator predefinit.
  visitorMode: 'random-friend' | string;
  intro: string;
  dialog: EncounterDialogLine[];
  outro: string;
  vfx?: SceneVfx;
  // Daca true, dupa dialog vizitatorul NU pleaca — ramane tovaras (companion)
  // langa pet si merge cu el prin scenele urmatoare, pana la o scena 'farewell'
  // sau pana la finalul capitolului. Default false (pleaca imediat ca acum).
  staysAsCompanion?: boolean;
};

// Tovarasul (companion) isi ia ramas bun si pleaca. Naratorul citeste textul,
// apoi companion-ul iese din scena.
export type SceneFarewell = {
  kind: 'farewell';
  id: string;
  text: string;
  vfx?: SceneVfx;
};

export type SceneCheckpoint = {
  kind: 'checkpoint';
  id: string;
  title: string;
  text: string;
  reward?: {
    bondXp?: number;
    backgroundKey?: string;
  };
  vfx?: SceneVfx;
};

export type Scene =
  | SceneNarrate
  | ScenePetSays
  | SceneChallenge
  | SceneEncounter
  | SceneFarewell
  | SceneCheckpoint;

export type Chapter = {
  id: string;
  title: string;
  biomeKey: string;
  scenes: Scene[];
  unlockAfter?: string;
  // Cinematic de deschidere jucat inainte de prima scena. Vezi IntroCinematic.
  introCinematic?: 'crash-pod' | 'warp-in' | 'walk-in';
};

export type StoryPack = {
  petSlug: string;
  title: string;
  chapters: Chapter[];
};
