import { ChestTier, Rarity, type Item, type Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { awardXp } from '../xp.js';

// Tier dupa durata efectiva (minute jucate fara pauze). Sub 5 min nu se
// ajunge aici — gardat la apelantul `endSession`. Bonus podium (#1) =
// upgrade cu un tier; Diamond + #1 = Champion (loot exclusiv legendary).
//
// Praguri ales pentru o curba motivanta:
//   5-14 min  → Bronze   (joc scurt, recompensa simbolica)
//   15-29 min → Silver
//   30-59 min → Gold     (un pranz fara telefon)
//   60-119 min → Platinum
//   120+ min  → Diamond  (probabil sub 5% din sesiuni)
function baseTierForDuration(durationMs: number): ChestTier | null {
  const min = durationMs / 60_000;
  if (min < 5) return null;
  if (min < 15) return ChestTier.BRONZE;
  if (min < 30) return ChestTier.SILVER;
  if (min < 60) return ChestTier.GOLD;
  if (min < 120) return ChestTier.PLATINUM;
  return ChestTier.DIAMOND;
}

function upgradeTier(tier: ChestTier): ChestTier {
  // Champion e tier dedicat (loot exclusiv legendary, animatie aurie); nu
  // se mai upgradeaza. Diamond + winner → Champion. Restul urca o treapta.
  switch (tier) {
    case ChestTier.BRONZE:
      return ChestTier.SILVER;
    case ChestTier.SILVER:
      return ChestTier.GOLD;
    case ChestTier.GOLD:
      return ChestTier.PLATINUM;
    case ChestTier.PLATINUM:
      return ChestTier.DIAMOND;
    case ChestTier.DIAMOND:
      return ChestTier.CHAMPION;
    case ChestTier.CHAMPION:
      return ChestTier.CHAMPION;
  }
}

// Greutati de rolling pe rarity. Cufer mai bun = sansa mai mare la rar.
// Champion nu intra aici — are loot deterministic (1 legendary + 1 epic).
type RarityWeights = Record<Rarity, number>;
const WEIGHTS_BY_TIER: Record<Exclude<ChestTier, 'CHAMPION'>, RarityWeights> = {
  BRONZE:   { COMMON: 90, RARE: 10, EPIC:  0, LEGENDARY: 0 },
  SILVER:   { COMMON: 70, RARE: 25, EPIC:  5, LEGENDARY: 0 },
  GOLD:     { COMMON: 40, RARE: 45, EPIC: 14, LEGENDARY: 1 },
  PLATINUM: { COMMON: 15, RARE: 45, EPIC: 35, LEGENDARY: 5 },
  DIAMOND:  { COMMON:  0, RARE: 30, EPIC: 50, LEGENDARY: 20 },
};

// Cate iteme pica pe tier (in afara de XP). Champion = 2 (legendary garantat).
const ITEMS_PER_TIER: Record<ChestTier, number> = {
  BRONZE: 1,
  SILVER: 1,
  GOLD: 2,
  PLATINUM: 2,
  DIAMOND: 3,
  CHAMPION: 2,
};

// XP de baza pe tier. Cresterea e supraliniara — incurajeaza durabilitate.
const XP_BY_TIER: Record<ChestTier, number> = {
  BRONZE: 20,
  SILVER: 50,
  GOLD: 100,
  PLATINUM: 200,
  DIAMOND: 400,
  CHAMPION: 600,
};

// XP bonus pentru iteme duplicate (shards in disguise). Cresterea reflecta
// raritatea pierduta — un legendary duplicat e mai dureros decat un common.
const DUPLICATE_XP_BY_RARITY: Record<Rarity, number> = {
  COMMON: 5,
  RARE: 15,
  EPIC: 40,
  LEGENDARY: 100,
};

function pickWeighted<T>(entries: { value: T; weight: number }[]): T | null {
  const total = entries.reduce((s, e) => s + e.weight, 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const e of entries) {
    roll -= e.weight;
    if (roll <= 0) return e.value;
  }
  return entries[entries.length - 1]?.value ?? null;
}

type DroppableItem = Pick<Item, 'id' | 'slug' | 'name' | 'rarity' | 'exclusive'>;

// Cauta toate itemele de accesoriu (slot holding) eligibile drop-ului. Excludem
// "Fara accesoriu" (feature=null) ca sa nu picam itemul neutru. Excludem
// itemele non-exclusive cu rarity LEGENDARY in afara de cele exclusive (le
// rezervam pentru CHAMPION + RNG la PLATINUM/DIAMOND).
async function loadDroppableItems(): Promise<DroppableItem[]> {
  return prisma.item.findMany({
    where: {
      attachmentPoint: { not: null },
      feature: { not: null },
    },
    select: { id: true, slug: true, name: true, rarity: true, exclusive: true },
  });
}

function rollItemsForTier(
  tier: ChestTier,
  pool: DroppableItem[],
): DroppableItem[] {
  if (tier === ChestTier.CHAMPION) {
    // Loot garantat: 1 legendary (exclusive eligible) + 1 epic. Daca poolul
    // nu are destui legendary, fallback la epic.
    const legendaries = pool.filter((i) => i.rarity === Rarity.LEGENDARY);
    const epics = pool.filter((i) => i.rarity === Rarity.EPIC);
    const out: DroppableItem[] = [];
    const legendaryPick = legendaries[Math.floor(Math.random() * legendaries.length)];
    if (legendaryPick) out.push(legendaryPick);
    const epicPick = epics[Math.floor(Math.random() * epics.length)];
    if (epicPick) out.push(epicPick);
    return out;
  }

  const weights = WEIGHTS_BY_TIER[tier];
  const count = ITEMS_PER_TIER[tier];
  const byRarity = {
    COMMON: pool.filter((i) => i.rarity === Rarity.COMMON),
    RARE: pool.filter((i) => i.rarity === Rarity.RARE),
    EPIC: pool.filter((i) => i.rarity === Rarity.EPIC),
    LEGENDARY: pool.filter((i) => i.rarity === Rarity.LEGENDARY && !i.exclusive),
  };

  const out: DroppableItem[] = [];
  for (let i = 0; i < count; i++) {
    const rarity = pickWeighted<Rarity>([
      { value: Rarity.COMMON, weight: weights.COMMON },
      { value: Rarity.RARE, weight: weights.RARE },
      { value: Rarity.EPIC, weight: weights.EPIC },
      { value: Rarity.LEGENDARY, weight: weights.LEGENDARY },
    ]);
    if (!rarity) continue;
    const bucket = byRarity[rarity];
    const pick = bucket[Math.floor(Math.random() * bucket.length)];
    if (pick) out.push(pick);
  }
  return out;
}

export type ChestLoot = {
  xp: number;
  items: { itemId: string; slug: string; name: string; rarity: Rarity }[];
  duplicates: { slug: string; name: string; shardsXp: number }[];
};

// Acorda cufar unui participant la sfarsitul sesiunii. Idempotent prin
// PhoneDownParticipant.chestId unique — apelat de doua ori nu creeaza
// dubluri.
export async function awardChestForParticipant(args: {
  participantId: string;
  userId: string;
  sessionId: string;
  durationMs: number;
  isWinner: boolean;
}): Promise<{ chestId: string; tier: ChestTier } | null> {
  const baseTier = baseTierForDuration(args.durationMs);
  if (!baseTier) return null;
  const tier = args.isWinner ? upgradeTier(baseTier) : baseTier;

  // Daca exista deja un cufar pentru participant, returnam fara duplicat.
  const existing = await prisma.phoneDownParticipant.findUnique({
    where: { id: args.participantId },
    select: { chestId: true },
  });
  if (existing?.chestId) {
    const chest = await prisma.chest.findUnique({ where: { id: existing.chestId } });
    return chest ? { chestId: chest.id, tier: chest.tier } : null;
  }

  const pool = await loadDroppableItems();
  const rolled = rollItemsForTier(tier, pool);

  // Detectie duplicate: care iteme are deja user-ul in inventar din cufere
  // anterioare deschise sau in inventar curent. Pentru moment "owned" =
  // itemul figureaza in loot-ul vreunui chest anterior deschis. Asta e
  // aproximat — extindem cu tabela Inventory in viitor.
  const userOpenedChests = await prisma.chest.findMany({
    where: { userId: args.userId, openedAt: { not: null } },
    select: { lootJson: true },
  });
  const ownedSlugs = new Set<string>();
  for (const c of userOpenedChests) {
    const loot = c.lootJson as unknown as ChestLoot | null;
    if (!loot) continue;
    for (const it of loot.items ?? []) ownedSlugs.add(it.slug);
  }

  const items: ChestLoot['items'] = [];
  const duplicates: ChestLoot['duplicates'] = [];
  for (const it of rolled) {
    if (ownedSlugs.has(it.slug)) {
      duplicates.push({
        slug: it.slug,
        name: it.name,
        shardsXp: DUPLICATE_XP_BY_RARITY[it.rarity],
      });
    } else {
      items.push({ itemId: it.id, slug: it.slug, name: it.name, rarity: it.rarity });
      ownedSlugs.add(it.slug);
    }
  }

  const xp = XP_BY_TIER[tier] + duplicates.reduce((s, d) => s + d.shardsXp, 0);
  const loot: ChestLoot = { xp, items, duplicates };

  const chest = await prisma.chest.create({
    data: {
      userId: args.userId,
      tier,
      sourceType: 'phone_down',
      sourceId: args.sessionId,
      lootJson: loot as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.phoneDownParticipant.update({
    where: { id: args.participantId },
    data: { chestId: chest.id },
  });

  return { chestId: chest.id, tier };
}

// Aplicare loot la deschiderea cufarului — apelat din routes/chests.ts.
// Returneaza loot-ul pentru a fi servit clientului (cu animatie).
export async function openChest(chestId: string, userId: string): Promise<ChestLoot | null> {
  const chest = await prisma.chest.findFirst({
    where: { id: chestId, userId },
  });
  if (!chest) return null;
  if (chest.openedAt) return chest.lootJson as unknown as ChestLoot;

  const loot = chest.lootJson as unknown as ChestLoot;
  // XP-ul total (de baza + shards din duplicate) e acordat la deschidere
  // pentru pacing-ul UX — momentul de "feedback" e tap-ul pe cufar.
  if (loot.xp > 0) {
    await awardXp(
      userId,
      loot.xp,
      'chest_open',
      chest.id,
      `Cufar ${chest.tier.toLowerCase()}`,
    );
  }
  await prisma.chest.update({
    where: { id: chest.id },
    data: { openedAt: new Date() },
  });
  return loot;
}
