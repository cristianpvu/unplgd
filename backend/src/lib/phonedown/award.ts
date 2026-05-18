import {
  ChestTier,
  Rarity,
  type ChestTierConfig,
  type Item,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../prisma.js';
import { awardXp } from '../xp.js';

// Toata configuratia de game balance (praguri, weights, XP) sta in DB —
// modelele ChestTierConfig + RarityDuplicateXp. Vezi prisma/seed.ts pentru
// valorile initiale. Schimbarile se aplica fara redeploy: edit row si proxima
// sesiune ENDED preia noile valori.

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

async function loadDroppableItems(): Promise<DroppableItem[]> {
  return prisma.item.findMany({
    where: {
      attachmentPoint: { not: null },
      feature: { not: null },
    },
    select: { id: true, slug: true, name: true, rarity: true, exclusive: true },
  });
}

async function loadTierConfigs(): Promise<Map<ChestTier, ChestTierConfig>> {
  const rows = await prisma.chestTierConfig.findMany();
  return new Map(rows.map((r) => [r.tier, r]));
}

async function loadDuplicateXp(): Promise<Record<Rarity, number>> {
  const rows = await prisma.rarityDuplicateXp.findMany();
  const out: Record<Rarity, number> = {
    COMMON: 0,
    RARE: 0,
    EPIC: 0,
    LEGENDARY: 0,
  };
  for (const r of rows) out[r.rarity] = r.xp;
  return out;
}

// Tier de baza dupa durata jucata. Itereaza prin configurile sortate
// descrescator dupa minDurationMs si returneaza primul care e <= durata.
// Daca nici unul nu e atins, returneaza null (nu se acorda cufar).
//
// CHAMPION e tier de upgrade (din DIAMOND) — nu e selectabil ca baza chiar daca
// minDurationMs=0; il excludem explicit.
function baseTierForDuration(
  durationMs: number,
  configs: Map<ChestTier, ChestTierConfig>,
): ChestTier | null {
  const candidates = Array.from(configs.values())
    .filter((c) => c.tier !== ChestTier.CHAMPION && c.minDurationMs > 0)
    .sort((a, b) => b.minDurationMs - a.minDurationMs);
  for (const c of candidates) {
    if (durationMs >= c.minDurationMs) return c.tier;
  }
  return null;
}

function rollItemsForTier(
  config: ChestTierConfig,
  pool: DroppableItem[],
): DroppableItem[] {
  const out: DroppableItem[] = [];

  // Loot garantat (pentru CHAMPION sau viitor). Selectam aleator din pool-ul
  // de raritate; legendary-urile pot fi exclusive (cele rezervate pentru
  // CHAMPION).
  if (config.guaranteedLegendary > 0) {
    const legendaries = pool.filter((i) => i.rarity === Rarity.LEGENDARY);
    for (let i = 0; i < config.guaranteedLegendary; i++) {
      const pick = legendaries[Math.floor(Math.random() * legendaries.length)];
      if (pick) out.push(pick);
    }
  }
  if (config.guaranteedEpic > 0) {
    const epics = pool.filter((i) => i.rarity === Rarity.EPIC);
    for (let i = 0; i < config.guaranteedEpic; i++) {
      const pick = epics[Math.floor(Math.random() * epics.length)];
      if (pick) out.push(pick);
    }
  }

  // Restul slotului umplut prin rolling weighted.
  const remaining = config.itemCount - out.length;
  if (remaining <= 0) return out;

  const byRarity = {
    COMMON: pool.filter((i) => i.rarity === Rarity.COMMON),
    RARE: pool.filter((i) => i.rarity === Rarity.RARE),
    EPIC: pool.filter((i) => i.rarity === Rarity.EPIC),
    LEGENDARY: pool.filter((i) => i.rarity === Rarity.LEGENDARY && !i.exclusive),
  };

  for (let i = 0; i < remaining; i++) {
    const rarity = pickWeighted<Rarity>([
      { value: Rarity.COMMON, weight: config.weightCommon },
      { value: Rarity.RARE, weight: config.weightRare },
      { value: Rarity.EPIC, weight: config.weightEpic },
      { value: Rarity.LEGENDARY, weight: config.weightLegendary },
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
  const configs = await loadTierConfigs();
  const baseTier = baseTierForDuration(args.durationMs, configs);
  if (!baseTier) return null;

  const baseCfg = configs.get(baseTier);
  if (!baseCfg) return null;

  // Castigatorul primeste tier-ul de upgrade (daca exista). Pentru tier-uri
  // fara upgrade (CHAMPION sau orice cu upgradeToTier=null), winner-ul ramane
  // la acelasi tier.
  const finalTier = args.isWinner && baseCfg.upgradeToTier
    ? baseCfg.upgradeToTier
    : baseTier;
  const finalCfg = configs.get(finalTier);
  if (!finalCfg) return null;

  // Idempotent — daca exista deja un cufar pentru participant, returnam.
  const existing = await prisma.phoneDownParticipant.findUnique({
    where: { id: args.participantId },
    select: { chestId: true },
  });
  if (existing?.chestId) {
    const chest = await prisma.chest.findUnique({ where: { id: existing.chestId } });
    return chest ? { chestId: chest.id, tier: chest.tier } : null;
  }

  const pool = await loadDroppableItems();
  const rolled = rollItemsForTier(finalCfg, pool);

  // Detectie duplicate.
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

  const dupXp = await loadDuplicateXp();

  const items: ChestLoot['items'] = [];
  const duplicates: ChestLoot['duplicates'] = [];
  for (const it of rolled) {
    if (ownedSlugs.has(it.slug)) {
      duplicates.push({
        slug: it.slug,
        name: it.name,
        shardsXp: dupXp[it.rarity],
      });
    } else {
      items.push({ itemId: it.id, slug: it.slug, name: it.name, rarity: it.rarity });
      ownedSlugs.add(it.slug);
    }
  }

  const xp = finalCfg.xpBase + duplicates.reduce((s, d) => s + d.shardsXp, 0);
  const loot: ChestLoot = { xp, items, duplicates };

  const chest = await prisma.chest.create({
    data: {
      userId: args.userId,
      tier: finalTier,
      sourceType: 'phone_down',
      sourceId: args.sessionId,
      lootJson: loot as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.phoneDownParticipant.update({
    where: { id: args.participantId },
    data: { chestId: chest.id },
  });

  return { chestId: chest.id, tier: finalTier };
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
