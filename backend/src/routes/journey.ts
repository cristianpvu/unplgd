// Journey — TTS pentru povestile predefinite + cautare random friend pet.
//
// Mobile detine continutul povestilor. Backend ofera:
//   - POST /journey/tts          → sintetizeaza textul cu voce narator sau pet
//   - GET  /journey/random-friend → un pet random al unui prieten, pt encounter

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, notFound, serverError } from '../lib/errors.js';
import { ensureDefaultPet } from '../lib/pet.js';
import { logger } from '../lib/logger.js';
import { synthesizeTts } from '../lib/ai/tts.js';
import { NARRATOR_EDGE_VOICE, narratorElevenVoiceId } from '../lib/ai/narrator.js';
import { resolvePetImagePath } from '../lib/petImage.js';

export const journeyRouter = Router();
journeyRouter.use(requireAuth);

const MAX_TEXT = 700;

const ttsSchema = z.object({
  text: z.string().min(2).max(MAX_TEXT),
  // 'narrator' = voce generala.
  // 'pet'      = voce pet. Daca visitorSpeciesSlug e setat → vocea speciei
  //              vizitatorului. Altfel → vocea pet-ului echipat al user-ului.
  voice: z.enum(['narrator', 'pet']),
  visitorSpeciesSlug: z.string().min(1).max(64).optional(),
});

type TtsResponse = {
  text: string;
  audioUrl: string | null;
  provider: 'eleven' | 'edge' | null;
};

// POST /journey/tts
journeyRouter.post('/tts', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const body = ttsSchema.parse(req.body);

    let elevenVoiceId: string | null = null;
    let edgeVoiceFallback = NARRATOR_EDGE_VOICE;

    if (body.voice === 'pet') {
      // Vocea speciei (visitor) sau a pet-ului propriu.
      if (body.visitorSpeciesSlug) {
        const species = await prisma.petSpecies.findUnique({
          where: { slug: body.visitorSpeciesSlug },
        });
        if (species) {
          elevenVoiceId = species.elevenVoiceId;
          edgeVoiceFallback = species.voiceId || NARRATOR_EDGE_VOICE;
        }
      } else {
        await ensureDefaultPet(userId);
        const pet = await prisma.pet.findUniqueOrThrow({
          where: { userId },
          include: { species: true },
        });
        elevenVoiceId = pet.species.elevenVoiceId;
        edgeVoiceFallback = pet.species.voiceId || NARRATOR_EDGE_VOICE;
      }
    } else {
      elevenVoiceId = narratorElevenVoiceId();
    }

    try {
      const result = await synthesizeTts(body.text, edgeVoiceFallback, {
        elevenVoiceId,
      });
      const response: TtsResponse = {
        text: body.text,
        audioUrl: result.urlPath,
        provider: result.provider,
      };
      res.json(response);
    } catch (err) {
      logger.warn(
        { err, voice: body.voice, visitor: body.visitorSpeciesSlug, len: body.text.length },
        'journey.tts_failed',
      );
      const response: TtsResponse = { text: body.text, audioUrl: null, provider: null };
      res.json(response);
    }
  } catch (e) {
    if (e instanceof z.ZodError) return next(badRequest('invalid_body', e.message));
    next(e);
  }
});

type RandomFriendResponse = {
  friendName: string;
  petName: string;
  speciesSlug: string;
  speciesName: string;
  petImageUrl: string | null;
};

// GET /journey/random-friend
// Returneaza un prieten random + pet-ul lui echipat. Pentru encounter-uri
// dinamice in povesti. Daca user-ul nu are prieteni ACCEPTED → 404.
journeyRouter.get('/random-friend', async (req, res, next) => {
  try {
    const userId = req.userId!;

    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { receiverId: userId }],
      },
      select: {
        requesterId: true,
        receiverId: true,
      },
    });

    const friendIds = friendships
      .map((f) => (f.requesterId === userId ? f.receiverId : f.requesterId))
      .filter((id) => id !== userId);

    if (friendIds.length === 0) {
      throw notFound('no_friends', 'Inca nu ai prieteni adaugati');
    }

    const pickedId = friendIds[Math.floor(Math.random() * friendIds.length)];

    const friend = await prisma.user.findUnique({
      where: { id: pickedId },
      include: { pet: { include: { species: true } } },
    });

    if (!friend) throw notFound('friend_not_found', 'Prietenul nu a fost gasit');
    if (!friend.pet) throw notFound('friend_has_no_pet', 'Prietenul nu are inca un pet');

    const response: RandomFriendResponse = {
      friendName: friend.name,
      petName: friend.pet.name,
      speciesSlug: friend.pet.species.slug,
      speciesName: friend.pet.species.name,
      petImageUrl: await resolvePetImagePath(friend.pet.species.imagePath),
    };
    res.json(response);
  } catch (e) {
    next(e);
  }
});

// GET /journey/health
journeyRouter.get('/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// Placeholder progress (iteratie viitoare).
journeyRouter.get('/progress/:petSlug', (_req, _res, next) => {
  next(serverError('not_implemented', 'Progress persistat vine intr-o iteratie viitoare.'));
});
