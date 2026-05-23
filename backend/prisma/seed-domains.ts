// Seed taxonomia Domain — sursa unica de adevar pentru `domain` din intregul
// sistem (MonsterTemplate, HuntChallenge, PetSpecies.expertiseDomains[],
// AdventureWorld.domain, JourneyQuestion.domain).
//
// Structura: 10 RADACINI (categorii largi de interes) + subdomenii. Slug-urile
// existente folosite deja in cod (geografie, istorie, stiinte-naturii, ...)
// devin SUBDOMENII sub radacina potrivita. Astfel codul existent continua sa
// functioneze fara migrare de date.
//
// `kind`:
//   - 'interest'  = doar preferinta de continut/hobby (sport, animale)
//   - 'knowledge' = doar subiect academic (matematica, fizica-chimie)
//   - 'both'      = ambele (spatiu, tehnologie)
//
// Idempotent: re-rularea upsert-eaza dupa slug; modificari de nume/icon raman
// active. Adaugare domain nou = adauga in lista de mai jos + re-ruleaza seed.

import { PrismaClient } from '@prisma/client';

type SeedDomain = {
  slug: string;
  name: string;
  icon?: string;
  kind?: 'interest' | 'knowledge' | 'both';
  children?: SeedDomain[];
};

const TAXONOMY: SeedDomain[] = [
  {
    slug: 'sport',
    name: 'Sport',
    icon: 'sport',
    kind: 'interest',
    children: [
      { slug: 'sport-fotbal', name: 'Fotbal', icon: 'football' },
      { slug: 'sport-baschet', name: 'Baschet', icon: 'basketball' },
      { slug: 'sport-ciclism', name: 'Ciclism', icon: 'bike' },
      { slug: 'sport-inot', name: 'Inot', icon: 'swim' },
      { slug: 'sport-skateboard', name: 'Skateboard', icon: 'skateboard' },
      { slug: 'sport-arte-martiale', name: 'Arte Martiale', icon: 'martial' },
    ],
  },
  {
    slug: 'animale',
    name: 'Animale',
    icon: 'paw',
    kind: 'interest',
    children: [
      { slug: 'animale-caini-pisici', name: 'Caini si Pisici', icon: 'pet' },
      { slug: 'animale-dinozauri', name: 'Dinozauri', icon: 'dino' },
      { slug: 'animale-marine', name: 'Animale Marine', icon: 'fish' },
      { slug: 'animale-salbatice', name: 'Animale Salbatice', icon: 'tiger' },
      { slug: 'animale-insecte', name: 'Insecte', icon: 'bug' },
    ],
  },
  {
    slug: 'stiinte',
    name: 'Stiinte',
    icon: 'flask',
    kind: 'both',
    children: [
      // Slug-uri EXISTENTE deja folosite in cod — pastrate as-is.
      { slug: 'stiinte-naturii', name: 'Stiintele Naturii', icon: 'leaf', kind: 'knowledge' },
      { slug: 'fizica-chimie', name: 'Fizica si Chimie', icon: 'atom', kind: 'knowledge' },
      { slug: 'corp-uman', name: 'Corpul Uman', icon: 'heart', kind: 'knowledge' },
      { slug: 'spatiu', name: 'Spatiu Cosmic', icon: 'rocket', kind: 'both' },
      { slug: 'stiinte-experimente', name: 'Experimente', icon: 'beaker', kind: 'interest' },
    ],
  },
  {
    slug: 'arta',
    name: 'Arta',
    icon: 'palette',
    kind: 'interest',
    children: [
      { slug: 'arta-desen', name: 'Desen', icon: 'pencil' },
      { slug: 'arta-muzica', name: 'Muzica', icon: 'music', kind: 'both' },
      { slug: 'arta-dans', name: 'Dans', icon: 'dance' },
      { slug: 'arta-teatru', name: 'Teatru', icon: 'mask' },
      { slug: 'arta-fotografie', name: 'Fotografie', icon: 'camera' },
    ],
  },
  {
    slug: 'tehnologie',
    name: 'Tehnologie',
    icon: 'circuit',
    kind: 'both',
    children: [
      { slug: 'tehno-jocuri-video', name: 'Jocuri Video', icon: 'gamepad', kind: 'interest' },
      { slug: 'tehno-roboti', name: 'Roboti', icon: 'robot', kind: 'both' },
      { slug: 'tehno-programare', name: 'Programare', icon: 'code', kind: 'knowledge' },
      { slug: 'tehno-gadgeturi', name: 'Gadgeturi', icon: 'gadget', kind: 'interest' },
    ],
  },
  {
    slug: 'natura',
    name: 'Natura',
    icon: 'tree',
    kind: 'both',
    children: [
      // Slug existent
      { slug: 'geografie', name: 'Geografie', icon: 'globe', kind: 'knowledge' },
      { slug: 'natura-plante', name: 'Plante', icon: 'flower', kind: 'interest' },
      { slug: 'natura-ecologie', name: 'Ecologie', icon: 'recycle', kind: 'both' },
      { slug: 'natura-vreme', name: 'Vremea', icon: 'cloud', kind: 'both' },
    ],
  },
  {
    slug: 'povesti',
    name: 'Povesti',
    icon: 'book',
    kind: 'both',
    children: [
      // Slug-uri existente
      { slug: 'istorie', name: 'Istorie', icon: 'castle', kind: 'knowledge' },
      { slug: 'literatura', name: 'Literatura', icon: 'scroll', kind: 'knowledge' },
      { slug: 'povesti-fantasy', name: 'Fantasy', icon: 'wand', kind: 'interest' },
      { slug: 'povesti-sf', name: 'Science Fiction', icon: 'ufo', kind: 'interest' },
      { slug: 'povesti-mister', name: 'Mister si Detectivi', icon: 'detective', kind: 'interest' },
      { slug: 'povesti-mitologie', name: 'Mitologie', icon: 'lightning', kind: 'both' },
    ],
  },
  {
    slug: 'manualitate',
    name: 'Manualitate',
    icon: 'hand',
    kind: 'interest',
    children: [
      { slug: 'manualitate-lego', name: 'Lego', icon: 'brick' },
      { slug: 'manualitate-origami', name: 'Origami', icon: 'origami' },
      { slug: 'manualitate-gatit', name: 'Gatit', icon: 'chef' },
      { slug: 'manualitate-gradinarit', name: 'Gradinarit', icon: 'sprout' },
    ],
  },
  {
    slug: 'strategie',
    name: 'Strategie si Logica',
    icon: 'brain',
    kind: 'both',
    children: [
      // Slug existent
      { slug: 'matematica', name: 'Matematica', icon: 'numbers', kind: 'knowledge' },
      { slug: 'strategie-sah', name: 'Sah', icon: 'chess', kind: 'interest' },
      { slug: 'strategie-puzzle', name: 'Puzzle si Ghicitori', icon: 'puzzle', kind: 'interest' },
      { slug: 'strategie-jocuri-board', name: 'Jocuri de Strategie', icon: 'dice', kind: 'interest' },
    ],
  },
  {
    slug: 'sociale',
    name: 'Viata Sociala',
    icon: 'people',
    kind: 'both',
    children: [
      // Slug existent
      { slug: 'viata-cotidiana', name: 'Viata de zi cu zi', icon: 'home', kind: 'knowledge' },
      { slug: 'limba-romana', name: 'Limba Romana', icon: 'speech', kind: 'knowledge' },
      { slug: 'sociale-prieteni', name: 'Prieteni si Comunitate', icon: 'friends', kind: 'interest' },
      { slug: 'sociale-familie', name: 'Familie', icon: 'family', kind: 'interest' },
    ],
  },
];

export async function seedDomains(prisma: PrismaClient): Promise<{ count: number }> {
  let total = 0;
  let sortOrder = 0;

  // Pass 1: insereaza/upsert-eaza toate radacinile (fara parent).
  for (const root of TAXONOMY) {
    sortOrder += 10;
    await prisma.domain.upsert({
      where: { slug: root.slug },
      create: {
        slug: root.slug,
        name: root.name,
        icon: root.icon ?? null,
        kind: root.kind ?? 'both',
        parentSlug: null,
        sortOrder,
        active: true,
      },
      update: {
        name: root.name,
        icon: root.icon ?? null,
        kind: root.kind ?? 'both',
        parentSlug: null,
        sortOrder,
        active: true,
      },
    });
    total++;
  }

  // Pass 2: insereaza copiii (parent-ul exista deja). sortOrder per copil
  // incepe de la 1 sub fiecare parent — folosit pt ordonare consistenta in UI.
  for (const root of TAXONOMY) {
    let childOrder = 0;
    for (const child of root.children ?? []) {
      childOrder += 10;
      await prisma.domain.upsert({
        where: { slug: child.slug },
        create: {
          slug: child.slug,
          name: child.name,
          icon: child.icon ?? null,
          kind: child.kind ?? root.kind ?? 'both',
          parentSlug: root.slug,
          sortOrder: childOrder,
          active: true,
        },
        update: {
          name: child.name,
          icon: child.icon ?? null,
          kind: child.kind ?? root.kind ?? 'both',
          parentSlug: root.slug,
          sortOrder: childOrder,
          active: true,
        },
      });
      total++;
    }
  }

  // Dezactivam orice domain care nu mai e in taxonomie — pastrat in DB
  // pentru audit/istoric, dar exclus din filtre active.
  const allSlugs: string[] = [];
  for (const root of TAXONOMY) {
    allSlugs.push(root.slug);
    for (const child of root.children ?? []) allSlugs.push(child.slug);
  }
  await prisma.domain.updateMany({
    where: { slug: { notIn: allSlugs } },
    data: { active: false },
  });

  return { count: total };
}
