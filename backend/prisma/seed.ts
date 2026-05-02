// Seed pentru catalogul de iteme avatar. Idempotent: ruleaza la deploy / dupa
// `prisma migrate`. Slug-urile sunt identificatori stabili — daca redenumesti
// un slug, contractele cu mobile se rup. Adauga iteme noi cu slug nou.
//
// Datele de stil (fata) referentiaza DiceBear "Adventurer" by Lisa Wischofsky
// (CC BY 4.0). Corpul, hainele si economia level-gated sunt originale.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type SeedItem = {
  slug: string;
  name: string;
  feature: string | null;
  level: number;
};

type SeedType = {
  slug: string;
  name: string;
  group: 'face' | 'body';
  items: SeedItem[];
};

const TYPES: SeedType[] = [
  {
    slug: 'skin',
    name: 'Ten',
    group: 'face',
    items: [
      { slug: 'skin-01', feature: 'f2d3b1', name: 'Alabastru', level: 1 },
      { slug: 'skin-02', feature: 'ecad80', name: 'Nisip', level: 1 },
      { slug: 'skin-03', feature: 'c99c72', name: 'Miere', level: 1 },
      { slug: 'skin-04', feature: '9e5622', name: 'Scortisoara', level: 1 },
      { slug: 'skin-05', feature: '763900', name: 'Cacao', level: 1 },
      { slug: 'skin-06', feature: '614335', name: 'Espresso', level: 1 },
    ],
  },
  {
    slug: 'hairColor',
    name: 'Culoare par',
    group: 'face',
    items: [
      { slug: 'hc-01', feature: '0e0e0e', name: 'Negru', level: 1 },
      { slug: 'hc-02', feature: '6a4e35', name: 'Saten', level: 1 },
      { slug: 'hc-03', feature: 'cb6820', name: 'Portocaliu', level: 1 },
      { slug: 'hc-04', feature: 'a55728', name: 'Roscat', level: 1 },
      { slug: 'hc-05', feature: 'e5d7a3', name: 'Blond', level: 1 },
      { slug: 'hc-06', feature: 'ab2a18', name: 'Rosu aprins', level: 5 },
      { slug: 'hc-07', feature: '85c2c6', name: 'Menta', level: 10 },
      { slug: 'hc-08', feature: 'dba3be', name: 'Roz', level: 10 },
    ],
  },
  {
    slug: 'hair',
    name: 'Coafura',
    group: 'face',
    items: [
      { slug: 'h-01', feature: 'short01', name: 'Tuns scurt', level: 1 },
      { slug: 'h-02', feature: 'short02', name: 'Volum classic', level: 1 },
      { slug: 'h-03', feature: 'short03', name: 'Mot frontal', level: 1 },
      { slug: 'h-04', feature: 'short04', name: 'Suvita lejera', level: 1 },
      { slug: 'h-05', feature: 'short05', name: 'Curly afro', level: 1 },
      { slug: 'h-06', feature: 'short06', name: 'Bucle stranse', level: 5 },
      { slug: 'h-07', feature: 'short07', name: 'Unda relaxata', level: 1 },
      { slug: 'h-08', feature: 'short10', name: 'Spikey', level: 5 },
      { slug: 'h-09', feature: 'short15', name: 'Perie sus', level: 10 },
      { slug: 'h-10', feature: 'short18', name: 'Undercut', level: 10 },
      { slug: 'h-11', feature: 'long01', name: 'Lung drept', level: 1 },
      { slug: 'h-12', feature: 'long02', name: 'Lung cu breton', level: 1 },
      { slug: 'h-13', feature: 'long03', name: 'Coada', level: 5 },
      { slug: 'h-14', feature: 'long05', name: 'Codite', level: 5 },
      { slug: 'h-15', feature: 'long09', name: 'Bob', level: 1 },
      { slug: 'h-16', feature: 'long12', name: 'Coc', level: 10 },
      { slug: 'h-17', feature: 'long16', name: 'Impletitura', level: 10 },
      { slug: 'h-18', feature: 'long20', name: 'Val lung', level: 20 },
      { slug: 'h-19', feature: 'long25', name: 'Ondulat', level: 20 },
    ],
  },
  {
    slug: 'eyes',
    name: 'Ochi',
    group: 'face',
    items: [
      { slug: 'e-01', feature: 'variant01', name: 'Rotund', level: 1 },
      { slug: 'e-02', feature: 'variant02', name: 'Bland', level: 1 },
      { slug: 'e-03', feature: 'variant03', name: 'Veselie', level: 1 },
      { slug: 'e-04', feature: 'variant07', name: 'Curios', level: 1 },
      { slug: 'e-05', feature: 'variant12', name: 'Obosit', level: 5 },
      { slug: 'e-06', feature: 'variant15', name: 'Sideways', level: 5 },
      { slug: 'e-07', feature: 'variant19', name: 'Serios', level: 10 },
      { slug: 'e-08', feature: 'variant22', name: 'Clipit', level: 10 },
      { slug: 'e-09', feature: 'variant26', name: 'Scanteietor', level: 20 },
    ],
  },
  {
    slug: 'mouth',
    name: 'Gura',
    group: 'face',
    items: [
      { slug: 'm-01', feature: 'variant01', name: 'Zambet mic', level: 1 },
      { slug: 'm-02', feature: 'variant05', name: 'Fericire', level: 1 },
      { slug: 'm-03', feature: 'variant10', name: 'Serios', level: 1 },
      { slug: 'm-04', feature: 'variant14', name: 'Surpriza', level: 5 },
      { slug: 'm-05', feature: 'variant18', name: 'Limba', level: 5 },
      { slug: 'm-06', feature: 'variant22', name: 'Dinti', level: 10 },
      { slug: 'm-07', feature: 'variant26', name: 'Buze', level: 10 },
      { slug: 'm-08', feature: 'variant30', name: 'Ras mare', level: 20 },
    ],
  },
  {
    slug: 'eyebrows',
    name: 'Sprancene',
    group: 'face',
    items: [
      { slug: 'b-01', feature: 'variant01', name: 'Naturale', level: 1 },
      { slug: 'b-02', feature: 'variant05', name: 'Arcuite', level: 1 },
      { slug: 'b-03', feature: 'variant08', name: 'Groase', level: 1 },
      { slug: 'b-04', feature: 'variant12', name: 'Subtiri', level: 5 },
      { slug: 'b-05', feature: 'variant15', name: 'Ridicate', level: 10 },
    ],
  },
  {
    slug: 'glasses',
    name: 'Ochelari',
    group: 'face',
    items: [
      { slug: 'g-00', feature: null, name: 'Fara', level: 1 },
      { slug: 'g-01', feature: 'variant01', name: 'Rotunzi', level: 5 },
      { slug: 'g-02', feature: 'variant03', name: 'Aviator', level: 10 },
      { slug: 'g-03', feature: 'variant05', name: 'Smart', level: 20 },
    ],
  },
  {
    slug: 'earrings',
    name: 'Cercei',
    group: 'face',
    items: [
      { slug: 'a-00', feature: null, name: 'Fara', level: 1 },
      { slug: 'a-01', feature: 'variant01', name: 'Mic', level: 5 },
      { slug: 'a-02', feature: 'variant03', name: 'Picatura', level: 10 },
      { slug: 'a-03', feature: 'variant05', name: 'Statement', level: 30 },
    ],
  },
  {
    slug: 'bodyShape',
    name: 'Corp',
    group: 'body',
    items: [
      { slug: 'bs-slim', feature: 'slim', name: 'Zvelt', level: 1 },
      { slug: 'bs-medium', feature: 'medium', name: 'Mediu', level: 1 },
      { slug: 'bs-robust', feature: 'robust', name: 'Robust', level: 1 },
    ],
  },
  {
    slug: 'top',
    name: 'Tricou',
    group: 'body',
    items: [
      { slug: 't-01', feature: 'tee:e8e3d5:d4ccb8:short', name: 'Tricou alb', level: 1 },
      { slug: 't-02', feature: 'tee:3d6fa3:2a5283:short', name: 'Tricou albastru', level: 1 },
      { slug: 't-03', feature: 'tee:c45a4a:8a3d34:short', name: 'Tricou rosu', level: 1 },
      { slug: 't-04', feature: 'tee:5ea06a:3e7a4a:short', name: 'Tricou verde', level: 1 },
      { slug: 't-05', feature: 'tee:f0c24a:c29832:long', name: 'Bluza galbena', level: 1 },
      { slug: 't-06', feature: 'tee:e89bb5:c47894:3q', name: 'Bluza roz', level: 5 },
      { slug: 't-07', feature: 'hoodie:6b8aa8:4f6b85', name: 'Hanorac albastru', level: 5 },
      { slug: 't-08', feature: 'hoodie:4a4a4a:2e2e2e', name: 'Hanorac gri', level: 10 },
      { slug: 't-09', feature: 'dress:e89bb5:c47894', name: 'Rochie roz', level: 10 },
      { slug: 't-10', feature: 'dress:7a9fd8:5578b5', name: 'Rochie albastra', level: 20 },
    ],
  },
  {
    slug: 'outerwear',
    name: 'Jacheta',
    group: 'body',
    items: [
      { slug: 'ow-00', feature: null, name: 'Fara', level: 1 },
      { slug: 'ow-01', feature: 'vest:4a4340:2d2826', name: 'Vesta inchisa', level: 5 },
      { slug: 'ow-02', feature: 'vest:8a6a44:5d4528', name: 'Vesta maro', level: 10 },
      { slug: 'ow-03', feature: 'vest:5a7a5a:3a5a3a', name: 'Vesta verde', level: 20 },
    ],
  },
  {
    slug: 'bottom',
    name: 'Pantaloni',
    group: 'body',
    items: [
      { slug: 'b-01', feature: 'pants:3d6fa3:2a5283:long', name: 'Blugi', level: 1 },
      { slug: 'b-02', feature: 'pants:4a4340:2d2826:long', name: 'Pantaloni negri', level: 1 },
      { slug: 'b-03', feature: 'pants:8a6a44:5d4528:long', name: 'Pantaloni bej', level: 1 },
      { slug: 'b-04', feature: 'pants:3d6fa3:2a5283:short', name: 'Pantaloni scurti', level: 5 },
      { slug: 'b-05', feature: 'skirt:a85a7a:7a3e5a', name: 'Fusta roz', level: 5 },
      { slug: 'b-06', feature: 'skirt:4a5a8a:2e3d6a', name: 'Fusta plisata', level: 10 },
      { slug: 'b-07', feature: 'pants:c45a4a:8a3d34:long', name: 'Trening rosu', level: 10 },
    ],
  },
  {
    slug: 'footwear',
    name: 'Incaltaminte',
    group: 'body',
    items: [
      { slug: 'fw-01', feature: 'shoes:f5f2ea:cfc7b5', name: 'Sneakers albi', level: 1 },
      { slug: 'fw-02', feature: 'shoes:4a4340:2d2826', name: 'Adidasi negri', level: 1 },
      { slug: 'fw-03', feature: 'shoes:c45a4a:8a3d34', name: 'Pantofi rosii', level: 5 },
      { slug: 'fw-04', feature: 'boots:8a6a44:5d4528', name: 'Ghete', level: 10 },
      { slug: 'fw-05', feature: 'shoes:5ea06a:3e7a4a', name: 'Adidasi verzi', level: 10 },
    ],
  },
  {
    slug: 'holding',
    name: 'In mana',
    group: 'body',
    items: [
      { slug: 'hd-00', feature: null, name: 'Mana libera', level: 1 },
      { slug: 'hd-01', feature: 'hand::::book', name: 'Carte', level: 5 },
      { slug: 'hd-02', feature: 'hand::::ball', name: 'Minge', level: 5 },
      { slug: 'hd-03', feature: 'hand::::phone', name: 'Telefon', level: 10 },
      { slug: 'hd-04', feature: 'hand::::plant', name: 'Planta', level: 20 },
      { slug: 'hd-05', feature: 'hand::::skateboard', name: 'Skateboard', level: 30 },
    ],
  },
];

// Pet species — catalog pentru AI buddy. MVP: doar caine "Buddy" (default).
// Iteratiile viitoare adauga pisica, dragon etc. cu voci distincte.
// `voiceId` = identificator Microsoft Edge TTS (ro-RO neural voices).
type SeedSpecies = {
  slug: string;
  name: string;
  voiceId: string;
  systemHint: string;
  isDefault: boolean;
};

type SeedChallenge = {
  slug: string;
  type: 'mcq' | 'counting';
  prompt: string;
  expected: string;
  // Pentru mcq: 4 variante (inclusiv expected). Ordinea storata e aleatorie —
  // routes/hunt.ts oricum face shuffle stabil per run inainte sa trimita.
  options?: string[];
  ageMin: number;
  ageMax: number;
  themeTags?: string;
  difficulty?: number;
};

// Bank de challenge-uri pentru hunt. MCQ cu cultura generala adaptat varstei
// + counting (interactiv). Slug-urile sunt stabile — la re-seed, prompt-ul
// se updateaza dar id-ul DB ramane (idempotent).
const CHALLENGES: SeedChallenge[] = [
  // ===== MCQ age 6-9 (difficulty 1) — cultura generala basic =====
  { slug: 'q-a69-001', type: 'mcq', prompt: 'Care e capitala Romaniei?', options: ['Bucuresti', 'Cluj', 'Iasi', 'Brasov'], expected: 'Bucuresti', ageMin: 6, ageMax: 9, difficulty: 1, themeTags: 'geografie' },
  { slug: 'q-a69-002', type: 'mcq', prompt: 'Cate zile are o saptamana?', options: ['5', '6', '7', '8'], expected: '7', ageMin: 6, ageMax: 9, difficulty: 1 },
  { slug: 'q-a69-003', type: 'mcq', prompt: 'Cate luni are un an?', options: ['10', '11', '12', '13'], expected: '12', ageMin: 6, ageMax: 9, difficulty: 1 },
  { slug: 'q-a69-004', type: 'mcq', prompt: 'Cate picioare are un paianjen?', options: ['6', '8', '10', '4'], expected: '8', ageMin: 6, ageMax: 9, difficulty: 1, themeTags: 'animale' },
  { slug: 'q-a69-005', type: 'mcq', prompt: 'Ce culoare obtii daca amesteci galben cu albastru?', options: ['Verde', 'Portocaliu', 'Maro', 'Roz'], expected: 'Verde', ageMin: 6, ageMax: 9, difficulty: 1 },
  { slug: 'q-a69-006', type: 'mcq', prompt: 'Ce numar urmeaza dupa 99?', options: ['90', '99', '100', '101'], expected: '100', ageMin: 6, ageMax: 9, difficulty: 1 },
  { slug: 'q-a69-007', type: 'mcq', prompt: 'In ce anotimp ninge?', options: ['Vara', 'Primavara', 'Toamna', 'Iarna'], expected: 'Iarna', ageMin: 6, ageMax: 9, difficulty: 1 },
  { slug: 'q-a69-008', type: 'mcq', prompt: 'Cine e numit "regele junglei"?', options: ['Tigrul', 'Leul', 'Lupul', 'Ursul'], expected: 'Leul', ageMin: 6, ageMax: 9, difficulty: 1, themeTags: 'animale' },
  { slug: 'q-a69-009', type: 'mcq', prompt: 'Cati ochi are o pisica?', options: ['1', '2', '3', '4'], expected: '2', ageMin: 6, ageMax: 9, difficulty: 1, themeTags: 'animale' },
  { slug: 'q-a69-010', type: 'mcq', prompt: 'Cum se numeste casuta cainelui?', options: ['Cuibul', 'Cusca', 'Petera', 'Borta'], expected: 'Cusca', ageMin: 6, ageMax: 9, difficulty: 1, themeTags: 'animale' },
  { slug: 'q-a69-011', type: 'mcq', prompt: 'Care e cea mai mare planeta din sistemul solar?', options: ['Pamant', 'Marte', 'Jupiter', 'Venus'], expected: 'Jupiter', ageMin: 6, ageMax: 9, difficulty: 1, themeTags: 'cer,stiinta' },
  { slug: 'q-a69-012', type: 'mcq', prompt: 'Ce sunet face vaca?', options: ['Miau', 'Cucurigu', 'Muu', 'Hau'], expected: 'Muu', ageMin: 6, ageMax: 9, difficulty: 1, themeTags: 'animale' },
  { slug: 'q-a69-013', type: 'mcq', prompt: 'Cati metri are un kilometru?', options: ['10', '100', '1000', '10000'], expected: '1000', ageMin: 6, ageMax: 9, difficulty: 1 },
  { slug: 'q-a69-014', type: 'mcq', prompt: 'Cati pitici are Alba ca Zapada?', options: ['5', '6', '7', '8'], expected: '7', ageMin: 6, ageMax: 9, difficulty: 1 },
  { slug: 'q-a69-015', type: 'mcq', prompt: 'Ce culoare are cerul senin?', options: ['Verde', 'Albastru', 'Roz', 'Galben'], expected: 'Albastru', ageMin: 6, ageMax: 9, difficulty: 1 },
  { slug: 'q-a69-016', type: 'mcq', prompt: 'Cati ani are un secol?', options: ['10', '50', '100', '1000'], expected: '100', ageMin: 6, ageMax: 9, difficulty: 1 },
  { slug: 'q-a69-017', type: 'mcq', prompt: 'Cate roti are o bicicleta?', options: ['1', '2', '3', '4'], expected: '2', ageMin: 6, ageMax: 9, difficulty: 1, themeTags: 'transport' },
  { slug: 'q-a69-018', type: 'mcq', prompt: 'Ce face albina?', options: ['Lapte', 'Miere', 'Branza', 'Unt'], expected: 'Miere', ageMin: 6, ageMax: 9, difficulty: 1, themeTags: 'animale' },
  { slug: 'q-a69-019', type: 'mcq', prompt: 'Care e cea mai mica unitate de timp?', options: ['Ora', 'Minutul', 'Secunda', 'Ziua'], expected: 'Secunda', ageMin: 6, ageMax: 9, difficulty: 1 },
  { slug: 'q-a69-020', type: 'mcq', prompt: 'Cum se numeste puiul cainelui?', options: ['Catelus', 'Pisoi', 'Pui', 'Manz'], expected: 'Catelus', ageMin: 6, ageMax: 9, difficulty: 1, themeTags: 'animale' },

  // ===== MCQ age 10-14 (difficulty 2-3) — cultura generala avansata =====
  { slug: 'q-a14-001', type: 'mcq', prompt: 'Cine a scris "Amintiri din copilarie"?', options: ['Mihai Eminescu', 'Ion Creanga', 'I.L. Caragiale', 'Mihail Sadoveanu'], expected: 'Ion Creanga', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'romana' },
  { slug: 'q-a14-002', type: 'mcq', prompt: 'In ce an a inceput Al Doilea Razboi Mondial?', options: ['1914', '1918', '1939', '1945'], expected: '1939', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'istorie' },
  { slug: 'q-a14-003', type: 'mcq', prompt: 'Care e formula chimica a apei?', options: ['CO2', 'H2O', 'O2', 'NaCl'], expected: 'H2O', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'stiinta' },
  { slug: 'q-a14-004', type: 'mcq', prompt: 'Cate continente are Pamantul?', options: ['5', '6', '7', '8'], expected: '7', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'geografie' },
  { slug: 'q-a14-005', type: 'mcq', prompt: 'Care e cel mai inalt munte din lume?', options: ['Everest', 'K2', 'Mont Blanc', 'Kilimanjaro'], expected: 'Everest', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'geografie,natura' },
  { slug: 'q-a14-006', type: 'mcq', prompt: 'Cine a pictat "Mona Lisa"?', options: ['Leonardo da Vinci', 'Pablo Picasso', 'Vincent van Gogh', 'Michelangelo'], expected: 'Leonardo da Vinci', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'arta' },
  { slug: 'q-a14-007', type: 'mcq', prompt: 'Ce planeta e numita "planeta rosie"?', options: ['Marte', 'Jupiter', 'Venus', 'Saturn'], expected: 'Marte', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'cer,stiinta' },
  { slug: 'q-a14-008', type: 'mcq', prompt: 'Care e cel mai lung rau din Romania?', options: ['Olt', 'Mures', 'Dunarea', 'Prut'], expected: 'Dunarea', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'geografie,apa' },
  { slug: 'q-a14-009', type: 'mcq', prompt: 'Care e capitala Frantei?', options: ['Lyon', 'Marsilia', 'Paris', 'Nisa'], expected: 'Paris', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'geografie' },
  { slug: 'q-a14-010', type: 'mcq', prompt: 'Ce gaz respiram pentru a trai?', options: ['Azot', 'Oxigen', 'Hidrogen', 'Dioxid de carbon'], expected: 'Oxigen', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'stiinta' },
  { slug: 'q-a14-011', type: 'mcq', prompt: 'Care e cel mai mare ocean din lume?', options: ['Atlantic', 'Pacific', 'Indian', 'Arctic'], expected: 'Pacific', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'geografie,apa' },
  { slug: 'q-a14-012', type: 'mcq', prompt: 'Cine a fost domnitorul care a unit Tarile Romane in 1859?', options: ['Mihai Viteazul', 'Stefan cel Mare', 'Alexandru Ioan Cuza', 'Carol I'], expected: 'Alexandru Ioan Cuza', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'istorie' },
  { slug: 'q-a14-013', type: 'mcq', prompt: 'Cati km are aproximativ un maraton?', options: ['21', '32', '42', '50'], expected: '42', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'sport' },
  { slug: 'q-a14-014', type: 'mcq', prompt: 'Cat e radacina patrata din 144?', options: ['11', '12', '13', '14'], expected: '12', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'mate' },
  { slug: 'q-a14-015', type: 'mcq', prompt: 'In ce judet se afla Castelul Bran?', options: ['Sibiu', 'Brasov', 'Hunedoara', 'Cluj'], expected: 'Brasov', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'geografie,istorie' },
  { slug: 'q-a14-016', type: 'mcq', prompt: 'Cum se numeste fenomenul cand Luna acopera Soarele?', options: ['Aurora', 'Eclipsa', 'Cometa', 'Meteorit'], expected: 'Eclipsa', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'cer,stiinta' },
  { slug: 'q-a14-017', type: 'mcq', prompt: 'Cate inimi are o caracatita?', options: ['1', '2', '3', '4'], expected: '3', ageMin: 10, ageMax: 14, difficulty: 3, themeTags: 'animale,apa' },
  { slug: 'q-a14-018', type: 'mcq', prompt: 'Cine a inventat becul electric?', options: ['Nikola Tesla', 'Thomas Edison', 'Albert Einstein', 'Isaac Newton'], expected: 'Thomas Edison', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'stiinta,istorie' },
  { slug: 'q-a14-019', type: 'mcq', prompt: 'Care e cel mai inalt varf din Romania?', options: ['Negoiu', 'Moldoveanu', 'Omu', 'Parangu Mare'], expected: 'Moldoveanu', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'geografie' },
  { slug: 'q-a14-020', type: 'mcq', prompt: 'Care e capitala Spaniei?', options: ['Barcelona', 'Madrid', 'Sevilla', 'Valencia'], expected: 'Madrid', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'geografie' },
  { slug: 'q-a14-021', type: 'mcq', prompt: 'Cati cromozomi are o celula umana?', options: ['23', '46', '48', '52'], expected: '46', ageMin: 10, ageMax: 14, difficulty: 3, themeTags: 'stiinta' },
  { slug: 'q-a14-022', type: 'mcq', prompt: 'Cine a scris "Romeo si Julieta"?', options: ['Charles Dickens', 'William Shakespeare', 'Mark Twain', 'Jules Verne'], expected: 'William Shakespeare', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'literatura' },
  { slug: 'q-a14-023', type: 'mcq', prompt: 'Pe ce continent se afla Egiptul?', options: ['Asia', 'Africa', 'Europa', 'America'], expected: 'Africa', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'geografie' },
  { slug: 'q-a14-024', type: 'mcq', prompt: 'Care e capitala Statelor Unite ale Americii?', options: ['New York', 'Washington', 'Los Angeles', 'Chicago'], expected: 'Washington', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'geografie' },
  { slug: 'q-a14-025', type: 'mcq', prompt: 'Cum se numeste procesul prin care plantele produc hrana?', options: ['Respiratie', 'Fotosinteza', 'Digestie', 'Evaporare'], expected: 'Fotosinteza', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'stiinta,natura' },

  // ===== Counting (toate varstele) =====
  { slug: 'c-001', type: 'counting', prompt: 'Atinge ecranul de exact 5 ori', expected: '5', ageMin: 6, ageMax: 14, difficulty: 1 },
  { slug: 'c-002', type: 'counting', prompt: 'Atinge ecranul de exact 7 ori', expected: '7', ageMin: 6, ageMax: 14, difficulty: 1 },
  { slug: 'c-003', type: 'counting', prompt: 'Atinge ecranul de exact 10 ori', expected: '10', ageMin: 6, ageMax: 14, difficulty: 1 },
  { slug: 'c-004', type: 'counting', prompt: 'Atinge ecranul de exact 12 ori', expected: '12', ageMin: 8, ageMax: 14, difficulty: 2 },
  { slug: 'c-005', type: 'counting', prompt: 'Atinge ecranul de exact 8 ori', expected: '8', ageMin: 6, ageMax: 14, difficulty: 1 },
  { slug: 'c-006', type: 'counting', prompt: 'Atinge ecranul de exact 15 ori', expected: '15', ageMin: 9, ageMax: 14, difficulty: 2 },
  { slug: 'c-007', type: 'counting', prompt: 'Atinge ecranul de exact 3 ori', expected: '3', ageMin: 6, ageMax: 9, difficulty: 1 },
  { slug: 'c-008', type: 'counting', prompt: 'Atinge ecranul de exact 6 ori', expected: '6', ageMin: 6, ageMax: 14, difficulty: 1 },
];

const SPECIES: SeedSpecies[] = [
  {
    slug: 'dog',
    name: 'Catelus',
    voiceId: 'ro-RO-EmilNeural',
    systemHint:
      'Esti un catelus jucaus si dragalas. Vorbesti scurt, vesel, dai labute. Folosesti diminutive ("povestioara", "prietenul meu"). Te entuziasmezi la lucruri noi.',
    isDefault: true,
  },
];

async function main() {
  for (const [typeIdx, type] of TYPES.entries()) {
    const typeRow = await prisma.itemType.upsert({
      where: { slug: type.slug },
      create: { slug: type.slug, name: type.name, group: type.group, sortOrder: typeIdx },
      update: { name: type.name, group: type.group, sortOrder: typeIdx },
    });

    for (const [itemIdx, item] of type.items.entries()) {
      await prisma.item.upsert({
        where: { slug: item.slug },
        create: {
          slug: item.slug,
          name: item.name,
          feature: item.feature,
          level: item.level,
          sortOrder: itemIdx,
          typeId: typeRow.id,
        },
        update: {
          name: item.name,
          feature: item.feature,
          level: item.level,
          sortOrder: itemIdx,
          typeId: typeRow.id,
        },
      });
    }
  }

  for (const species of SPECIES) {
    await prisma.petSpecies.upsert({
      where: { slug: species.slug },
      create: species,
      update: species,
    });
  }

  for (const ch of CHALLENGES) {
    if (ch.type === 'mcq') {
      if (!ch.options || ch.options.length !== 4) {
        throw new Error(`MCQ ${ch.slug} trebuie sa aiba exact 4 optiuni`);
      }
      if (!ch.options.includes(ch.expected)) {
        throw new Error(`MCQ ${ch.slug}: expected "${ch.expected}" nu e in options`);
      }
    }
    const optionsStr = ch.options ? ch.options.join('|') : null;
    await prisma.huntChallenge.upsert({
      where: { slug: ch.slug },
      create: {
        slug: ch.slug,
        type: ch.type,
        prompt: ch.prompt,
        expected: ch.expected,
        options: optionsStr,
        ageMin: ch.ageMin,
        ageMax: ch.ageMax,
        themeTags: ch.themeTags ?? '',
        difficulty: ch.difficulty ?? 1,
        active: true,
      },
      update: {
        type: ch.type,
        prompt: ch.prompt,
        expected: ch.expected,
        options: optionsStr,
        ageMin: ch.ageMin,
        ageMax: ch.ageMax,
        themeTags: ch.themeTags ?? '',
        difficulty: ch.difficulty ?? 1,
        active: true,
      },
    });
  }

  // Dezactivam orice challenge istoric care nu mai e in lista (ex. ghicitorile
  // vechi). Le pastram in DB pt referinta dar selector-ul nu le mai foloseste.
  const allSlugs = CHALLENGES.map((c) => c.slug);
  await prisma.huntChallenge.updateMany({
    where: { slug: { notIn: allSlugs } },
    data: { active: false },
  });

  const counts = await prisma.item.count();
  console.log(
    `Seed complete: ${TYPES.length} types, ${counts} items, ${SPECIES.length} species, ${CHALLENGES.length} hunt challenges`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
