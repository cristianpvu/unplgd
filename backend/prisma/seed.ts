// Seed pentru catalogul de iteme avatar. Idempotent: ruleaza la deploy / dupa
// `prisma migrate`. Slug-urile sunt identificatori stabili — daca redenumesti
// un slug, contractele cu mobile se rup. Adauga iteme noi cu slug nou.
//
// Datele de stil (fata) referentiaza DiceBear "Adventurer" by Lisa Wischofsky
// (CC BY 4.0). Corpul, hainele si economia level-gated sunt originale.

import { AttachmentPoint, ChestTier, PrismaClient, Rarity } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHALLENGES } from './data/challenges.js';
import { seedJourneyQuestions } from './seed-journey-questions.js';
import { seedDomains } from './seed-domains.js';

const prisma = new PrismaClient();

// Vizual config per tier — culorile sunt sursa de adevar in DB; SVG-urile sunt
// citite din assets/chests/<slug>-{mini|body|lid}.svg si scrise in coloane
// TEXT. Adauga tier nou: extinde acest map + ruleaza scripts/generate-chest-svgs
// (sau pune fisierele manual) + ruleaza seed.
const CHEST_TIER_VISUALS: Record<ChestTier, {
  label: string;
  sortOrder: number;
  bgColor: string;
  darkColor: string;
  fgColor: string;
  glowColor: string;
  miniSvgPath: string;
  bodySvgPath: string;
  lidSvgPath: string;
}> = {
  BRONZE:   { label: 'Bronz',   sortOrder: 10, bgColor: '#C68B59', darkColor: '#6B3F1A', fgColor: '#FFF6E8', glowColor: '#FFD7A8', miniSvgPath: 'bronze-mini.svg',   bodySvgPath: 'bronze-body.svg',   lidSvgPath: 'bronze-lid.svg' },
  SILVER:   { label: 'Argint',  sortOrder: 20, bgColor: '#C0CBD4', darkColor: '#5F6F7B', fgColor: '#1F3344', glowColor: '#F0F5F9', miniSvgPath: 'silver-mini.svg',   bodySvgPath: 'silver-body.svg',   lidSvgPath: 'silver-lid.svg' },
  GOLD:     { label: 'Aur',     sortOrder: 30, bgColor: '#F2C744', darkColor: '#7A5A0E', fgColor: '#5B3F00', glowColor: '#FFEFA8', miniSvgPath: 'gold-mini.svg',     bodySvgPath: 'gold-body.svg',     lidSvgPath: 'gold-lid.svg' },
  PLATINUM: { label: 'Platina', sortOrder: 40, bgColor: '#7FE0D0', darkColor: '#1F6358', fgColor: '#0C3F38', glowColor: '#C2FFF4', miniSvgPath: 'platinum-mini.svg', bodySvgPath: 'platinum-body.svg', lidSvgPath: 'platinum-lid.svg' },
  DIAMOND:  { label: 'Diamant', sortOrder: 50, bgColor: '#9AB3FF', darkColor: '#2B3F8E', fgColor: '#1B2870', glowColor: '#E2EAFF', miniSvgPath: 'diamond-mini.svg',  bodySvgPath: 'diamond-body.svg',  lidSvgPath: 'diamond-lid.svg' },
  CHAMPION: { label: 'Campion', sortOrder: 60, bgColor: '#FF7A59', darkColor: '#7A2812', fgColor: '#FFFFFF', glowColor: '#FFD9C2', miniSvgPath: 'champion-mini.svg', bodySvgPath: 'champion-body.svg', lidSvgPath: 'champion-lid.svg' },
};

// Rezolvat relativ la cwd. In dev: cwd=backend/, deci assets/chests/. In Docker:
// cwd=/app, dist deja are assets/ copiat de Dockerfile.
function readChestSvg(relPath: string): string | null {
  try {
    return readFileSync(join(process.cwd(), 'assets', 'chests', relPath), 'utf8');
  } catch (e) {
    console.warn(`readChestSvg(${relPath}) failed: ${(e as Error).message}`);
    return null;
  }
}

type SeedItem = {
  slug: string;
  name: string;
  feature: string | null;
  level: number;
  rarity?: Rarity;
  exclusive?: boolean;
  attachmentPoint?: AttachmentPoint | null;
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
      { slug: 'eb-01', feature: 'variant01', name: 'Naturale', level: 1 },
      { slug: 'eb-02', feature: 'variant05', name: 'Arcuite', level: 1 },
      { slug: 'eb-03', feature: 'variant08', name: 'Groase', level: 1 },
      { slug: 'eb-04', feature: 'variant12', name: 'Subtiri', level: 5 },
      { slug: 'eb-05', feature: 'variant15', name: 'Ridicate', level: 10 },
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
    slug: 'features',
    name: 'Detalii fata',
    group: 'face',
    items: [
      { slug: 'f-00', feature: null, name: 'Fara', level: 1 },
      { slug: 'f-01', feature: 'freckles', name: 'Pistrui', level: 1 },
      { slug: 'f-02', feature: 'blush', name: 'Roseata', level: 1 },
      { slug: 'f-03', feature: 'birthmark', name: 'Alunita', level: 5 },
      { slug: 'f-04', feature: 'mustache', name: 'Mustata', level: 10 },
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
    // Slot redefinit ca "accesoriu" general — un singur slot care suporta
    // atasari diverse (HAND in mana, NECK la gat, FEET la picior, BACK in
    // spate, HEAD pe cap). Slug-ul DB ramane "holding" pentru compat cu
    // istoricul de FK-uri si AVATAR_INCLUDE; label-ul user-facing e
    // "Accesoriu" si itemele de aici se pot castiga din cufere Phone-Down.
    slug: 'holding',
    name: 'Accesoriu',
    group: 'body',
    items: [
      // Setul minimal — doar accesoriile care se randeaza curat. Toate sunt SVG
      // simple in body coords (fara matrix/transform pentru ca SvgXml RN are
      // bug-uri silentioase pe transformuri compuse).
      { slug: 'hd-00', feature: null, name: 'Fara accesoriu', level: 1, rarity: 'COMMON', attachmentPoint: null },
      // HAND
      { slug: 'hd-04', feature: 'balloon-blue', name: 'Balon', level: 1, rarity: 'COMMON', attachmentPoint: 'HAND' },
      { slug: 'hd-15', feature: 'kite', name: 'Zmeu', level: 1, rarity: 'RARE', attachmentPoint: 'HAND' },
      // NECK
      { slug: 'hd-12', feature: 'necklace-gold', name: 'Lantisor de aur', level: 1, rarity: 'RARE', attachmentPoint: 'NECK' },
      { slug: 'hd-13', feature: 'necklace-heart', name: 'Pandant inima', level: 1, rarity: 'RARE', attachmentPoint: 'NECK' },
      { slug: 'hd-14', feature: 'necklace-blue-drop', name: 'Pandant safir', level: 1, rarity: 'EPIC', attachmentPoint: 'NECK' },
      // HEAD
      { slug: 'hd-41', feature: 'halo', name: 'Aureola', level: 1, rarity: 'EPIC', attachmentPoint: 'HEAD' },
    ],
  },
];

// PetSpecies + NfcPetCard NU se seedeaza — sunt mentinute manual in DB (user-ul
// le-a creat cu systemHint-uri si imagePath-uri reale; seed-ul facea override
// nedorit). Pentru `expertiseDomains` nou (Pas 2 hunt v2) ruleaza one-off SQL
// pe DB existenta — vezi memoria `project_hunt_v2.md` pt UPDATE statements.

type SeedMonsterTemplate = {
  slug: string;
  name: string;
  domain: string;
  tier: 'green' | 'yellow' | 'red' | 'gold';
  difficulty: number; // 1=usor, 2=mediu, 3=greu
  loreShort: string;
};

// Lumi pentru story-adventure. Cheie pe speciesSlug (legatura libera la
// PetSpecies.slug). Data-driven: adaugare lume = entry aici (sau direct INSERT).
// FUNDALURILE nu se seed-uiesc — le populeaza user-ul manual (imageUrl static).
type SeedAdventureWorld = {
  slug: string;
  speciesSlug: string;
  domain: string;
  name: string;
  lore: string;
  bossName: string;
  bossLore: string;
  accentColor: string;
  bgColor: string;
  obstacleStyle: string;
  sortOrder: number;
};

const ADVENTURE_WORLDS: SeedAdventureWorld[] = [
  // groot — stiinte-naturii, geografie
  { slug: 'groot-padure', speciesSlug: 'groot', domain: 'stiinte-naturii', name: 'Padurea Fermecata', lore: 'O padure veche unde fiecare copac are o poveste.', bossName: 'Ursul Strabun', bossLore: 'Pazitorul intelept al padurii.', accentColor: '#2ECC71', bgColor: '#0E2A1A', obstacleStyle: 'bridge', sortOrder: 0 },
  { slug: 'groot-tinuturi', speciesSlug: 'groot', domain: 'geografie', name: 'Tinuturile Necunoscute', lore: 'Munti, rauri si tari de descoperit.', bossName: 'Vulturul Cartograf', bossLore: 'Stie fiecare colt al lumii.', accentColor: '#27AE60', bgColor: '#13301F', obstacleStyle: 'bridge', sortOrder: 1 },
  // stitch — spatiu, fizica-chimie
  { slug: 'stitch-galaxie', speciesSlug: 'stitch', domain: 'spatiu', name: 'Galaxia Albastra', lore: 'Stele, planete si mistere cosmice.', bossName: 'Cometa Furioasa', bossLore: 'Strabate cerul cu coada de foc.', accentColor: '#5BCEFA', bgColor: '#0B1437', obstacleStyle: 'constellation', sortOrder: 0 },
  { slug: 'stitch-laborator', speciesSlug: 'stitch', domain: 'fizica-chimie', name: 'Laboratorul Cosmic', lore: 'Experimente nazdravane si forte ascunse.', bossName: 'Reactorul Nazdravan', bossLore: 'Bolboroseste formule si scantei.', accentColor: '#48C9B0', bgColor: '#0A2A28', obstacleStyle: 'door', sortOrder: 1 },
  // baby-yoda — istorie, literatura
  { slug: 'yoda-temple', speciesSlug: 'baby-yoda', domain: 'istorie', name: 'Templele Uitate', lore: 'Ruine antice pline de amintiri.', bossName: 'Strajerul Antic', bossLore: 'Pazeste secretele trecutului.', accentColor: '#D4AC0D', bgColor: '#2A1E08', obstacleStyle: 'door', sortOrder: 0 },
  { slug: 'yoda-biblioteca', speciesSlug: 'baby-yoda', domain: 'literatura', name: 'Biblioteca Fermecata', lore: 'Carti vii si povesti nesfarsite.', bossName: 'Cartea Vorbitoare', bossLore: 'Recita versuri si ghicitori.', accentColor: '#BB8FCE', bgColor: '#211433', obstacleStyle: 'door', sortOrder: 1 },
  // dog — corp-uman, viata-cotidiana
  { slug: 'dog-corp', speciesSlug: 'dog', domain: 'corp-uman', name: 'Calatoria prin Corp', lore: 'O aventura prin corpul omenesc.', bossName: 'Inima Uriasa', bossLore: 'Bate ritmic si te invata sa fii sanatos.', accentColor: '#EC7063', bgColor: '#2A1212', obstacleStyle: 'door', sortOrder: 0 },
  { slug: 'dog-oras', speciesSlug: 'dog', domain: 'viata-cotidiana', name: 'Orasul Aventurii', lore: 'Strazi, reguli si intamplari de zi cu zi.', bossName: 'Semaforul Sef', bossLore: 'Tine ordinea in oras.', accentColor: '#F39C12', bgColor: '#2A1E08', obstacleStyle: 'door', sortOrder: 1 },
  // darth-vader — spatiu, istorie (tematic Star Wars)
  { slug: 'vader-galaxie', speciesSlug: 'darth-vader', domain: 'spatiu', name: 'Galaxia Imperiala', lore: 'O galaxie vasta plina de stele si nave.', bossName: 'Steaua Mortii', bossLore: 'Statie de lupta gigantica.', accentColor: '#E74C3C', bgColor: '#120A0A', obstacleStyle: 'constellation', sortOrder: 0 },
  { slug: 'vader-cronici', speciesSlug: 'darth-vader', domain: 'istorie', name: 'Cronicile Imperiului', lore: 'Batalii si imparati din vremuri trecute.', bossName: 'Imparatul Umbrelor', bossLore: 'Conduce din umbra istoria.', accentColor: '#922B21', bgColor: '#1A0808', obstacleStyle: 'door', sortOrder: 1 },
];

// Bestiar pentru hunt. Spawn-ul filtreaza pe `tier`, `domain` decide pool-ul
// de intrebari trase la engage si ce pet din party poate sa "soptesste" hint
// (cel cu `domain` ∈ expertiseDomains). Slug-uri stabile pt seed idempotent.
// Adaugare monstru nou = entry in lista; eliminare = scoatere din lista (va
// fi dezactivat automat la urmatorul seed).
const MONSTER_TEMPLATES: SeedMonsterTemplate[] = [
  // ===== GEOGRAFIE =====
  { slug: 'pinguin-hartograf', name: 'Pinguinul Hartograf', domain: 'geografie', tier: 'green', difficulty: 1, loreShort: 'Pinguin mic cu harti desenate de el. Stie unde sunt toate insulele.' },
  { slug: 'capitan-busola', name: 'Capitanul Busola', domain: 'geografie', tier: 'yellow', difficulty: 2, loreShort: 'Marinar batran cu busola ruginita. Intreaba despre tinuturi indepartate.' },
  { slug: 'sphinxul-piscurilor', name: 'Sphinxul Piscurilor', domain: 'geografie', tier: 'red', difficulty: 3, loreShort: 'Asezat la varful celor mai inalte munti. Numai cei ce cunosc lumea trec.' },

  // ===== ISTORIE =====
  { slug: 'soldatel-dac', name: 'Soldatelul Dac', domain: 'istorie', tier: 'green', difficulty: 1, loreShort: 'Mic luptator dac cu coif din lemn. Vrea sa-i amintesti vremurile vechi.' },
  { slug: 'centurion-roman', name: 'Centurionul Roman', domain: 'istorie', tier: 'yellow', difficulty: 2, loreShort: 'Centurion in armura, intreaba despre imperii si batalii antice.' },
  { slug: 'cavaler-negru', name: 'Cavalerul Negru', domain: 'istorie', tier: 'red', difficulty: 3, loreShort: 'Cavaler medieval in armura, gardian al amintirilor evului mediu.' },
  { slug: 'faraonul-ascuns', name: 'Faraonul Ascuns', domain: 'istorie', tier: 'gold', difficulty: 3, loreShort: 'Faraon vechi de mii de ani. Apare doar o data, cu cele mai grele intrebari.' },

  // ===== STIINTE-NATURII =====
  { slug: 'bondar-curios', name: 'Bondarul Curios', domain: 'stiinte-naturii', tier: 'green', difficulty: 1, loreShort: 'Bondar dolofan care zumzaie despre flori, polen si albine.' },
  { slug: 'vulpea-padurii', name: 'Vulpea Padurii', domain: 'stiinte-naturii', tier: 'yellow', difficulty: 2, loreShort: 'Vulpe sireata. Cunoaste fiecare cotlon de padure si vietuitor.' },
  { slug: 'ursul-inteleptult', name: 'Ursul Inteleptult', domain: 'stiinte-naturii', tier: 'red', difficulty: 3, loreShort: 'Urs batran de munte. Intelege toate vietuitoarele si plantele.' },

  // ===== FIZICA-CHIMIE =====
  { slug: 'bula-stralucitoare', name: 'Bula Stralucitoare', domain: 'fizica-chimie', tier: 'green', difficulty: 1, loreShort: 'Balon de sapun stralucitor care iti arata fenomene amuzante.' },
  { slug: 'magnetul-vorbitor', name: 'Magnetul Vorbitor', domain: 'fizica-chimie', tier: 'yellow', difficulty: 2, loreShort: 'Magnet potcoava cu personalitate. Atrage intrebari despre forte.' },
  { slug: 'atomul-capatanos', name: 'Atomul Capatanos', domain: 'fizica-chimie', tier: 'red', difficulty: 3, loreShort: 'Atom mic dar incapatanat. Te pune sa-l intelegi inainte sa-l prinzi.' },

  // ===== SPATIU =====
  { slug: 'astronaut-pierdut', name: 'Astronautul Pierdut', domain: 'spatiu', tier: 'green', difficulty: 1, loreShort: 'Astronaut mic ratacit pe iarba. Iti cere ajutorul sa se intoarca acasa.' },
  { slug: 'robotelul-lunar', name: 'Robotelul Lunar', domain: 'spatiu', tier: 'yellow', difficulty: 2, loreShort: 'Robot mic venit de pe Luna. Are intrebari despre cer si planete.' },
  { slug: 'cometa-furioasa', name: 'Cometa Furioasa', domain: 'spatiu', tier: 'red', difficulty: 3, loreShort: 'Coada de cometa rebela care a cazut din cer printre brazi.' },
  { slug: 'dragonul-stelelor', name: 'Dragonul Stelelor', domain: 'spatiu', tier: 'gold', difficulty: 3, loreShort: 'Dragon facut din stele. Apare o singura data, doar pentru ucenici curajosi.' },

  // ===== CORP-UMAN =====
  { slug: 'inima-zambitoare', name: 'Inima Zambitoare', domain: 'corp-uman', tier: 'green', difficulty: 1, loreShort: 'Inima vesela cu picioruse. Bate ritmic si te invata despre corp.' },
  { slug: 'doctor-praf-stele', name: 'Doctorul Praf-de-stele', domain: 'corp-uman', tier: 'yellow', difficulty: 2, loreShort: 'Doctor mic cu halat alb, te invata sa-ti pastrezi sanatatea.' },
  { slug: 'scheletul-profesor', name: 'Scheletul Profesor', domain: 'corp-uman', tier: 'red', difficulty: 3, loreShort: 'Schelet zambitor cu ochelari. Cunoaste fiecare os si organ.' },

  // ===== LIMBA-ROMANA =====
  { slug: 'litera-albastra', name: 'Litera Albastra', domain: 'limba-romana', tier: 'green', difficulty: 1, loreShort: 'O litera plimbareata care vrea sa fie scrisa corect.' },
  { slug: 'carticica-vorbitoare', name: 'Carticica Vorbitoare', domain: 'limba-romana', tier: 'yellow', difficulty: 2, loreShort: 'Carticica veche care te corecteaza la gramatica.' },
  { slug: 'cronicar-brun', name: 'Cronicarul Brun', domain: 'limba-romana', tier: 'red', difficulty: 3, loreShort: 'Cronicar batran cu pana de gasca. Stie toate regulile limbii.' },

  // ===== LITERATURA =====
  { slug: 'greuceanu-mic', name: 'Greuceanu cel Mic', domain: 'literatura', tier: 'green', difficulty: 1, loreShort: 'Mic erou din basme, vrea sa-ti aminteasca povestile copilariei.' },
  { slug: 'harap-alb', name: 'Harap-Alb', domain: 'literatura', tier: 'yellow', difficulty: 2, loreShort: 'In cautare de un copil curajos care cunoaste povestile vechi.' },
  { slug: 'spirit-cartilor', name: 'Spiritul Cartilor', domain: 'literatura', tier: 'red', difficulty: 3, loreShort: 'Spirit ascuns intre paginile bibliotecii. Intreaba de autori si opere.' },
  { slug: 'dragonul-solzi-aur', name: 'Dragonul cu Solzi de Aur', domain: 'literatura', tier: 'gold', difficulty: 3, loreShort: 'Dragon legendar din basme. Apare o data pe sesiune, pentru cei ce stiu povestile mari.' },

  // ===== ARTA-MUZICA =====
  { slug: 'pictorita-florica', name: 'Pictorita Florica', domain: 'arta-muzica', tier: 'green', difficulty: 1, loreShort: 'Mica pictorita cu paleta in mana. Cunoaste culori si tablouri.' },
  { slug: 'violonelul', name: 'Violonelul', domain: 'arta-muzica', tier: 'yellow', difficulty: 2, loreShort: 'Vioara cu personalitate. Canta scurt si intreaba despre compozitori.' },
  { slug: 'maestrul-penseilor', name: 'Maestrul Penseilor', domain: 'arta-muzica', tier: 'red', difficulty: 3, loreShort: 'Pictor batran cu beretul rosu. Cunoaste toate curentele artei.' },

  // ===== MATEMATICA =====
  { slug: 'numarator-vesel', name: 'Numaratorul Vesel', domain: 'matematica', tier: 'green', difficulty: 1, loreShort: 'Mic numarator zburdalnic. Te pune la calcule rapide.' },
  { slug: 'geometru-hexagonal', name: 'Geometrul Hexagonal', domain: 'matematica', tier: 'yellow', difficulty: 2, loreShort: 'Forma geometrica cu suflet. Cunoaste figuri si formule.' },
  { slug: 'calculator-antic', name: 'Calculatorul Antic', domain: 'matematica', tier: 'red', difficulty: 3, loreShort: 'Abac vechi de lemn cu suflet matematic. Iti pune probleme cu logica.' },

  // ===== TEHNOLOGIE =====
  { slug: 'bitul-albastru', name: 'Bitul Albastru', domain: 'tehnologie', tier: 'green', difficulty: 1, loreShort: 'Mic bit curios despre cum functioneaza calculatorul.' },
  { slug: 'robotelul-mihai', name: 'Robotelul Mihai', domain: 'tehnologie', tier: 'yellow', difficulty: 2, loreShort: 'Robotel cu rotite. Intreaba despre inventii si gadgeturi.' },
  { slug: 'inginerul-quantic', name: 'Inginerul Quantic', domain: 'tehnologie', tier: 'red', difficulty: 3, loreShort: 'Robot avansat din viitor. Intreaba despre tehnologii moderne.' },

  // ===== VIATA-COTIDIANA =====
  { slug: 'furnicuta-casnica', name: 'Furnicuta Casnica', domain: 'viata-cotidiana', tier: 'green', difficulty: 1, loreShort: 'Furnicuta harnica cu sort de bucatarie. Cunoaste retete si treburi zilnice.' },
  { slug: 'politist-prieten', name: 'Politistul Prieten', domain: 'viata-cotidiana', tier: 'yellow', difficulty: 2, loreShort: 'Politist tanar zambitor. Te invata regulile de trafic si siguranta.' },
  { slug: 'bunica-inteleapta', name: 'Bunica Inteleapta', domain: 'viata-cotidiana', tier: 'red', difficulty: 3, loreShort: 'Bunica blanda cu un caiet de retete si sfaturi pentru viata.' },
];

// Configuratie tier cufere — mutat din cod (lib/phonedown/award.ts) in DB
// pentru ajustare de game balance fara redeploy. Praguri ales pentru o curba
// motivanta: 5-14 min → Bronze, 15-29 → Silver, 30-59 → Gold, 60-119 → Platinum,
// 120+ → Diamond. Champion = upgrade din Diamond pentru castigator (#1).
type ChestTierSeed = {
  tier: ChestTier;
  minDurationMs: number;
  itemCount: number;
  xpBase: number;
  weightCommon: number;
  weightRare: number;
  weightEpic: number;
  weightLegendary: number;
  upgradeToTier: ChestTier | null;
  guaranteedLegendary?: number;
  guaranteedEpic?: number;
  // 0-100; sansa pe slot ne-garantat sa pice item (vs XP-only). Slot-urile
  // garantate (guaranteed*) NU sunt supuse acestei sanse. Default in DB e 100.
  itemDropChance?: number;
};

// Logica progresiei:
// - BRONZE: 25% sansa pe singurul slot → ~25% chesturi dau un item, restul XP
// - SILVER: 45% sansa → mai bine, dar mereu doar common/rare
// - GOLD: 65% sansa pe ambele sloturi → de regula ~1 item, ocazional 2
// - PLATINUM: 85% sansa pe ambele → aproape mereu 1-2 iteme
// - DIAMOND: 100% pe 2 sloturi + 100% pe al 3-lea (deci 3 iteme garantat) +
//            distributie shifted spre epic/legendary
// - CHAMPION: 1 legendary + 1 epic garantati (in afara rolling-ului)
const CHEST_TIER_CONFIGS: ChestTierSeed[] = [
  {
    tier: 'BRONZE',
    minDurationMs: 5 * 60_000,
    itemCount: 1,
    xpBase: 20,
    weightCommon: 90,
    weightRare: 10,
    weightEpic: 0,
    weightLegendary: 0,
    itemDropChance: 25,
    upgradeToTier: 'SILVER',
  },
  {
    tier: 'SILVER',
    minDurationMs: 15 * 60_000,
    itemCount: 1,
    xpBase: 50,
    weightCommon: 65,
    weightRare: 30,
    weightEpic: 5,
    weightLegendary: 0,
    itemDropChance: 45,
    upgradeToTier: 'GOLD',
  },
  {
    tier: 'GOLD',
    minDurationMs: 30 * 60_000,
    itemCount: 2,
    xpBase: 100,
    weightCommon: 40,
    weightRare: 45,
    weightEpic: 14,
    weightLegendary: 1,
    itemDropChance: 65,
    upgradeToTier: 'PLATINUM',
  },
  {
    tier: 'PLATINUM',
    minDurationMs: 60 * 60_000,
    itemCount: 2,
    xpBase: 200,
    weightCommon: 15,
    weightRare: 45,
    weightEpic: 35,
    weightLegendary: 5,
    itemDropChance: 85,
    upgradeToTier: 'DIAMOND',
  },
  {
    tier: 'DIAMOND',
    minDurationMs: 120 * 60_000,
    itemCount: 3,
    xpBase: 400,
    weightCommon: 0,
    weightRare: 30,
    weightEpic: 50,
    weightLegendary: 20,
    // Cu 1 epic garantat + drop chance 100 pe restul de 2 sloturi → mereu 3
    // iteme. Plus distributia shifted spre epic/legendary.
    guaranteedEpic: 1,
    itemDropChance: 100,
    upgradeToTier: 'CHAMPION',
  },
  {
    // Special: loot deterministic (1 legendary garantat + 1 epic). Rolling-ul
    // nu se aplica peste guarantee — toate weight-urile sunt 0.
    tier: 'CHAMPION',
    minDurationMs: 0, // nu se atribuie direct ca baza, doar prin upgrade
    itemCount: 2,
    xpBase: 600,
    weightCommon: 0,
    weightRare: 0,
    weightEpic: 0,
    weightLegendary: 0,
    upgradeToTier: null,
    guaranteedLegendary: 1,
    guaranteedEpic: 1,
    itemDropChance: 100,
  },
];

const RARITY_DUPLICATE_XP: { rarity: Rarity; xp: number }[] = [
  { rarity: 'COMMON', xp: 5 },
  { rarity: 'RARE', xp: 15 },
  { rarity: 'EPIC', xp: 40 },
  { rarity: 'LEGENDARY', xp: 100 },
];

async function seedChestConfig() {
  for (const cfg of CHEST_TIER_CONFIGS) {
    const visual = CHEST_TIER_VISUALS[cfg.tier];
    const miniSvg = readChestSvg(visual.miniSvgPath);
    const bodySvg = readChestSvg(visual.bodySvgPath);
    const lidSvg = readChestSvg(visual.lidSvgPath);
    await prisma.chestTierConfig.upsert({
      where: { tier: cfg.tier },
      create: {
        ...cfg,
        guaranteedLegendary: cfg.guaranteedLegendary ?? 0,
        guaranteedEpic: cfg.guaranteedEpic ?? 0,
        ...visual,
        miniSvg,
        bodySvg,
        lidSvg,
      },
      update: {
        ...cfg,
        guaranteedLegendary: cfg.guaranteedLegendary ?? 0,
        guaranteedEpic: cfg.guaranteedEpic ?? 0,
        ...visual,
        miniSvg,
        bodySvg,
        lidSvg,
      },
    });
  }
  for (const dup of RARITY_DUPLICATE_XP) {
    await prisma.rarityDuplicateXp.upsert({
      where: { rarity: dup.rarity },
      create: dup,
      update: dup,
    });
  }
}

// Upsert pentru slotul "holding" + cleanup orphan, intotdeauna (idempotent).
// Setul de accesorii se schimba mai des decat restul catalogului si vrem ca
// modificarile sa se reflecte fara FORCE_SEED. Cleanup-ul rezolva cazul cand
// am scos un accesoriu din seed — avatarurile care il aveau echipat sunt
// resetate la default (hd-00) si SVG-urile re-randate.
async function seedHoldingAlways() {
  const holdingType = TYPES.find((t) => t.slug === 'holding');
  if (!holdingType) return;

  const typeRow = await prisma.itemType.upsert({
    where: { slug: 'holding' },
    create: { slug: 'holding', name: holdingType.name, group: holdingType.group, sortOrder: 99 },
    update: { name: holdingType.name, group: holdingType.group },
  });

  for (const [itemIdx, item] of holdingType.items.entries()) {
    const extras = {
      rarity: item.rarity ?? 'COMMON',
      exclusive: item.exclusive ?? false,
      attachmentPoint: item.attachmentPoint ?? null,
    } as const;
    await prisma.item.upsert({
      where: { slug: item.slug },
      create: {
        slug: item.slug, name: item.name, feature: item.feature,
        level: item.level, sortOrder: itemIdx, typeId: typeRow.id, ...extras,
      },
      update: {
        name: item.name, feature: item.feature,
        level: item.level, sortOrder: itemIdx, typeId: typeRow.id, ...extras,
      },
    });
  }
}

async function cleanupOrphanHolding() {
  const holdingType = await prisma.itemType.findUnique({
    where: { slug: 'holding' },
    include: { items: { select: { id: true, slug: true } } },
  });
  if (!holdingType) return;

  const seedHolding = TYPES.find((t) => t.slug === 'holding');
  if (!seedHolding) return;
  const allowedSlugs = new Set(seedHolding.items.map((i) => i.slug));

  const orphans = holdingType.items.filter((i) => !allowedSlugs.has(i.slug));
  if (orphans.length === 0) return;

  const defaultHolding = holdingType.items.find((i) => i.slug === 'hd-00');
  if (!defaultHolding) {
    console.warn('cleanupOrphanHolding: hd-00 lipseste, sar peste cleanup');
    return;
  }

  const orphanIds = orphans.map((o) => o.id);
  // Reseteaza holdingItemId la default + invalideaza svgBlink (nullable) pentru
  // re-render lazy in GET /me/avatar. `svg` ramane pana la urmatorul PATCH din
  // editor — coloana e NOT NULL si nu vrem dependinta de src/ in seed (runner
  // Docker n-are src/, doar dist/). Vizual: avatarul poate ramane temporar cu
  // accesoriul vechi randat in cache pana cand user-ul re-salveaza.
  const reset = await prisma.avatar.updateMany({
    where: { holdingItemId: { in: orphanIds } },
    data: { holdingItemId: defaultHolding.id, svgBlink: null },
  });

  await prisma.item.deleteMany({ where: { id: { in: orphanIds } } });
  console.log(
    `cleanupOrphanHolding: sterse ${orphans.length} accesorii orphan (${orphans.map((o) => o.slug).join(', ')}), ${reset.count} avatare resetate la hd-00`,
  );
}

// Sterge UserItem-uri inserate de iteratia initiala de backfill care a acordat
// ownership pe accesorii din avataruri (vechiul cod nu distingea face/body de
// accesorii). Cu noul cod, accesoriile (attachmentPoint != null, slug !=
// default per slot) sunt drop-only — owner-ul lor trebuie sa vina exclusiv din
// chesturi. Ruleaza intotdeauna; e idempotent (sterge doar randurile care
// indeplinesc conditia).
async function cleanupOrphanUserItems() {
  const defaultSlugs = Object.values({
    skin: 'skin-02',
    hairColor: 'hc-02',
    hair: 'h-02',
    eyes: 'e-01',
    mouth: 'm-01',
    eyebrows: 'eb-03',
    glasses: 'g-00',
    earrings: 'a-00',
    features: 'f-00',
    bodyShape: 'bs-medium',
    top: 't-01',
    outerwear: 'ow-00',
    bottom: 'b-01',
    footwear: 'fw-01',
    holding: 'hd-00',
  });
  const accessoryItems = await prisma.item.findMany({
    where: {
      attachmentPoint: { not: null },
      slug: { notIn: defaultSlugs },
    },
    select: { id: true, slug: true },
  });
  if (accessoryItems.length === 0) return;
  const accessoryIds = accessoryItems.map((i) => i.id);

  // Step 1: sterge ownership pe accesorii cu source != 'chest' (echipari
  // accidentale, backfill vechi). 'chest' ramane — alea sunt achizitii reale.
  const delSpurious = await prisma.userItem.deleteMany({
    where: {
      itemId: { in: accessoryIds },
      source: { not: 'chest' },
    },
  });
  if (delSpurious.count > 0) {
    console.log(`cleanupOrphanUserItems: sters ${delSpurious.count} ownership-uri non-chest pe accesorii`);
  }

  // Step 2: pt fiecare UserItem cu source='chest', verifica ca exista intr-un
  // chest deschis al user-ului. Daca nu, sterge (probably backfill stricat).
  const chestOwnership = await prisma.userItem.findMany({
    where: { itemId: { in: accessoryIds }, source: 'chest' },
    select: { id: true, userId: true, itemId: true, item: { select: { slug: true } } },
  });
  let invalidated = 0;
  for (const ui of chestOwnership) {
    const chests = await prisma.chest.findMany({
      where: { userId: ui.userId, openedAt: { not: null } },
      select: { lootJson: true },
    });
    const ownedFromOpenedChest = chests.some((c) => {
      const loot = c.lootJson as { items?: { itemId?: string; slug?: string }[] } | null;
      if (!loot?.items) return false;
      return loot.items.some(
        (it) => it.itemId === ui.itemId || it.slug === ui.item.slug,
      );
    });
    if (!ownedFromOpenedChest) {
      await prisma.userItem.delete({ where: { id: ui.id } });
      invalidated++;
    }
  }
  if (invalidated > 0) {
    console.log(`cleanupOrphanUserItems: sters ${invalidated} ownership-uri pe accesorii care NU sunt confirmate intr-un chest deschis`);
  }
}

// Backfill UserItem din avataruri existente si chesturi deschise. Ruleaza
// intotdeauna (idempotent via @@unique pe (userId, itemId) + skipDuplicates).
// Necesar dupa migratia user_item ca user-ii existenti sa-si detina item-urile
// echipate, altfel detectia duplicate la chest open i-ar reseta progress-ul.
async function backfillUserItems() {
  // 1. Iteme din avataruri echipate.
  const avatars = await prisma.avatar.findMany({
    select: {
      userId: true,
      skinItemId: true,
      hairColorItemId: true,
      hairItemId: true,
      eyesItemId: true,
      mouthItemId: true,
      eyebrowsItemId: true,
      glassesItemId: true,
      earringsItemId: true,
      featuresItemId: true,
      bodyShapeItemId: true,
      topItemId: true,
      outerwearItemId: true,
      bottomItemId: true,
      footwearItemId: true,
      holdingItemId: true,
    },
  });
  const avatarRows: { userId: string; itemId: string; source: string }[] = [];
  for (const a of avatars) {
    const ids = new Set<string>([
      a.skinItemId, a.hairColorItemId, a.hairItemId, a.eyesItemId,
      a.mouthItemId, a.eyebrowsItemId, a.glassesItemId, a.earringsItemId,
      a.featuresItemId, a.bodyShapeItemId, a.topItemId, a.outerwearItemId,
      a.bottomItemId, a.footwearItemId, a.holdingItemId,
    ]);
    for (const itemId of ids) {
      avatarRows.push({ userId: a.userId, itemId, source: 'default_avatar' });
    }
  }
  if (avatarRows.length > 0) {
    const r1 = await prisma.userItem.createMany({ data: avatarRows, skipDuplicates: true });
    console.log(`backfillUserItems: ${r1.count} randuri din avataruri`);
  }

  // 2. Iteme din chesturi deschise (loot.items[].itemId).
  const openedChests = await prisma.chest.findMany({
    where: { openedAt: { not: null } },
    select: { userId: true, lootJson: true },
  });
  const chestRows: { userId: string; itemId: string; source: string }[] = [];
  for (const c of openedChests) {
    const loot = c.lootJson as { items?: { itemId?: string }[] } | null;
    if (!loot?.items) continue;
    for (const it of loot.items) {
      if (it.itemId) chestRows.push({ userId: c.userId, itemId: it.itemId, source: 'chest' });
    }
  }
  if (chestRows.length > 0) {
    const r2 = await prisma.userItem.createMany({ data: chestRows, skipDuplicates: true });
    console.log(`backfillUserItems: ${r2.count} randuri din chesturi deschise`);
  }
}

// Lumile story-adventure se seed-uiesc MEREU (idempotent prin upsert pe slug),
// nu sub skip guard-ul de catalog — altfel lumi noi nu apar la rebuild fara
// FORCE_SEED. Fundalurile NU se ating (le populeaza user-ul manual).
async function seedAdventureWorlds() {
  for (const w of ADVENTURE_WORLDS) {
    await prisma.adventureWorld.upsert({
      where: { slug: w.slug },
      create: {
        slug: w.slug,
        speciesSlug: w.speciesSlug,
        domain: w.domain,
        name: w.name,
        lore: w.lore,
        bossName: w.bossName,
        bossLore: w.bossLore,
        accentColor: w.accentColor,
        bgColor: w.bgColor,
        obstacleStyle: w.obstacleStyle,
        sortOrder: w.sortOrder,
        active: true,
      },
      update: {
        speciesSlug: w.speciesSlug,
        domain: w.domain,
        name: w.name,
        lore: w.lore,
        bossName: w.bossName,
        bossLore: w.bossLore,
        accentColor: w.accentColor,
        bgColor: w.bgColor,
        obstacleStyle: w.obstacleStyle,
        sortOrder: w.sortOrder,
        active: true,
      },
    });
  }
  // Dezactiveaza lumi scoase din lista (audit-friendly, ca la monstri).
  const allWorldSlugs = ADVENTURE_WORLDS.map((w) => w.slug);
  await prisma.adventureWorld.updateMany({
    where: { slug: { notIn: allWorldSlugs } },
    data: { active: false },
  });
  console.log(`seedAdventureWorlds: ${ADVENTURE_WORLDS.length} lumi`);
}

// Fundalurile de journey (per pet × per capitol). Idempotent prin upsert pe `key`.
// `videoUrl` ramane NULL — il completeaza user-ul manual (Prisma Studio sau SQL)
// cu URL-uri MP4 reale spre CDN. Pana atunci, mobile foloseste imageUrl static
// ca fallback. `imageUrl` e poster placeholder via picsum.photos cu seed
// deterministic — landscape stabil per cheie, schimbabil oricand.
type SeedJourneyBackground = {
  key: string;
  petSlug: string;
  name: string;
  sortOrder: number;
};

const JOURNEY_BACKGROUNDS: SeedJourneyBackground[] = [
  // Vader — galaxie / spatiu
  { key: 'vader-ch1-planeta-rosie', petSlug: 'darth-vader', name: 'Planeta Rosie', sortOrder: 0 },
  { key: 'vader-ch2-nebuloasa', petSlug: 'darth-vader', name: 'Nebuloasa Furtunoasa', sortOrder: 1 },
  // Stitch — insula
  { key: 'stitch-ch1-plaja', petSlug: 'stitch', name: 'Plaja Tropicala', sortOrder: 0 },
  { key: 'stitch-ch2-vulcan', petSlug: 'stitch', name: 'Muntele Vulcanic', sortOrder: 1 },
  // Yoda — Tatooine
  { key: 'yoda-ch1-desert', petSlug: 'yoda', name: 'Desertul Arsitei', sortOrder: 0 },
  { key: 'yoda-ch2-apus', petSlug: 'yoda', name: 'Apusul cu Doi Sori', sortOrder: 1 },
  // Groot — padurea
  { key: 'groot-ch1-padure', petSlug: 'groot', name: 'Padurea Adanca', sortOrder: 0 },
  { key: 'groot-ch2-luminis', petSlug: 'groot', name: 'Luminisul Stralucitor', sortOrder: 1 },
  // Dog — oras / parc
  { key: 'dog-ch1-parc', petSlug: 'dog', name: 'Parcul Vesel', sortOrder: 0 },
  { key: 'dog-ch2-oras', petSlug: 'dog', name: 'Orasul de Seara', sortOrder: 1 },
];

async function seedJourneyBackgrounds() {
  for (const b of JOURNEY_BACKGROUNDS) {
    // Poster deterministic via picsum.photos — landscape stabil per cheie pana
    // cand user-ul inlocuieste imageUrl cu thumbnail-ul real.
    const posterUrl = `https://picsum.photos/seed/${b.key}/600/300`;
    await prisma.profileBackground.upsert({
      where: { key: b.key },
      create: {
        key: b.key,
        petSlug: b.petSlug,
        name: b.name,
        imageUrl: posterUrl,
        // videoUrl ramane NULL — completat manual cand sunt gata clipurile.
        tier: 1,
        sortOrder: b.sortOrder,
        active: true,
      },
      update: {
        petSlug: b.petSlug,
        name: b.name,
        sortOrder: b.sortOrder,
        active: true,
        // NU suprascriem imageUrl/videoUrl — daca user-ul le-a populat manual,
        // raman editari ale lui. Modificare numelui = update aici, re-seed.
      },
    });
  }
  console.log(`seedJourneyBackgrounds: ${JOURNEY_BACKGROUNDS.length} fundaluri`);
}

async function main() {
  // Config-ul de cufere ruleaza intotdeauna (idempotent prin upsert, ~7 randuri
  // total) — vrem sa putem ajusta game balance fara FORCE_SEED.
  await seedChestConfig();

  // Slot "holding" se evolueaza des — upsert mereu + cleanup orphan items.
  await seedHoldingAlways();
  await cleanupOrphanHolding();

  // Lumile de aventura ruleaza mereu (nu sub skip guard).
  await seedAdventureWorlds();

  // Fundalurile journey — ruleaza mereu (idempotent prin upsert pe `key`).
  // Modificarile manuale ale imageUrl/videoUrl in DB sunt preservate.
  await seedJourneyBackgrounds();

  // Pool-ul de intrebari journey ruleaza mereu — idempotent prin (domain,prompt).
  // Adaugare intrebari noi → urcari de fisier + container restart.
  await seedJourneyQuestions(prisma);

  // Cleanup ownership orphan + Backfill UserItem (idempotent) — pt useri existenti.
  await cleanupOrphanUserItems();
  await backfillUserItems();

  // Skip seed cand DB e deja populata — evita 100+ upsert-uri la fiecare
  // container restart. Cand adaugi item-uri/carduri/challenges noi in seed,
  // ruleaza cu FORCE_SEED=1 pentru o aplicare unica si dupa scoate flagul.
  if (process.env.FORCE_SEED !== '1') {
    const existingItems = await prisma.item.count();
    if (existingItems > 0) {
      console.log(
        `Seed skipped: catalog populat deja (${existingItems} items). FORCE_SEED=1 ca sa rulezi.`,
      );
      return;
    }
  }

  for (const [typeIdx, type] of TYPES.entries()) {
    const typeRow = await prisma.itemType.upsert({
      where: { slug: type.slug },
      create: { slug: type.slug, name: type.name, group: type.group, sortOrder: typeIdx },
      update: { name: type.name, group: type.group, sortOrder: typeIdx },
    });

    for (const [itemIdx, item] of type.items.entries()) {
      const extras = {
        rarity: item.rarity ?? 'COMMON',
        exclusive: item.exclusive ?? false,
        attachmentPoint: item.attachmentPoint ?? null,
      } as const;
      await prisma.item.upsert({
        where: { slug: item.slug },
        create: {
          slug: item.slug,
          name: item.name,
          feature: item.feature,
          level: item.level,
          sortOrder: itemIdx,
          typeId: typeRow.id,
          ...extras,
        },
        update: {
          name: item.name,
          feature: item.feature,
          level: item.level,
          sortOrder: itemIdx,
          typeId: typeRow.id,
          ...extras,
        },
      });
    }
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
        domain: ch.domain,
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
        domain: ch.domain,
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

  for (const m of MONSTER_TEMPLATES) {
    await prisma.monsterTemplate.upsert({
      where: { slug: m.slug },
      create: {
        slug: m.slug,
        name: m.name,
        domain: m.domain,
        tier: m.tier,
        difficulty: m.difficulty,
        loreShort: m.loreShort,
        active: true,
      },
      update: {
        name: m.name,
        domain: m.domain,
        tier: m.tier,
        difficulty: m.difficulty,
        loreShort: m.loreShort,
        active: true,
      },
    });
  }

  // Dezactiveaza monstri scoasi din lista — raman in DB ca audit dar spawn-ul
  // nu ii mai vede. Acelasi pattern ca la challenges.
  const allMonsterSlugs = MONSTER_TEMPLATES.map((m) => m.slug);
  await prisma.monsterTemplate.updateMany({
    where: { slug: { notIn: allMonsterSlugs } },
    data: { active: false },
  });

  const domainResult = await seedDomains(prisma);

  const counts = await prisma.item.count();
  console.log(
    `Seed complete: ${TYPES.length} types, ${counts} items, ${CHALLENGES.length} hunt challenges, ${MONSTER_TEMPLATES.length} monster templates, ${domainResult.count} domains`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
