import {
  ChestTier,
  Rarity,
  type ChestTierConfig,
  type Item,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../prisma.js';
import { awardXp } from '../xp.js';
import { renderItemPreviewSvg } from '../avatar/itemPreview.js';

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

export async function loadDroppableItems(): Promise<DroppableItem[]> {
  return prisma.item.findMany({
    where: {
      attachmentPoint: { not: null },
      feature: { not: null },
    },
    select: { id: true, slug: true, name: true, rarity: true, exclusive: true },
  });
}

export async function loadTierConfigs(): Promise<Map<ChestTier, ChestTierConfig>> {
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

export function rollItemsForTier(
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

  // Restul slotului umplut prin rolling weighted. Pentru fiecare slot
  // ne-garantat, verificam intai `itemDropChance` (0-100); daca random > prag,
  // slot-ul ramane gol (user-ul primeste doar XP pe acea pozitie). Asta face
  // tier-urile mici sa pice rar item — restul e XP-only.
  const remaining = config.itemCount - out.length;
  if (remaining <= 0) return out;

  const byRarity = {
    COMMON: pool.filter((i) => i.rarity === Rarity.COMMON),
    RARE: pool.filter((i) => i.rarity === Rarity.RARE),
    EPIC: pool.filter((i) => i.rarity === Rarity.EPIC),
    LEGENDARY: pool.filter((i) => i.rarity === Rarity.LEGENDARY && !i.exclusive),
  };

  for (let i = 0; i < remaining; i++) {
    // Dice roll pe drop chance — daca esueaza, slot-ul nu produce nimic.
    if (Math.random() * 100 >= config.itemDropChance) continue;
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

export type ChestLootItem = {
  itemId: string;
  slug: string;
  name: string;
  rarity: Rarity;
  // SVG + viewBox sunt enrichuite la deschidere din DB pe baza de feature/
  // attachmentPoint. NU se persista in lootJson (ramane source-of-truth doar
  // ce e necesar pt game logic) — clientul primeste preview-ul la POST /open.
  svg?: string;
  viewBox?: string;
};

export type ChestLootDuplicate = {
  slug: string;
  name: string;
  rarity?: Rarity;
  shardsXp: number;
  svg?: string;
  viewBox?: string;
};

export type ChestLoot = {
  xp: number;
  items: ChestLootItem[];
  duplicates: ChestLootDuplicate[];
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

  // Dedup intern in cadrul aceluiasi chest (un chest nu poate da acelasi slug
  // de doua ori — al doilea ar trebui re-rolat sau scapat). Pentru simplitate
  // doar deduplicam aici; restul (duplicate fata de UserItem) se face la
  // openChest, ca acordarea sa fie snapshot brut iar deschiderea sa decida
  // ce e duplicate la moment.
  const items: ChestLoot['items'] = [];
  const seen = new Set<string>();
  for (const it of rolled) {
    if (seen.has(it.slug)) continue;
    seen.add(it.slug);
    items.push({ itemId: it.id, slug: it.slug, name: it.name, rarity: it.rarity });
  }

  const loot: ChestLoot = { xp: finalCfg.xpBase, items, duplicates: [] };

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

// Imbogateste itemele din loot cu SVG preview + rarity (pentru duplicates) prin
// lookup in DB dupa slug. Lasa loot-ul intact daca itemele nu se gasesc.
export async function enrichLootWithSvg(loot: ChestLoot): Promise<ChestLoot> {
  const slugs = new Set<string>([
    ...loot.items.map((i) => i.slug),
    ...loot.duplicates.map((d) => d.slug),
  ]);
  if (slugs.size === 0) return loot;
  const items = await prisma.item.findMany({
    where: { slug: { in: Array.from(slugs) } },
    select: { slug: true, feature: true, attachmentPoint: true, rarity: true },
  });
  const bySlug = new Map(items.map((i) => [i.slug, i]));
  return {
    xp: loot.xp,
    items: loot.items.map((it) => {
      const dbItem = bySlug.get(it.slug);
      if (!dbItem) return it;
      const preview = renderItemPreviewSvg(dbItem);
      return preview ? { ...it, ...preview } : it;
    }),
    duplicates: loot.duplicates.map((d) => {
      const dbItem = bySlug.get(d.slug);
      if (!dbItem) return d;
      const preview = renderItemPreviewSvg(dbItem);
      return {
        ...d,
        rarity: dbItem.rarity,
        ...(preview ?? {}),
      };
    }),
  };
}

// Aplicare loot la deschiderea cufarului — apelat din routes/chests.ts.
// Duplicate detection se face AICI (la deschidere), nu la acordare, pentru ca
// daca user-ul are mai multe chesturi neopen, fiecare a fost rolat fara sa
// stie ce contin celelalte. La momentul deschiderii verificam UserItem si
// re-clasificam ce e duplicate.
export async function openChest(chestId: string, userId: string): Promise<ChestLoot | null> {
  const chest = await prisma.chest.findFirst({
    where: { id: chestId, userId },
  });
  if (!chest) return null;

  // Daca a fost deja deschis, re-clasificam dupa UserItem curent si returnam
  // snapshot-ul echivalent. NU re-acordam XP (idempotent via awardXp source).
  if (chest.openedAt) {
    const raw = chest.lootJson as unknown as ChestLoot;
    const reclassified = await reclassifyLoot(raw, userId);
    return enrichLootWithSvg(reclassified);
  }

  const raw = chest.lootJson as unknown as ChestLoot;
  const reclassified = await reclassifyLoot(raw, userId);

  if (reclassified.xp > 0) {
    await awardXp(
      userId,
      reclassified.xp,
      'chest_open',
      chest.id,
      `Cufar ${chest.tier.toLowerCase()}`,
    );
  }
  // Inseram ownership pentru iteme RAMASE in `items` dupa reclassify (cele
  // care nu erau detinute la momentul deschiderii). skipDuplicates previne
  // crash la deschideri concurente.
  if (reclassified.items.length > 0) {
    await prisma.userItem.createMany({
      data: reclassified.items.map((it) => ({
        userId,
        itemId: it.itemId,
        source: 'chest',
      })),
      skipDuplicates: true,
    });
  }
  // Persistam loot-ul reclasificat inapoi in lootJson ca istoricul (lista
  // cufere deschise) sa reflecte rezultatul final — ce s-a primit efectiv vs
  // ce a devenit duplicate. SVG-urile NU se persista (raman derivate la read).
  await prisma.chest.update({
    where: { id: chest.id },
    data: {
      openedAt: new Date(),
      lootJson: reclassified as unknown as Prisma.InputJsonValue,
    },
  });
  return enrichLootWithSvg(reclassified);
}

// Re-clasifica loot-ul fata de UserItem curent. Itemele pe care user-ul deja
// le detine (sau le-a detinut anterior) se muta in `duplicates` cu shardsXp
// din RarityDuplicateXp. xp se re-calculeaza ca xpBase (din lootJson original,
// inferat ca xp - shards-uri vechi) + shards-uri noi.
async function reclassifyLoot(raw: ChestLoot, userId: string): Promise<ChestLoot> {
  const allSlugs = [
    ...raw.items.map((i) => i.slug),
    ...raw.duplicates.map((d) => d.slug),
  ];
  if (allSlugs.length === 0) return raw;

  const dbItems = await prisma.item.findMany({
    where: { slug: { in: allSlugs } },
    select: { id: true, slug: true, name: true, rarity: true },
  });
  const bySlug = new Map(dbItems.map((i) => [i.slug, i]));

  const owned = await prisma.userItem.findMany({
    where: { userId, item: { slug: { in: allSlugs } } },
    select: { item: { select: { slug: true } } },
  });
  const ownedSlugs = new Set<string>(owned.map((o) => o.item.slug));

  const dupXp = await loadDuplicateXp();
  // xpBase = xp - shards-urile deja in raw.duplicates (daca exista de la
  // acordari vechi). xp final = xpBase + shards-urile noi calculate.
  const oldShards = raw.duplicates.reduce((s, d) => s + d.shardsXp, 0);
  const xpBase = raw.xp - oldShards;

  const items: ChestLoot['items'] = [];
  const duplicates: ChestLoot['duplicates'] = [];
  // Iteme deja in raw.items
  for (const it of raw.items) {
    if (ownedSlugs.has(it.slug)) {
      const db = bySlug.get(it.slug);
      duplicates.push({
        slug: it.slug,
        name: it.name,
        rarity: db?.rarity ?? it.rarity,
        shardsXp: dupXp[db?.rarity ?? it.rarity],
      });
    } else {
      items.push(it);
      ownedSlugs.add(it.slug); // intercept duplicates intra-chest
    }
  }
  // Iteme deja in raw.duplicates (acordari vechi) — raman duplicate (XP shards
  // recalculate). Daca cumva n-au fost contate ca duplicate atunci (bug vechi),
  // raman duplicate acum.
  for (const d of raw.duplicates) {
    const db = bySlug.get(d.slug);
    duplicates.push({
      slug: d.slug,
      name: d.name,
      rarity: db?.rarity ?? d.rarity,
      shardsXp: dupXp[db?.rarity ?? d.rarity ?? 'COMMON'],
    });
  }

  const newShards = duplicates.reduce((s, d) => s + d.shardsXp, 0);
  return { xp: xpBase + newShards, items, duplicates };
}
