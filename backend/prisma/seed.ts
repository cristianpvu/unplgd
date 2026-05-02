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
  type: 'riddle' | 'counting';
  prompt: string;
  expected: string;
  ageMin: number;
  ageMax: number;
  themeTags?: string;
  difficulty?: number;
};

// Bank de challenge-uri pentru hunt. Riddles + counting (photo va fi adaugat
// in faza 4 cu Claude vision). Slug-urile sunt stabile — la re-seed, prompt-ul
// se updateaza dar id-ul DB ramane (idempotent).
const CHALLENGES: SeedChallenge[] = [
  // ===== Riddles age 6-9 (difficulty 1) =====
  { slug: 'r-a69-001', type: 'riddle', prompt: 'Ce zboara dar nu are aripi?', expected: 'timpul', ageMin: 6, ageMax: 9, difficulty: 1 },
  { slug: 'r-a69-002', type: 'riddle', prompt: 'Are dinti dar nu mananca, ce e?', expected: 'pieptenul', ageMin: 6, ageMax: 9, difficulty: 1 },
  { slug: 'r-a69-003', type: 'riddle', prompt: 'Ce are doua roti si nu are motor?', expected: 'bicicleta', ageMin: 6, ageMax: 9, difficulty: 1, themeTags: 'transport' },
  { slug: 'r-a69-004', type: 'riddle', prompt: 'Are coada lunga, miorlaie si prinde soareci. Ce e?', expected: 'pisica', ageMin: 6, ageMax: 9, difficulty: 1, themeTags: 'animale' },
  { slug: 'r-a69-005', type: 'riddle', prompt: 'Cum se numeste puiul caprioarei?', expected: 'iedul', ageMin: 6, ageMax: 9, difficulty: 1, themeTags: 'animale,padure' },
  { slug: 'r-a69-006', type: 'riddle', prompt: 'Inot in apa, am solzi si fara mine pescarul ramane trist. Ce sunt?', expected: 'pestele', ageMin: 6, ageMax: 9, difficulty: 1, themeTags: 'apa,animale' },
  { slug: 'r-a69-007', type: 'riddle', prompt: 'Are 4 picioare, latra si pazeste casa. Cine e?', expected: 'cainele', ageMin: 6, ageMax: 9, difficulty: 1, themeTags: 'animale' },
  { slug: 'r-a69-008', type: 'riddle', prompt: 'Cad din cer si sunt albe. Ce sunt?', expected: 'fulgii de zapada', ageMin: 6, ageMax: 9, difficulty: 1, themeTags: 'iarna' },
  { slug: 'r-a69-009', type: 'riddle', prompt: 'Are coaja, semburi si e dulce. Ce fruct e?', expected: 'cireasa', ageMin: 6, ageMax: 9, difficulty: 1, themeTags: 'fructe' },
  { slug: 'r-a69-010', type: 'riddle', prompt: 'Iese din fata cand strigi tare. Ce e?', expected: 'ecoul', ageMin: 6, ageMax: 9, difficulty: 1 },
  { slug: 'r-a69-011', type: 'riddle', prompt: 'Are aripi, ciripeste, sta in copac. Cine e?', expected: 'pasarea', ageMin: 6, ageMax: 9, difficulty: 1, themeTags: 'animale,cer' },
  { slug: 'r-a69-012', type: 'riddle', prompt: 'Dimineata se ridica, seara se culca. Cine e?', expected: 'soarele', ageMin: 6, ageMax: 9, difficulty: 1, themeTags: 'cer' },
  { slug: 'r-a69-013', type: 'riddle', prompt: 'Ne luminam in noapte cu el. Ce e?', expected: 'becul', ageMin: 6, ageMax: 9, difficulty: 1 },
  { slug: 'r-a69-014', type: 'riddle', prompt: 'Are corn pe frunte, e magic si zboara prin povesti. Ce e?', expected: 'unicornul', ageMin: 6, ageMax: 9, difficulty: 1, themeTags: 'fantastic' },
  { slug: 'r-a69-015', type: 'riddle', prompt: 'Sare din floare in floare si face miere. Cine e?', expected: 'albina', ageMin: 6, ageMax: 9, difficulty: 1, themeTags: 'animale,flori' },

  // ===== Riddles age 10-14 (difficulty 2) =====
  { slug: 'r-a14-001', type: 'riddle', prompt: 'Are pagini, dar nu intoarce singura. Ce e?', expected: 'cartea', ageMin: 10, ageMax: 14, difficulty: 2 },
  { slug: 'r-a14-002', type: 'riddle', prompt: 'Curge dar nu e apa, ne tine in viata si trece prin inima. Ce e?', expected: 'sangele', ageMin: 10, ageMax: 14, difficulty: 2 },
  { slug: 'r-a14-003', type: 'riddle', prompt: 'Cu cat iei mai multa, cu atat las mai mult in spate. Ce sunt?', expected: 'pasi', ageMin: 10, ageMax: 14, difficulty: 2 },
  { slug: 'r-a14-004', type: 'riddle', prompt: 'Sunt mereu in fata ta dar nu ma poti atinge. Ce sunt?', expected: 'viitorul', ageMin: 10, ageMax: 14, difficulty: 2 },
  { slug: 'r-a14-005', type: 'riddle', prompt: 'Cresc dar nu sunt vie, am varf dar nu sunt creion. Ce sunt?', expected: 'muntele', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'natura' },
  { slug: 'r-a14-006', type: 'riddle', prompt: 'Are chei dar nu deschide nimic. Ce e?', expected: 'pianul', ageMin: 10, ageMax: 14, difficulty: 2 },
  { slug: 'r-a14-007', type: 'riddle', prompt: 'Cad fara sa ma lovesc, sunt blanda si racoresc. Ce sunt?', expected: 'ploaia', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'cer,apa' },
  { slug: 'r-a14-008', type: 'riddle', prompt: 'Are limba dar nu vorbeste. Ce e?', expected: 'pantoful', ageMin: 10, ageMax: 14, difficulty: 2 },
  { slug: 'r-a14-009', type: 'riddle', prompt: 'Ce planeta e cunoscuta drept "planeta rosie"?', expected: 'marte', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'cer,stiinta' },
  { slug: 'r-a14-010', type: 'riddle', prompt: 'Cate continente are Pamantul?', expected: 'sapte', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'geografie' },
  { slug: 'r-a14-011', type: 'riddle', prompt: 'Ce metal e folosit pentru fire electrice?', expected: 'cupru', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'stiinta' },
  { slug: 'r-a14-012', type: 'riddle', prompt: 'Care e cel mai lung rau din Romania?', expected: 'dunarea', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'geografie,apa' },
  { slug: 'r-a14-013', type: 'riddle', prompt: 'Cum se numeste fenomenul cand luna acopera soarele?', expected: 'eclipsa', ageMin: 10, ageMax: 14, difficulty: 3, themeTags: 'cer,stiinta' },
  { slug: 'r-a14-014', type: 'riddle', prompt: 'Cate inimi are caracatita?', expected: 'trei', ageMin: 10, ageMax: 14, difficulty: 3, themeTags: 'animale,apa' },
  { slug: 'r-a14-015', type: 'riddle', prompt: 'Cum se cheama puiul vulpii?', expected: 'puiul de vulpe', ageMin: 10, ageMax: 14, difficulty: 2, themeTags: 'animale,padure' },

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
    await prisma.huntChallenge.upsert({
      where: { slug: ch.slug },
      create: {
        slug: ch.slug,
        type: ch.type,
        prompt: ch.prompt,
        expected: ch.expected,
        ageMin: ch.ageMin,
        ageMax: ch.ageMax,
        themeTags: ch.themeTags ?? '',
        difficulty: ch.difficulty ?? 1,
      },
      update: {
        type: ch.type,
        prompt: ch.prompt,
        expected: ch.expected,
        ageMin: ch.ageMin,
        ageMax: ch.ageMax,
        themeTags: ch.themeTags ?? '',
        difficulty: ch.difficulty ?? 1,
      },
    });
  }

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
