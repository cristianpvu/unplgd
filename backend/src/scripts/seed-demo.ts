// Seed DEMO pentru prezentarea licentei — populeaza un univers realist in
// jurul contului principal (default office@dinedroid.com):
//
//   - 7 prieteni demo cu nume romanesti, avatare RANDOMIZATE (renderate
//     server-side din catalogul de iteme), pet-uri diferite, nivele diferite
//   - prietenii ACCEPTED (nfc/ble) cu istoric de intalniri pe ultimele 2
//     saptamani + o cerere PENDING (demo accept live)
//   - povesti scrise de prieteni si de contul principal, cu keyFacts valide,
//     like-uri, claim VERIFIED si UN LANT de poveste (prietenul a extins
//     povestea contului principal)
//   - screen-time: zilele saptamanii curente + saptamana trecuta FINALIZATA
//     cu contul principal pe locul 1 (cel mai putin timp pe ecran)
//   - cufere neschise (SILVER/GOLD/PLATINUM/CHAMPION) cu loot rolat prin
//     logica de productie + un istoric PhoneDown (2 sesiuni ENDED, una
//     castigata)
//   - carduri NFC de pet revendicate (colectie pt demo de switch), memorii
//     de pet (chat-ul "isi aminteste"), bond XP
//   - skills + domenii (profil bogat pe radar), quest-uri pe azi (1 complet,
//     1 in progres), notificari in-app, progres Journey cap. 1 (deblocat
//     fundal de profil, cap. 2 jucabil LIVE la demo)
//
// NU atinge avatarul/pet-ul/parola contului principal daca exista deja.
// Idempotent: re-rularea nu dubleaza (upsert/unique + awardXp idempotent).
//
// Run pe server:
//   docker compose -f docker-compose.prod.yml exec backend \
//     node dist/scripts/seed-demo.js [--email office@dinedroid.com] [--clean]
// Local:
//   npx tsx src/scripts/seed-demo.ts [--email ...] [--clean]
//
// --clean sterge userii demo (cascade) + artefactele demo de pe contul
// principal (identificate prin sourceType/uid/titluri 'demo').

import {
  ChestTier,
  FriendshipStatus,
  InteractionMethod,
  PhoneDownParticipantStatus,
  PhoneDownStatus,
  type Item,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/hash.js';
import { ensureDefaultPet } from '../lib/pet.js';
import { ensureDefaultAvatar } from '../lib/avatar/defaults.js';
import { renderAvatarBlinkSvg, renderAvatarSvg } from '../lib/avatar/render.js';
import { SLOTS, type Slot } from '../lib/avatar/catalog.js';
import { awardXp } from '../lib/xp.js';
import { awardSkillXp, SKILLS_VALID, type Skill } from '../lib/skills.js';
import { awardDomainXp } from '../lib/domains.js';
import { dayKey, isoWeekKey, rankReward, weekDaysFor } from '../lib/screentime.js';
import {
  loadDroppableItems,
  loadTierConfigs,
  rollItemsForTier,
  type ChestLoot,
} from '../lib/phonedown/award.js';

const DEMO_EMAIL_DOMAIN = 'unplgd.demo';
const DEMO_PASSWORD = 'demo1234';
const SRC = 'demo_seed'; // sourceType pt XP/skill/domain — permite --clean tintit

// ============================= RNG reproductibil =============================

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function daysAgo(n: number, hour = 12, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ============================= Datele prietenilor =============================

type FriendSpec = {
  key: string; // sufix email
  name: string;
  age: number;
  level: number; // nivel tinta (xp = (level-1)^2 * 100 + putin peste)
  petName: string;
  // Profil screen-time: media de minute/zi (contul principal va avea mai putin)
  screenAvg: number;
  skills: Skill[];
  domains: string[]; // filtrate la runtime dupa Domain existente
  friendship: 'accepted' | 'pending'; // pending = cerere INTRATA catre main
  daysMet: number[]; // in urma cu cate zile s-au vazut (DailyInteraction)
  story?: { title: string; body: string; keyFacts: { q: string; expected: string }[] };
};

const FRIENDS: FriendSpec[] = [
  {
    key: 'maria', name: 'Maria Ionescu', age: 9, level: 6, petName: 'Nora',
    screenAvg: 130, skills: ['creativitate', 'empatie'],
    domains: ['povesti', 'arta', 'animale'], friendship: 'accepted',
    daysMet: [1, 3, 4, 8, 11],
    story: {
      title: 'Vulpea care colectiona culori',
      body: 'Intr-o padure de la marginea orasului traia o vulpe pe nume Rubina. Rubina nu aduna nuci sau pene, ci CULORI: dimineata fura auriul rasaritului, la pranz imprumuta verdele frunzelor, iar seara cersea de la cer o felie de mov. Le pastra in borcane de sticla ascunse sub un stejar batran. Intr-o iarna, orasul a ramas cenusiu — norii au inghitit toate culorile. Copiii nu mai zambeau. Rubina si-a deschis borcanele si a suflat culorile inapoi pe cer, una cate una, pana cand orasul a stralucit din nou. De atunci, in fiecare seara, cerul ii lasa Rubinei o culoare noua, drept multumire.',
      keyFacts: [
        { q: 'Cum se numea vulpea?', expected: 'Rubina' },
        { q: 'Ce colectiona vulpea?', expected: 'culori' },
        { q: 'Unde isi ascundea borcanele?', expected: 'sub un stejar batran' },
        { q: 'Ce s-a intamplat cu orasul intr-o iarna?', expected: 'a ramas cenusiu, norii au inghitit culorile' },
        { q: 'Ce a facut Rubina ca sa salveze orasul?', expected: 'a suflat culorile din borcane inapoi pe cer' },
      ],
    },
  },
  {
    key: 'andrei', name: 'Andrei Popescu', age: 10, level: 8, petName: 'Fulger',
    screenAvg: 165, skills: ['logica', 'perseverenta'],
    domains: ['tehnologie', 'spatiu', 'strategie'], friendship: 'accepted',
    daysMet: [1, 2, 5, 6, 9, 12],
    story: {
      title: 'Robotul care visa sa fie astronaut',
      body: 'Bip-7 era un robotel de bucatarie care spala vase intr-un restaurant. In fiecare noapte, cand se incarca la priza, visa acelasi vis: plutea printre stele. Intr-o zi a gasit in cosul de gunoi o carte rupta despre planete si a invatat-o pe de rost. A construit din oale si tigai o racheta mica, iar din capacul unei cratite si-a facut casca. Prima lansare a fost un dezastru: a zburat doar pana pe acoperis. Dar de pe acoperis, Bip-7 a vazut pentru prima data cerul intreg. Un satelit batran care trecea pe deasupra i-a trimis un semnal: "Nu conteaza cat de sus ajungi, conteaza ca privesti in sus." Bip-7 spala si acum vase, dar in fiecare noapte urca pe acoperis si vorbeste cu satelitii, ca un adevarat astronaut de cartier.',
      keyFacts: [
        { q: 'Cum se numea robotul?', expected: 'Bip-7' },
        { q: 'Ce facea robotul la restaurant?', expected: 'spala vase' },
        { q: 'Din ce si-a construit racheta?', expected: 'din oale si tigai' },
        { q: 'Pana unde a zburat la prima lansare?', expected: 'pana pe acoperis' },
        { q: 'Ce i-a transmis satelitul batran?', expected: 'nu conteaza cat de sus ajungi, conteaza ca privesti in sus' },
      ],
    },
  },
  {
    key: 'ioana', name: 'Ioana Dumitrescu', age: 8, level: 4, petName: 'Stelutza',
    screenAvg: 95, skills: ['curiozitate', 'empatie'],
    domains: ['animale', 'natura'], friendship: 'accepted',
    daysMet: [2, 7, 13],
    story: {
      title: 'Melcul care a castigat maratonul',
      body: 'In gradina bunicii se organiza in fiecare vara Maratonul Micilor Vietati. Iepurele castigase de sapte ori, iar melcul Tudorel se inscria mereu si termina mereu ultimul, la doua zile dupa toti. Anul acesta, in mijlocul cursei, a venit o furtuna mare. Iepurele s-a ascuns, gargarita a zburat acasa, furnicile s-au ratacit. Doar Tudorel, cu casa in spate, a mers mai departe prin ploaie — el isi ducea adapostul cu el. A trecut linia de sosire singur, ud si fericit, dupa trei zile. Bunica i-a pus medalia de aur pe cochilie si toata gradina a inteles lectia: nu castiga mereu cel mai rapid, ci acela care nu se opreste.',
      keyFacts: [
        { q: 'Cum se numea melcul?', expected: 'Tudorel' },
        { q: 'Unde se tinea maratonul?', expected: 'in gradina bunicii' },
        { q: 'Cine castigase de sapte ori?', expected: 'iepurele' },
        { q: 'Ce a venit in mijlocul cursei?', expected: 'o furtuna' },
        { q: 'De ce a putut Tudorel sa continue prin ploaie?', expected: 'pentru ca isi ducea casa/adapostul cu el' },
      ],
    },
  },
  {
    key: 'luca', name: 'Luca Stanescu', age: 11, level: 9, petName: 'Rex',
    screenAvg: 210, skills: ['sociabilitate', 'perseverenta'],
    domains: ['sport', 'strategie'], friendship: 'accepted',
    daysMet: [1, 4, 6, 10],
  },
  {
    key: 'sofia', name: 'Sofia Radu', age: 9, level: 5, petName: 'Luna',
    screenAvg: 115, skills: ['creativitate', 'curiozitate'],
    domains: ['arta', 'povesti', 'spatiu'], friendship: 'accepted',
    daysMet: [3, 5, 12],
    story: {
      title: 'Fetita care picta vise',
      body: 'Ilinca avea o cutie de acuarele mostenita de la strabunica ei. Nu erau acuarele obisnuite: tot ce picta Ilinca seara aparea in visul cuiva din casa. A pictat o mare calda — bunicul a visat ca inoata ca la 20 de ani. A pictat un zmeu urias — fratele ei a visat ca zboara deasupra blocului. Intr-o seara, pisica lor Mura era bolnava si trista. Ilinca a pictat pentru ea un camp intreg de fluturi lenesi, usor de prins. Dimineata, Mura torcea fericita, iar veterinarul n-a inteles de ce s-a inzdravenit asa repede. Ilinca stie secretul: uneori, cel mai bun medicament e un vis frumos, daruit de cineva care te iubeste.',
      keyFacts: [
        { q: 'Cum se numea fetita?', expected: 'Ilinca' },
        { q: 'De la cine mostenise acuarelele?', expected: 'de la strabunica' },
        { q: 'Ce se intampla cu picturile ei de seara?', expected: 'apareau in visele cuiva din casa' },
        { q: 'Cum se numea pisica bolnava?', expected: 'Mura' },
        { q: 'Ce a pictat Ilinca pentru pisica?', expected: 'un camp de fluturi lenesi, usor de prins' },
      ],
    },
  },
  {
    key: 'david', name: 'David Munteanu', age: 10, level: 7, petName: 'Ghinda',
    screenAvg: 145, skills: ['logica', 'curiozitate'],
    domains: ['stiinte', 'istorie', 'tehnologie'], friendship: 'accepted',
    daysMet: [2, 8],
  },
  {
    key: 'ana', name: 'Ana Gheorghe', age: 12, level: 10, petName: 'Pixel',
    screenAvg: 120, skills: ['sociabilitate', 'creativitate'],
    domains: ['povesti', 'sociale'], friendship: 'pending',
    daysMet: [],
  },
];

// Povestile contului principal — a doua e radacina LANTULUI (Maria o extinde).
const MAIN_STORIES = [
  {
    title: 'Dragonul care stranuta baloane',
    body: 'Pe muntele Vantosu traia Pufos, singurul dragon din lume alergic la... nori. De cate ori un nor ii intra in nari, Pufos stranuta — dar in loc de foc, din nasul lui ieseau sute de baloane colorate. Ceilalti dragoni radeau de el: un dragon fara foc e ca o furtuna fara tunete. Intr-o zi, satul de la poalele muntelui a organizat un targ pentru copii, dar vanzatorul de baloane nu a mai ajuns — i se dezumflasera toate pe drum. Copiii plangeau. Pufos a zburat deasupra targului, a tras adanc in piept un nor intreg si a stranutat cel mai mare stranut din istoria dragonilor: cerul s-a umplut de trei mii de baloane. De atunci, la fiecare targ, copiii nu mai striga "vine dragonul!", ci "vine Pufos, tineti-va de baloane!".',
    keyFacts: [
      { q: 'Cum se numea dragonul?', expected: 'Pufos' },
      { q: 'La ce era alergic dragonul?', expected: 'la nori' },
      { q: 'Ce iesea cand stranuta, in loc de foc?', expected: 'baloane colorate' },
      { q: 'Ce s-a intamplat cu vanzatorul de baloane?', expected: 'nu a mai ajuns, i se dezumflasera baloanele pe drum' },
      { q: 'Cate baloane a stranutat Pufos deasupra targului?', expected: 'trei mii' },
    ],
  },
  {
    title: 'Farul care se temea de intuneric',
    body: 'La capatul unui golf statea un far batran pe nume Lumin. Toata lumea credea ca farurile sunt curajoase, dar Lumin avea un secret: se temea de intuneric. De aceea lumina lui era cea mai puternica de pe toata coasta — o tinea aprinsa si pentru corabii, si pentru el. Intr-o noapte, o furtuna i-a spart becul urias. Bezna l-a inghitit, iar in larg o corabie cu pescari cauta drumul spre casa. Lumin a strans tot curajul din caramizile lui si a inceput sa cante — un cantec adanc, ca o sirena de ceata. Pescarii au urmat vocea si au ajuns teferi la mal. Dimineata, cand i-au schimbat becul, Lumin a inteles ca lumina lui adevarata nu venise niciodata de la bec.',
    keyFacts: [
      { q: 'Cum se numea farul?', expected: 'Lumin' },
      { q: 'Care era secretul farului?', expected: 'se temea de intuneric' },
      { q: 'Ce i-a spart furtuna?', expected: 'becul' },
      { q: 'Cum i-a ghidat pe pescari fara lumina?', expected: 'a cantat, ca o sirena de ceata' },
      { q: 'Ce a inteles Lumin dimineata?', expected: 'ca lumina lui adevarata nu venea de la bec' },
    ],
  },
];

// Capitolul cu care Maria extinde "Farul care se temea de intuneric".
const CHAIN_EXTENSION = {
  title: 'Farul si licuricii',
  body: 'Dupa noaptea furtunii, vestea despre farul care canta s-a dus pana in padurea de langa golf. Licuricii, care se antrenau toata vara sa lumineze cat mai tare, au venit intr-o seara in vizita la Lumin. "Invata-ne sa cantam", i-au cerut ei, "pentru cand ne obosesc luminitele." Lumin i-a invatat cantecul de ceata, iar ei l-au invatat in schimb dansul licuricilor. Acum, in noptile de vara, corabiile care trec prin golf vad un spectacol unic: un far batran care canta, inconjurat de mii de lumini mici care danseaza. Iar pescarii spun ca in golful acela nu s-a mai ratacit nimeni, niciodata.',
  // Cumulative: acopera si originalul, si extensia.
  keyFacts: [
    { q: 'Cum se numea farul?', expected: 'Lumin' },
    { q: 'De ce se temea farul?', expected: 'de intuneric' },
    { q: 'Cine a venit in vizita la far?', expected: 'licuricii' },
    { q: 'Ce l-au rugat licuricii sa ii invete?', expected: 'sa cante' },
    { q: 'Ce au invatat ei pe far in schimb?', expected: 'dansul licuricilor' },
  ],
};

// Memoriile pet-ului despre copil — chat-ul le injecteaza in prompt.
const PET_MEMORIES = [
  'Ii place foarte mult inghetata de fistic',
  'Are un frate mai mic care il incurca la teme',
  'Viseaza sa devina inventator si sa construiasca un robot',
  'Echipa lui preferata a castigat meciul saptamana trecuta si a fost foarte fericit',
];

// ============================= Helpers =============================

async function randomAvatar(userId: string, seedKey: string): Promise<void> {
  const existing = await prisma.avatar.findUnique({ where: { userId } });
  if (existing) return;

  const rng = mulberry32(hashCode(seedKey));
  const types = await prisma.itemType.findMany({ include: { items: true } });
  const byType = new Map(types.map((t) => [t.slug, t.items]));

  // Accesoriile arata mai natural "Fara" in majoritatea cazurilor.
  const preferNone: Partial<Record<Slot, number>> = {
    glasses: 0.7, earrings: 0.8, features: 0.75, outerwear: 0.6, holding: 0.6,
  };

  const equipped = {} as Record<Slot, Item>;
  for (const slot of SLOTS) {
    const items = byType.get(slot) ?? [];
    if (items.length === 0) return; // catalog incomplet — abort silent
    const noneItem = items.find((i) => i.feature === null);
    const noneChance = preferNone[slot];
    if (noneItem && noneChance !== undefined && rng() < noneChance) {
      equipped[slot] = noneItem;
    } else {
      equipped[slot] = pick(rng, items);
    }
  }

  const svg = renderAvatarSvg(equipped);
  const svgBlink = renderAvatarBlinkSvg(equipped);
  await prisma.avatar.create({
    data: {
      userId,
      svg,
      svgBlink,
      skinItemId: equipped.skin.id,
      hairColorItemId: equipped.hairColor.id,
      hairItemId: equipped.hair.id,
      eyesItemId: equipped.eyes.id,
      mouthItemId: equipped.mouth.id,
      eyebrowsItemId: equipped.eyebrows.id,
      glassesItemId: equipped.glasses.id,
      earringsItemId: equipped.earrings.id,
      featuresItemId: equipped.features.id,
      bodyShapeItemId: equipped.bodyShape.id,
      topItemId: equipped.top.id,
      outerwearItemId: equipped.outerwear.id,
      bottomItemId: equipped.bottom.id,
      footwearItemId: equipped.footwear.id,
      holdingItemId: equipped.holding.id,
    },
  });
}

function birthDateForAge(age: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  d.setMonth(3, 15); // 15 aprilie — evita edge-uri de zi de nastere azi
  d.setHours(0, 0, 0, 0);
  return d;
}

async function existingDomainSlugs(want: string[]): Promise<string[]> {
  const rows = await prisma.domain.findMany({
    where: { slug: { in: want }, active: true },
    select: { slug: true },
  });
  return rows.map((r) => r.slug);
}

// ============================= Clean =============================

async function clean(mainEmail: string): Promise<void> {
  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
    select: { id: true, email: true },
  });
  if (demoUsers.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: demoUsers.map((u) => u.id) } },
    });
    console.log(`Sters ${demoUsers.length} useri demo (cascade: povesti, prietenii, interactiuni...)`);
  }

  const main = await prisma.user.findUnique({ where: { email: mainEmail } });
  if (!main) return;

  const mainStoryTitles = [...MAIN_STORIES.map((s) => s.title)];
  const ops = await prisma.$transaction([
    prisma.story.deleteMany({ where: { authorId: main.id, title: { in: mainStoryTitles } } }),
    prisma.nfcPetCard.deleteMany({ where: { ownerId: main.id, uid: { startsWith: 'd3a0' } } }),
    prisma.petMemory.deleteMany({ where: { userId: main.id, sourceType: SRC } }),
    prisma.chest.deleteMany({ where: { userId: main.id, sourceId: { startsWith: 'demo-' } } }),
    prisma.phoneDownSession.deleteMany({
      where: { hostId: main.id, invitedUserIds: { hasSome: ['demo-pd-win', 'demo-pd-2nd'] } },
    }),
    prisma.notification.deleteMany({ where: { userId: main.id, payload: { path: ['demoSeed'], equals: true } } }),
    prisma.screenTimeDay.deleteMany({ where: { userId: main.id, source: 'manual' } }),
    prisma.screenTimeWeek.deleteMany({ where: { userId: main.id } }),
    prisma.journeyChapterProgress.deleteMany({ where: { userId: main.id } }),
    prisma.skillXpTransaction.deleteMany({ where: { userId: main.id, sourceType: SRC } }),
    prisma.domainXpTransaction.deleteMany({ where: { userId: main.id, sourceType: SRC } }),
    prisma.xpTransaction.deleteMany({ where: { userId: main.id, sourceType: SRC } }),
  ]);
  console.log(`Curatat artefactele demo de pe ${mainEmail} (${ops.map((o) => o.count).join(',')})`);
  console.log('NOTA: XP-ul total al contului principal NU e recalculat la clean.');
}

// ============================= Seed =============================

async function main() {
  const args = process.argv.slice(2);
  let mainEmail = 'office@dinedroid.com';
  const emailIdx = args.indexOf('--email');
  if (emailIdx >= 0 && args[emailIdx + 1]) mainEmail = args[emailIdx + 1]!;

  if (args.includes('--clean')) {
    await clean(mainEmail);
    return;
  }

  console.log(`\n=== SEED DEMO pentru ${mainEmail} ===\n`);

  // ---------- 0. Contul principal ----------
  let mainUser = await prisma.user.findUnique({ where: { email: mainEmail } });
  if (!mainUser) {
    mainUser = await prisma.user.create({
      data: {
        email: mainEmail,
        name: 'Cristian',
        passwordHash: await hashPassword('Unplgd!2026'),
        birthDate: birthDateForAge(11),
        isVerified: true,
      },
    });
    console.log(`Cont principal CREAT (parola: Unplgd!2026 — schimb-o!)`);
  }
  await ensureDefaultAvatar(mainUser.id);
  await ensureDefaultPet(mainUser.id);
  const MAIN = mainUser.id;

  const species = await prisma.petSpecies.findMany();
  if (species.length === 0) {
    console.error('EROARE: nu exista PetSpecies in DB — ruleaza seed-ul de catalog intai.');
    process.exit(1);
  }
  const nonDefaultSpecies = species.filter((s) => !s.isDefault);
  const speciesPool = nonDefaultSpecies.length > 0 ? nonDefaultSpecies : species;

  // ---------- 1. Prietenii demo ----------
  console.log('--- Prieteni demo ---');
  const friendIds = new Map<string, string>();
  for (let fi = 0; fi < FRIENDS.length; fi++) {
    const f = FRIENDS[fi]!;
    const email = `${f.key}@${DEMO_EMAIL_DOMAIN}`;
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: f.name,
        passwordHash: await hashPassword(DEMO_PASSWORD),
        birthDate: birthDateForAge(f.age),
        isVerified: true,
      },
      update: {},
    });
    friendIds.set(f.key, user.id);

    await randomAvatar(user.id, email);

    // Pet: specie diferita per prieten (ciclare pe pool).
    const sp = speciesPool[fi % speciesPool.length]!;
    await prisma.pet.upsert({
      where: { userId: user.id },
      create: { userId: user.id, speciesId: sp.id, name: f.petName, bondXp: 120 + fi * 90 },
      update: {},
    });

    // XP → nivel tinta (idempotent pe sourceId fix).
    const targetXp = (f.level - 1) ** 2 * 100 + 40 + fi * 17;
    await awardXp(user.id, targetXp, SRC, 'base-xp', 'Demo seed base XP');

    // Skills + domenii — profil vizibil pe profilul public al prietenului.
    for (const skill of f.skills) {
      for (let i = 0; i < 4; i++) {
        await awardSkillXp(user.id, skill, 15 + i * 5, SRC, `f-${f.key}-${skill}-${i}`);
      }
    }
    for (const slug of await existingDomainSlugs(f.domains)) {
      for (let i = 0; i < 3; i++) {
        await awardDomainXp(user.id, slug, 20 + i * 10, SRC, `f-${f.key}-${slug}-${i}`);
      }
    }
    console.log(`  ${f.name.padEnd(20)} pet=${sp.slug.padEnd(14)} lvl~${f.level} (${email} / ${DEMO_PASSWORD})`);
  }

  // ---------- 2. Prietenii + interactiuni ----------
  console.log('--- Prietenii + intalniri ---');
  for (let fi = 0; fi < FRIENDS.length; fi++) {
    const f = FRIENDS[fi]!;
    const fid = friendIds.get(f.key)!;
    const requesterId = f.friendship === 'pending' ? fid : fi % 2 === 0 ? MAIN : fid;
    const receiverId = requesterId === MAIN ? fid : MAIN;
    const createdAt = daysAgo(14 - fi, 10 + fi);

    await prisma.friendship.upsert({
      where: { requesterId_receiverId: { requesterId, receiverId } },
      create: {
        requesterId,
        receiverId,
        status: f.friendship === 'pending' ? FriendshipStatus.PENDING : FriendshipStatus.ACCEPTED,
        connectedVia: fi % 2 === 0 ? InteractionMethod.nfc : InteractionMethod.ble,
        createdAt,
        acceptedAt: f.friendship === 'pending' ? null : createdAt,
      },
      update: {},
    });

    if (f.friendship === 'accepted') {
      await awardXp(MAIN, 100, SRC, `friendship-${f.key}`, `Prieten nou: ${f.name}`);
      for (const d of f.daysMet) {
        const date = daysAgo(d);
        date.setHours(0, 0, 0, 0);
        const method = d % 3 === 0 ? InteractionMethod.ble : InteractionMethod.nfc;
        // Ambele directii — asa creeaza si flow-ul real de scan.
        for (const [a, b] of [[MAIN, fid], [fid, MAIN]] as const) {
          await prisma.dailyInteraction.upsert({
            where: { userId_friendId_date: { userId: a, friendId: b, date } },
            create: { userId: a, friendId: b, date, method },
            update: {},
          });
        }
        await awardXp(MAIN, 20, SRC, `meet-${f.key}-${d}`, `Intalnire cu ${f.name}`);
      }
    }
  }
  console.log(`  ${FRIENDS.filter((f) => f.friendship === 'accepted').length} acceptate + 1 cerere PENDING (Ana — demo accept live)`);

  // ---------- 3. Povesti + like-uri + lant ----------
  console.log('--- Povesti ---');
  const storyIdByTitle = new Map<string, string>();

  for (const [idx, s] of MAIN_STORIES.entries()) {
    let story = await prisma.story.findFirst({ where: { authorId: MAIN, title: s.title } });
    if (!story) {
      story = await prisma.story.create({
        data: {
          authorId: MAIN,
          title: s.title,
          body: s.body,
          keyFacts: s.keyFacts as unknown as Prisma.InputJsonValue,
          createdAt: daysAgo(6 - idx * 2, 18),
        },
      });
      // chainRootId = propriul id pe radacini.
      story = await prisma.story.update({ where: { id: story.id }, data: { chainRootId: story.id } });
    }
    storyIdByTitle.set(s.title, story.id);
  }

  for (const f of FRIENDS) {
    if (!f.story) continue;
    const fid = friendIds.get(f.key)!;
    let story = await prisma.story.findFirst({ where: { authorId: fid, title: f.story.title } });
    if (!story) {
      story = await prisma.story.create({
        data: {
          authorId: fid,
          title: f.story.title,
          body: f.story.body,
          keyFacts: f.story.keyFacts as unknown as Prisma.InputJsonValue,
          createdAt: daysAgo(FRIENDS.indexOf(f) + 2, 17),
        },
      });
      story = await prisma.story.update({ where: { id: story.id }, data: { chainRootId: story.id } });
    }
    storyIdByTitle.set(f.story.title, story.id);
  }

  // Claim VERIFIED: main a ascultat povestea Mariei; Maria a ascultat "Farul".
  const mariaId = friendIds.get('maria')!;
  const mariaStoryId = storyIdByTitle.get('Vulpea care colectiona culori')!;
  const farulId = storyIdByTitle.get('Farul care se temea de intuneric')!;

  await prisma.storyClaim.upsert({
    where: { storyId_listenerId: { storyId: mariaStoryId, listenerId: MAIN } },
    create: {
      storyId: mariaStoryId, listenerId: MAIN, status: 'VERIFIED',
      startedAt: daysAgo(3, 16), verifiedAt: daysAgo(3, 16, 20), attempts: 1, score: 5,
    },
    update: {},
  });
  await awardXp(MAIN, 30, SRC, 'story-listened-maria', 'Ai ascultat si redat povestea Mariei');
  await prisma.storyClaim.upsert({
    where: { storyId_listenerId: { storyId: farulId, listenerId: mariaId } },
    create: {
      storyId: farulId, listenerId: mariaId, status: 'VERIFIED',
      startedAt: daysAgo(2, 15), verifiedAt: daysAgo(2, 15, 25), attempts: 1, score: 5,
    },
    update: {},
  });
  await awardXp(MAIN, 80, SRC, 'story-told-maria', 'Maria a redat corect povestea ta');

  // Lantul: Maria extinde "Farul" cu propriul capitol.
  let chainExt = await prisma.story.findFirst({
    where: { authorId: mariaId, title: CHAIN_EXTENSION.title },
  });
  if (!chainExt) {
    chainExt = await prisma.story.create({
      data: {
        authorId: mariaId,
        title: CHAIN_EXTENSION.title,
        body: CHAIN_EXTENSION.body,
        keyFacts: CHAIN_EXTENSION.keyFacts as unknown as Prisma.InputJsonValue,
        parentStoryId: farulId,
        chainRootId: farulId,
        createdAt: daysAgo(1, 19),
      },
    });
  }

  // Like-uri incrucisate.
  const likePairs: Array<[string, string]> = [
    [MAIN, mariaStoryId],
    [MAIN, storyIdByTitle.get('Robotul care visa sa fie astronaut') ?? ''],
    [mariaId, farulId],
    [friendIds.get('andrei')!, farulId],
    [friendIds.get('sofia')!, storyIdByTitle.get('Dragonul care stranuta baloane') ?? ''],
    [friendIds.get('ioana')!, farulId],
  ];
  for (const [userId, storyId] of likePairs) {
    if (!storyId) continue;
    await prisma.storyLike.upsert({
      where: { userId_storyId: { userId, storyId } },
      create: { userId, storyId },
      update: {},
    });
  }
  console.log(`  ${storyIdByTitle.size} povesti + lant (Farul → Farul si licuricii) + ${likePairs.length} like-uri`);

  // ---------- 4. Colectia de pet-uri a contului principal ----------
  console.log('--- Pet-uri (main) ---');
  const mainPet = await prisma.pet.findUnique({
    where: { userId: MAIN },
    include: { species: true },
  });
  const cardSpecies = speciesPool
    .filter((s) => s.slug !== mainPet?.species.slug)
    .slice(0, 3);
  for (const [i, sp] of cardSpecies.entries()) {
    await prisma.nfcPetCard.upsert({
      where: { uid: `d3a0${(i + 1).toString(16).padStart(4, '0')}` },
      create: {
        uid: `d3a0${(i + 1).toString(16).padStart(4, '0')}`,
        speciesId: sp.id,
        ownerId: MAIN,
        nickname: ['Umbra', 'Cosmo', 'Piper'][i] ?? sp.name,
        claimedAt: daysAgo(20 - i * 5),
      },
      update: { ownerId: MAIN },
    });
  }
  // Bond XP + memorii pe specia echipata (chat-ul "isi aminteste" LIVE).
  if (mainPet) {
    await prisma.pet.update({
      where: { id: mainPet.id },
      data: { bondXp: Math.max(mainPet.bondXp, 460) },
    });
    for (const [i, fact] of PET_MEMORIES.entries()) {
      const exists = await prisma.petMemory.findFirst({
        where: { userId: MAIN, speciesSlug: mainPet.species.slug, fact },
      });
      if (!exists) {
        await prisma.petMemory.create({
          data: {
            userId: MAIN,
            speciesSlug: mainPet.species.slug,
            fact,
            sourceType: SRC,
            createdAt: daysAgo(6 - i),
          },
        });
      }
    }
  }
  console.log(`  ${cardSpecies.length} carduri revendicate (${cardSpecies.map((s) => s.slug).join(', ')}) + ${PET_MEMORIES.length} memorii pe ${mainPet?.species.slug}`);

  // ---------- 5. Skills + domenii (main) ----------
  console.log('--- Skills + domenii (main) ---');
  const mainSkillPlan: Array<[Skill, number]> = [
    ['curiozitate', 6], ['creativitate', 5], ['sociabilitate', 5],
    ['logica', 4], ['empatie', 3], ['perseverenta', 3],
  ];
  for (const [skill, n] of mainSkillPlan) {
    for (let i = 0; i < n; i++) {
      await awardSkillXp(MAIN, skill, 12 + (i % 4) * 6, SRC, `m-${skill}-${i}`);
    }
  }
  const mainDomains = await existingDomainSlugs([
    'spatiu', 'animale', 'povesti', 'tehnologie', 'stiinte-naturii', 'stiinte', 'istorie', 'arta', 'natura', 'sport',
  ]);
  for (const [di, slug] of mainDomains.slice(0, 6).entries()) {
    for (let i = 0; i < 4 - (di % 2); i++) {
      await awardDomainXp(MAIN, slug, 18 + i * 9, SRC, `m-${slug}-${i}`);
    }
  }
  console.log(`  ${SKILLS_VALID.length} skills + ${Math.min(6, mainDomains.length)} domenii`);

  // ---------- 6. Screen time ----------
  console.log('--- Screen time ---');
  const allIds = [MAIN, ...FRIENDS.filter((f) => f.friendship === 'accepted').map((f) => friendIds.get(f.key)!)];
  const avgByUser = new Map<string, number>([[MAIN, 62]]);
  for (const f of FRIENDS) {
    if (f.friendship === 'accepted') avgByUser.set(friendIds.get(f.key)!, f.screenAvg);
  }

  // Zile: saptamana trecuta completa + saptamana curenta pana azi.
  const lastWeekRef = daysAgo(7);
  const lastWeekKey = isoWeekKey(lastWeekRef);
  const lastWeekDays = weekDaysFor(lastWeekRef);
  const todayKey = dayKey();
  const thisWeekDays = weekDaysFor(new Date()).filter((d) => d <= todayKey);

  for (const uid of allIds) {
    const base = avgByUser.get(uid) ?? 120;
    const rng = mulberry32(hashCode(`${uid}-screen`));
    for (const day of [...lastWeekDays, ...thisWeekDays]) {
      const minutes = Math.max(20, Math.round(base + (rng() - 0.5) * base * 0.45));
      await prisma.screenTimeDay.upsert({
        where: { userId_day: { userId: uid, day } },
        create: { userId: uid, day, minutes, source: 'manual' },
        update: {},
      });
    }
  }

  // Finalizarea saptamanii trecute: rank dupa medie (main are cea mai mica).
  const ranked = [...avgByUser.entries()].sort((a, b) => a[1] - b[1]);
  for (const [i, [uid, avg]] of ranked.entries()) {
    const rank = i + 1;
    const xp = rankReward(rank);
    await prisma.screenTimeWeek.upsert({
      where: { userId_weekKey: { userId: uid, weekKey: lastWeekKey } },
      create: {
        userId: uid, weekKey: lastWeekKey, avgMinutes: avg, daysReported: 7,
        rank, groupSize: ranked.length, xpAwarded: xp,
      },
      update: {},
    });
    await awardXp(uid, xp, 'screentime_week', lastWeekKey, `Screen time ${lastWeekKey}: locul ${rank}`);
  }
  console.log(`  ${lastWeekDays.length + thisWeekDays.length} zile/user, saptamana ${lastWeekKey} finalizata — main pe locul 1 (${avgByUser.get(MAIN)} min/zi)`);

  // ---------- 7. PhoneDown istoric + cufere ----------
  console.log('--- PhoneDown + cufere ---');
  const tierConfigs = await loadTierConfigs();
  const dropPool = await loadDroppableItems();

  function rollLoot(tier: ChestTier): ChestLoot {
    const cfg = tierConfigs.get(tier);
    if (!cfg) return { xp: 50, items: [], duplicates: [] };
    const rolled = rollItemsForTier(cfg, dropPool);
    const seen = new Set<string>();
    const items: ChestLoot['items'] = [];
    for (const it of rolled) {
      if (seen.has(it.slug)) continue;
      seen.add(it.slug);
      items.push({ itemId: it.id, slug: it.slug, name: it.name, rarity: it.rarity });
    }
    return { xp: cfg.xpBase, items, duplicates: [] };
  }

  // Sesiune castigata acum 3 zile (main WINNER, 41 min) + una acum 8 zile (rank 2).
  const pdSpecs = [
    { id: 'demo-pd-win', ago: 3, mainRank: 1, mainMs: 41 * 60_000, others: [['luca', 2, 26], ['andrei', 3, 12]] as const },
    { id: 'demo-pd-2nd', ago: 8, mainRank: 2, mainMs: 18 * 60_000, others: [['maria', 1, 33], ['sofia', 3, 9]] as const },
  ];
  for (const spec of pdSpecs) {
    const started = daysAgo(spec.ago, 17);
    // Marker stabil de idempotenta: id-ul spec-ului in invitedUserIds (campul
    // e liber, sesiunile ENDED nu il mai folosesc). daysAgo() se schimba de la
    // o zi la alta, deci nu putem cauta dupa createdAt.
    const exists = await prisma.phoneDownSession.findFirst({
      where: { hostId: MAIN, invitedUserIds: { has: spec.id } },
    });
    if (exists) continue;
    const ended = new Date(started.getTime() + Math.max(spec.mainMs, 33 * 60_000) + 5000);
    const session = await prisma.phoneDownSession.create({
      data: {
        hostId: MAIN,
        status: PhoneDownStatus.ENDED,
        startedAt: started,
        capAt: new Date(started.getTime() + 4 * 3600_000),
        endedAt: ended,
        createdAt: started,
        invitedUserIds: [spec.id],
      },
    });
    await prisma.phoneDownParticipant.create({
      data: {
        sessionId: session.id, userId: MAIN,
        status: spec.mainRank === 1 ? PhoneDownParticipantStatus.WINNER : PhoneDownParticipantStatus.SURRENDERED,
        joinedAt: started,
        phoneDownAt: new Date(started.getTime() + 5000),
        surrenderedAt: spec.mainRank === 1 ? null : new Date(started.getTime() + spec.mainMs),
        rank: spec.mainRank,
        durationMs: spec.mainMs,
      },
    });
    for (const [key, rank, minutes] of spec.others) {
      await prisma.phoneDownParticipant.create({
        data: {
          sessionId: session.id, userId: friendIds.get(key)!,
          status: rank === 1 ? PhoneDownParticipantStatus.WINNER : PhoneDownParticipantStatus.SURRENDERED,
          joinedAt: started,
          phoneDownAt: new Date(started.getTime() + 5000),
          surrenderedAt: rank === 1 ? null : new Date(started.getTime() + minutes * 60_000),
          rank,
          durationMs: minutes * 60_000,
        },
      });
    }
  }

  // Cufere NEDESCHISE pt demo de opening (loot pre-rolat ca in productie).
  const chestPlan: Array<[ChestTier, string]> = [
    [ChestTier.SILVER, 'demo-chest-silver'],
    [ChestTier.GOLD, 'demo-chest-gold'],
    [ChestTier.PLATINUM, 'demo-chest-platinum'],
    [ChestTier.CHAMPION, 'demo-chest-champion'],
  ];
  let chestsCreated = 0;
  for (const [tier, sourceId] of chestPlan) {
    const exists = await prisma.chest.findFirst({
      where: { userId: MAIN, sourceType: 'phone_down', sourceId },
    });
    if (exists) continue;
    await prisma.chest.create({
      data: {
        userId: MAIN,
        tier,
        sourceType: 'phone_down',
        sourceId,
        lootJson: rollLoot(tier) as unknown as Prisma.InputJsonValue,
      },
    });
    chestsCreated++;
  }
  console.log(`  2 sesiuni PhoneDown (una castigata) + ${chestsCreated} cufere noi de deschis`);

  // ---------- 8. Quests pe azi ----------
  console.log('--- Daily quests ---');
  const templates = await prisma.questTemplate.findMany({ where: { active: true } });
  const preferred = ['nfc_meet_1', 'story_verify_1', 'explicit_like_2'];
  const chosen = preferred
    .map((slug) => templates.find((t) => t.slug === slug))
    .filter((t) => t !== undefined)
    .concat(templates.filter((t) => !preferred.includes(t.slug)))
    .slice(0, 3);
  for (const [slot, t] of chosen.entries()) {
    const completed = slot === 0; // primul quest deja bifat azi
    const progress = completed ? t.requiredCount : slot === 1 ? Math.max(0, t.requiredCount - 1) : 0;
    await prisma.dailyQuest.upsert({
      where: { userId_questDate_slot: { userId: MAIN, questDate: todayKey, slot } },
      create: {
        userId: MAIN,
        questDate: todayKey,
        slot,
        slug: t.slug,
        requiredCount: t.requiredCount,
        xpReward: t.baseXp,
        progress,
        completedAt: completed ? daysAgo(0, 9, 30) : null,
      },
      update: {},
    });
  }
  console.log(`  3 quest-uri azi: ${chosen.map((t) => t.slug).join(', ')} (1 complet, 1 aproape)`);

  // ---------- 9. Notificari ----------
  console.log('--- Notificari ---');
  const park = await prisma.park.findFirst({ orderBy: { areaSqm: 'desc' } });
  const notifPlan: Array<{ kind: string; title: string; body: string; payload: Record<string, unknown>; read: boolean; ago: number }> = [
    {
      kind: 'friend_request', title: 'Cerere de prietenie',
      body: 'Ana Gheorghe vrea sa fiti prieteni. Vezi cererea in lista de prieteni.',
      payload: { demoSeed: true }, read: false, ago: 0,
    },
    {
      kind: 'daily_quests', title: 'Misiunile de azi te asteapta',
      body: 'Ai 3 misiuni noi — una e deja aproape gata!',
      payload: { demoSeed: true }, read: false, ago: 0,
    },
    ...(park ? [{
      kind: 'park_hint', title: 'Idee pentru dupa-amiaza',
      body: `Maria si Andrei au fost vazuti des in ${park.name} in weekend. Poate va vedeti acolo la o vanatoare?`,
      payload: { demoSeed: true, parkName: park.name } as Record<string, unknown>, read: true, ago: 1,
    }] : []),
    {
      kind: 'level_up', title: 'Ai urcat in nivel!',
      body: 'Felicitari — activitatea din parc te-a urcat un nivel. Continua tot asa!',
      payload: { demoSeed: true }, read: true, ago: 2,
    },
  ];
  for (const n of notifPlan) {
    const exists = await prisma.notification.findFirst({
      where: { userId: MAIN, kind: n.kind, title: n.title },
    });
    if (exists) continue;
    await prisma.notification.create({
      data: {
        userId: MAIN,
        kind: n.kind,
        title: n.title,
        body: n.body,
        payload: n.payload as Prisma.InputJsonValue,
        readAt: n.read ? daysAgo(n.ago, 20) : null,
        createdAt: daysAgo(n.ago, 11),
      },
    });
  }
  console.log(`  ${notifPlan.length} notificari (2 necitite)`);

  // ---------- 10. Journey (capitolul 1 complet, cap. 2 jucabil la demo) ----------
  console.log('--- Journey ---');
  const JOURNEY_CH1: Record<string, { chapter: string; bg: string }> = {
    'darth-vader': { chapter: 'vader-ch1', bg: 'vader-ch1-planeta-rosie' },
    'baby-yoda': { chapter: 'yoda-ch1', bg: 'yoda-ch1-desert' },
    groot: { chapter: 'groot-ch1', bg: 'groot-ch1-padure' },
    stitch: { chapter: 'stitch-ch1', bg: 'stitch-ch1-plaja' },
    dog: { chapter: 'dog-ch1', bg: 'dog-ch1-parc' },
  };
  // Specia echipata + speciile de pe carduri — oriunde exista pack de journey.
  const journeySlugs = [mainPet?.species.slug, ...cardSpecies.map((s) => s.slug)]
    .filter((s): s is string => !!s && s in JOURNEY_CH1);
  let unlockedBg: string | null = null;
  for (const slug of journeySlugs) {
    const j = JOURNEY_CH1[slug]!;
    await prisma.journeyChapterProgress.upsert({
      where: { userId_chapterId: { userId: MAIN, chapterId: j.chapter } },
      create: { userId: MAIN, chapterId: j.chapter, petSlug: slug, completedAt: daysAgo(1, 18) },
      update: {},
    });
    const bg = await prisma.profileBackground.findUnique({ where: { key: j.bg } });
    if (bg) {
      await prisma.userBackground.upsert({
        where: { userId_backgroundKey: { userId: MAIN, backgroundKey: j.bg } },
        create: { userId: MAIN, backgroundKey: j.bg },
        update: {},
      });
      unlockedBg = unlockedBg ?? j.bg;
    }
  }
  if (unlockedBg) {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: MAIN }, select: { selectedBackgroundKey: true } });
    if (!u.selectedBackgroundKey) {
      await prisma.user.update({ where: { id: MAIN }, data: { selectedBackgroundKey: unlockedBg } });
    }
  }
  console.log(`  cap. 1 complet pe: ${journeySlugs.join(', ') || '(nicio specie cu journey)'} — cap. 2 e jucabil azi la demo`);

  // ---------- Rezumat ----------
  const finalMain = await prisma.user.findUniqueOrThrow({ where: { id: MAIN } });
  console.log(`\n=== GATA ===`);
  console.log(`Cont principal: ${mainEmail} — nivel ${finalMain.level} (${finalMain.xp} XP)`);
  console.log(`Conturi demo (parola ${DEMO_PASSWORD}): ${FRIENDS.map((f) => `${f.key}@${DEMO_EMAIL_DOMAIN}`).join(', ')}`);
  console.log(`
DE ARATAT LA DEMO:
  • Home: bula pet-ului cu daily hook + quest-uri (1 complet) + notificari (2 necitite)
  • Prieteni: 6 prieteni cu avatare/pet-uri diferite + cererea Anei de acceptat LIVE
  • Profil prieten (ex. Maria): nivel, skills, pet
  • Chat pet (live): intreaba-l "ce stii despre mine?" — are ${PET_MEMORIES.length} memorii
  • Pet-uri: colectie cu ${cardSpecies.length} carduri — demo switch + intro nou in chat
  • Povesti: ale tale + ale prietenilor, lantul "Farul..." are 2 capitole, like-uri
  • Screen time: saptamana trecuta castigata (locul 1), saptamana curenta in curs
  • Cufere: ${chestsCreated > 0 ? chestPlan.length : 'cateva'} de deschis (inclusiv CHAMPION)
  • Journey: capitolul 2 jucabil live (cap. 1 completat ieri, fundal deblocat)
  • Hunt / co-creation / co-walk / phonedown: demo LIVE cu conturile demo pe alt telefon
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
