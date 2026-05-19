// Acorda chesturi de test unui user pentru QA. Foloseste exact aceeasi logica
// de rolling ca productia (rollItemsForTier din award.ts), deci itemele care
// pica respecta config-ul din DB (itemDropChance, weights, guaranteed).
//
// Run in container:
//   docker compose -f docker-compose.prod.yml exec backend \
//     npx tsx scripts/grant-test-chests.ts --email office@dinedroid.com --all
//
// Sau pe local (cu DATABASE_URL setat):
//   npx tsx scripts/grant-test-chests.ts --email me@test.com --tier DIAMOND --count 5
//
// Flags:
//   --email <email>     User-ul tinta (obligatoriu)
//   --all               Acorda 2 chesturi din fiecare tier (12 total)
//   --tier <TIER>       Acorda doar acest tier (BRONZE/SILVER/.../CHAMPION)
//   --count <N>         Cati chesturi (default 1, ignorat cu --all)
//   --reset             Sterge chesturile neopen ale user-ului inainte (clean test)

import { ChestTier, type Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';
import {
  loadDroppableItems,
  loadTierConfigs,
  rollItemsForTier,
  type ChestLoot,
} from '../src/lib/phonedown/award.js';

const TIER_ORDER: ChestTier[] = [
  ChestTier.BRONZE,
  ChestTier.SILVER,
  ChestTier.GOLD,
  ChestTier.PLATINUM,
  ChestTier.DIAMOND,
  ChestTier.CHAMPION,
];

function parseArgs() {
  const args = process.argv.slice(2);
  const opts: {
    email?: string;
    tier?: ChestTier;
    count: number;
    all: boolean;
    reset: boolean;
  } = { count: 1, all: false, reset: false };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--email') opts.email = args[++i];
    else if (a === '--tier') {
      const v = (args[++i] ?? '').toUpperCase() as ChestTier;
      if (!TIER_ORDER.includes(v)) {
        console.error(`Tier invalid: ${v}. Valori valide: ${TIER_ORDER.join(', ')}`);
        process.exit(1);
      }
      opts.tier = v;
    } else if (a === '--count') opts.count = parseInt(args[++i] ?? '1', 10);
    else if (a === '--all') opts.all = true;
    else if (a === '--reset') opts.reset = true;
  }
  if (!opts.email) {
    console.error('--email e obligatoriu');
    process.exit(1);
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  const user = await prisma.user.findUnique({
    where: { email: opts.email },
    select: { id: true, email: true },
  });
  if (!user) {
    console.error(`User cu email "${opts.email}" nu exista`);
    process.exit(1);
  }
  console.log(`Target user: ${user.email} (${user.id})`);

  if (opts.reset) {
    const del = await prisma.chest.deleteMany({
      where: { userId: user.id, openedAt: null },
    });
    console.log(`Sters ${del.count} chesturi neopen`);
  }

  const configs = await loadTierConfigs();
  const pool = await loadDroppableItems();
  console.log(`Droppable items pool: ${pool.length}`);

  const tiersToGrant: ChestTier[] = opts.all
    ? TIER_ORDER.flatMap((t) => [t, t]) // 2× fiecare tier
    : Array.from({ length: opts.count }, () => opts.tier ?? ChestTier.GOLD);

  for (const tier of tiersToGrant) {
    const cfg = configs.get(tier);
    if (!cfg) {
      console.warn(`Skip ${tier}: config lipseste in DB`);
      continue;
    }
    const rolled = rollItemsForTier(cfg, pool);
    // Dedup intern (la fel ca in award.ts).
    const items: ChestLoot['items'] = [];
    const seen = new Set<string>();
    for (const it of rolled) {
      if (seen.has(it.slug)) continue;
      seen.add(it.slug);
      items.push({ itemId: it.id, slug: it.slug, name: it.name, rarity: it.rarity });
    }
    const loot: ChestLoot = { xp: cfg.xpBase, items, duplicates: [] };
    const chest = await prisma.chest.create({
      data: {
        userId: user.id,
        tier,
        sourceType: 'qa_test',
        sourceId: null,
        lootJson: loot as unknown as Prisma.InputJsonValue,
      },
    });
    const itemsLabel = items.length === 0 ? '(doar XP)' : items.map((i) => `${i.slug}:${i.rarity}`).join(', ');
    console.log(`  ${tier.padEnd(8)} ${chest.id}  xp=${cfg.xpBase}  items=[${itemsLabel}]`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
