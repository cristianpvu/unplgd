import type { PrismaClient } from '@prisma/client';
import { prisma } from './prisma.js';

type Tx = PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// Specia auto-echipata la cont nou, dintre starterele isDefault. Pot fi mai
// multe startere gratuite (Scout + Buddy); asta e cea selectata implicit.
export const AUTO_PET_SLUG = 'scout';

/**
 * Idempotent: creeaza pet-ul auto-selectat (Scout) pentru un user nou. Daca
 * exista deja, returneaza-l. Folosit la register si lazy la primul GET /me/pet
 * pentru backfill conturi vechi.
 */
export async function ensureDefaultPet(userId: string, client: Tx = prisma) {
  const existing = await client.pet.findUnique({ where: { userId } });
  if (existing) return existing;

  // Preferam AUTO_PET_SLUG; daca lipseste, orice starter isDefault.
  const species =
    (await client.petSpecies.findFirst({ where: { slug: AUTO_PET_SLUG, isDefault: true } })) ??
    (await client.petSpecies.findFirst({ where: { isDefault: true } }));
  if (!species) {
    throw new Error('No default pet species seeded — run prisma db seed');
  }

  return client.pet.create({
    data: { userId, speciesId: species.id, name: species.name },
  });
}
