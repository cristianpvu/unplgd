import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { ensureDefaultPet } from '../lib/pet.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';

export const petsRouter = Router();
petsRouter.use(requireAuth);

// UID NFC: hex (NTAG-style) sau slug demo (DEMO-CARD-XX) — ca seed-ul sa
// poata semina carduri fara hardware fizic disponibil. Acceptam si mixt.
const uidSchema = z
  .string()
  .min(4)
  .max(64)
  .regex(/^[0-9A-Za-z:_-]+$/, 'UID format invalid');

function normalizeUid(uid: string): string {
  return uid.toUpperCase().replace(/:/g, '');
}

type SpeciesSummary = {
  slug: string;
  name: string;
  imagePath: string | null;
  shortLore: string;
  tone: string;
  catchphrases: string[];
  interests: string[];
};

function speciesDto(s: {
  slug: string;
  name: string;
  imagePath: string | null;
  shortLore: string;
  tone: string;
  catchphrases: string[];
  interests: string[];
}): SpeciesSummary {
  return {
    slug: s.slug,
    name: s.name,
    imagePath: s.imagePath,
    shortLore: s.shortLore,
    tone: s.tone,
    catchphrases: s.catchphrases,
    interests: s.interests,
  };
}

// GET /pets/me — pet activ + colectia de carduri detinute. Lazy-creeaza pet-ul
// daca lipseste (defensiv pt conturi vechi inainte de feature).
petsRouter.get('/me', async (req, res, next) => {
  try {
    const userId = req.userId!;
    await ensureDefaultPet(userId);

    const pet = await prisma.pet.findUniqueOrThrow({
      where: { userId },
      include: { species: true },
    });

    const cards = await prisma.nfcPetCard.findMany({
      where: { ownerId: userId },
      include: { species: true },
      orderBy: { claimedAt: 'asc' },
    });

    res.json({
      pet: {
        id: pet.id,
        name: pet.name,
        bondXp: pet.bondXp,
        species: speciesDto(pet.species),
      },
      cards: cards.map((c) => ({
        id: c.id,
        uid: c.uid,
        nickname: c.nickname,
        claimedAt: c.claimedAt,
        equipped: c.speciesId === pet.speciesId,
        species: speciesDto(c.species),
      })),
    });
  } catch (e) {
    next(e);
  }
});

// POST /pets/scan — scaneaza un card. Comportament:
//  - card necunoscut (UID inexistent in DB) → 404 card_unknown
//  - card detinut de altcineva → 409 card_taken
//  - card neclamat → claim + equip
//  - card detinut de mine → doar equip
const scanSchema = z.object({ uid: uidSchema });

petsRouter.post('/scan', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { uid } = scanSchema.parse(req.body);
    const normalizedUid = normalizeUid(uid);

    const card = await prisma.nfcPetCard.findUnique({
      where: { uid: normalizedUid },
      include: { species: true },
    });
    if (!card) throw notFound('card_unknown', 'Cardul scanat nu e in baza de date');
    if (card.ownerId && card.ownerId !== userId) {
      throw conflict('card_taken', 'Cardul are deja proprietar');
    }

    const wasUnclaimed = !card.ownerId;
    const updatedCard = wasUnclaimed
      ? await prisma.nfcPetCard.update({
          where: { id: card.id },
          data: { ownerId: userId, claimedAt: new Date() },
          include: { species: true },
        })
      : card;

    // Equip = sincronizeaza Pet-ul user-ului la specia cardului. La primul claim
    // numele Pet-ului preia nickname-ul cardului sau numele speciei (default
    // "Buddy" inlocuit). La re-equip pastram numele curent — user-ul a putut
    // sa-l personalizeze.
    await ensureDefaultPet(userId);
    const currentPet = await prisma.pet.findUniqueOrThrow({ where: { userId } });
    const newName = wasUnclaimed
      ? (updatedCard.nickname ?? updatedCard.species.name)
      : currentPet.name;

    const pet = await prisma.pet.update({
      where: { userId },
      data: { speciesId: updatedCard.speciesId, name: newName },
      include: { species: true },
    });

    res.json({
      newClaim: wasUnclaimed,
      pet: {
        id: pet.id,
        name: pet.name,
        bondXp: pet.bondXp,
        species: speciesDto(pet.species),
      },
      card: {
        id: updatedCard.id,
        uid: updatedCard.uid,
        nickname: updatedCard.nickname,
        claimedAt: updatedCard.claimedAt,
        equipped: true,
        species: speciesDto(updatedCard.species),
      },
    });
  } catch (e) {
    next(e);
  }
});

// POST /pets/equip — switch la alt card detinut deja (din colectie).
const equipSchema = z.object({ cardId: z.string().min(1) });

petsRouter.post('/equip', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { cardId } = equipSchema.parse(req.body);

    const card = await prisma.nfcPetCard.findUnique({
      where: { id: cardId },
      include: { species: true },
    });
    if (!card) throw notFound('card_not_found', 'Card inexistent');
    if (card.ownerId !== userId) throw forbidden('not_owner', 'Cardul nu e al tau');

    const pet = await prisma.pet.update({
      where: { userId },
      data: { speciesId: card.speciesId },
      include: { species: true },
    });

    res.json({
      pet: {
        id: pet.id,
        name: pet.name,
        bondXp: pet.bondXp,
        species: speciesDto(pet.species),
      },
      card: {
        id: card.id,
        uid: card.uid,
        nickname: card.nickname,
        claimedAt: card.claimedAt,
        equipped: true,
        species: speciesDto(card.species),
      },
    });
  } catch (e) {
    next(e);
  }
});

// PATCH /pets/cards/:id — rename nickname. Daca cardul e equipped, sincronizeaza
// si numele Pet-ului.
const renameSchema = z.object({
  nickname: z.string().trim().min(1).max(30),
});

petsRouter.patch('/cards/:id', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    if (!id) throw badRequest('missing_id', 'Card id lipseste');
    const { nickname } = renameSchema.parse(req.body);

    const card = await prisma.nfcPetCard.findUnique({ where: { id } });
    if (!card) throw notFound('card_not_found', 'Card inexistent');
    if (card.ownerId !== userId) throw forbidden('not_owner', 'Cardul nu e al tau');

    const updated = await prisma.nfcPetCard.update({
      where: { id },
      data: { nickname },
      include: { species: true },
    });

    const pet = await prisma.pet.findUniqueOrThrow({ where: { userId } });
    if (pet.speciesId === updated.speciesId) {
      await prisma.pet.update({ where: { userId }, data: { name: nickname } });
    }

    res.json({
      card: {
        id: updated.id,
        uid: updated.uid,
        nickname: updated.nickname,
        claimedAt: updated.claimedAt,
        equipped: pet.speciesId === updated.speciesId,
        species: speciesDto(updated.species),
      },
    });
  } catch (e) {
    next(e);
  }
});
