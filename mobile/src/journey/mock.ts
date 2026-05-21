// Date mock pt Faza 1 — pool de intrebari generice. Cand mutam pe backend:
// AI cheama 5 intrebari deodata din `pet.expertiseDomains` + cache.
//
// Shape-urile obstacolelor vin din WorldPack (per pet) — aici nu sunt
// hardcodate. Scena randeaza shape-ul pe care i-l dam noi (random din pool-ul
// world-ului), deci nu mai conteaza pet-ul cand scriem o intrebare.

export type JourneyOption = {
  label: string;
};

export type JourneyQuestion = {
  id: string;
  // Pet-ul cere ajutor in-world, strecurand intrebarea.
  prompt: string;
  options: JourneyOption[];
  correctIndex: number;
  successLine: string;
  failLine: string;
};

// Un obstacol concret pe drum = forma vizuala (din WorldPack) + intrebare.
export type JourneyObstacle = {
  id: string;
  // Cheia shape-ului din WorldPack.obstacles. Daca nu se gaseste, Scene
  // foloseste primul shape disponibil.
  shapeKey: string;
  question: JourneyQuestion;
};

export const MOCK_QUESTIONS: JourneyQuestion[] = [
  {
    id: 'q1',
    prompt: 'Aoleu, e ceva in cale! Ma ajuti — daca o impingem cu unghi mic, cum se cheama?',
    options: [{ label: 'Parghie' }, { label: 'Scripete' }, { label: 'Roata' }],
    correctIndex: 0,
    successLine: 'Eee! Parghie! Multumesc!',
    failLine: 'Hm, era parghia. Mergem mai departe, gasim alta!',
  },
  {
    id: 'q2',
    prompt: 'Ceva ma blocheaza! Stii cate inele are un copac in fiecare an?',
    options: [{ label: 'Unul' }, { label: 'Doua' }, { label: 'Niciunul' }],
    correctIndex: 0,
    successLine: 'Asa este, un inel pe an!',
    failLine: 'Era unul singur — asa se masoara varsta lor.',
  },
  {
    id: 'q3',
    prompt: 'Sta in calea noastra! Ce culoare are amestecul rosu si albastru?',
    options: [{ label: 'Verde' }, { label: 'Mov' }, { label: 'Portocaliu' }],
    correctIndex: 1,
    successLine: 'Mov! Stii culorile bine!',
    failLine: 'Era mov — rosu si albastru se amesteca in mov.',
  },
  {
    id: 'q4',
    prompt: 'Trebuie sa il trecem! Cate picioare are o paianjenita?',
    options: [{ label: 'Sase' }, { label: 'Opt' }, { label: 'Zece' }],
    correctIndex: 1,
    successLine: 'Opt! Acum putem trece!',
    failLine: 'Erau opt — de aia se misca asa de iute.',
  },
];
