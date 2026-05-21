// Journey — TTS pentru povestile predefinite + cautare random friend pet.
//
// Mobile detine continutul povestilor. Backend ofera:
//   - POST /journey/tts          → sintetizeaza textul cu voce narator sau pet
//   - GET  /journey/random-friend → un pet random al unui prieten, pt encounter

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, notFound } from '../lib/errors.js';
import { ensureDefaultPet } from '../lib/pet.js';
import { logger } from '../lib/logger.js';
import { synthesizeTts } from '../lib/ai/tts.js';
import { NARRATOR_EDGE_VOICE, narratorElevenVoiceId } from '../lib/ai/narrator.js';
import { resolvePetImagePath } from '../lib/petImage.js';
import { awardBondXp } from '../lib/pet/bond.js';

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

// GET /journey/questions?domain=spatiu&count=10
// Returneaza intrebari random pentru un domain, filtrate dupa varsta user-ului.
// Mobile cere acest endpoint o singura data la inceputul fiecarui capitol si
// distribuie intrebarile la scenele challenge.
type QuestionDto = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  successLine: string;
  failLine: string;
};

journeyRouter.get('/questions', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const domain = String(req.query.domain ?? '').trim();
    const count = Math.max(1, Math.min(20, Number(req.query.count ?? 5)));
    if (!domain) throw badRequest('domain_required', 'Lipseste parametrul domain');

    // Calculam varsta din birthDate. Daca lipseste, default la 8 (mijloc).
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { birthDate: true },
    });
    let age = 8;
    if (user.birthDate) {
      const now = new Date();
      age = now.getFullYear() - user.birthDate.getFullYear();
      const m = now.getMonth() - user.birthDate.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < user.birthDate.getDate())) age--;
      age = Math.max(6, Math.min(14, age));
    }

    // ORDER BY random() in Postgres pentru selectie aleatorie. Cu index pe
    // (domain, active) e suficient de rapid pentru sub 10k randuri/domain.
    const rows = await prisma.$queryRaw<QuestionDto[]>`
      SELECT id, prompt, options, "correctIndex", "successLine", "failLine"
      FROM "JourneyQuestion"
      WHERE domain = ${domain}
        AND active = true
        AND "minAge" <= ${age}
        AND "maxAge" >= ${age}
      ORDER BY random()
      LIMIT ${count}
    `;

    // Daca nu sunt suficiente intrebari in domain, completam din 'general'.
    let questions = rows;
    if (questions.length < count && domain !== 'general') {
      const fillNeeded = count - questions.length;
      const extras = await prisma.$queryRaw<QuestionDto[]>`
        SELECT id, prompt, options, "correctIndex", "successLine", "failLine"
        FROM "JourneyQuestion"
        WHERE domain = 'general'
          AND active = true
          AND "minAge" <= ${age}
          AND "maxAge" >= ${age}
        ORDER BY random()
        LIMIT ${fillNeeded}
      `;
      questions = [...questions, ...extras];
    }

    res.json({ questions, age });
  } catch (e) {
    next(e);
  }
});

// POST /journey/checkpoint
// Acordat cand mobile ajunge la o scena de tip checkpoint. Idempotent:
//   - bond xp prin BondXpTransaction unique (petId, 'journey_checkpoint', sceneId)
//   - unlock background prin UserBackground unique (userId, backgroundKey)
// Returneaza fundalul deblocat (daca exista + e in DB), ca mobile sa-l arate.
const checkpointSchema = z.object({
  sceneId: z.string().min(1).max(64),
  chapterId: z.string().min(1).max(64),
  bondXp: z.number().int().min(0).max(1000).optional(),
  backgroundKey: z.string().min(1).max(80).optional(),
});

type CheckpointResponse = {
  bondAwarded: number;
  unlockedBackground: {
    key: string;
    name: string;
    imageUrl: string;
    tier: number;
  } | null;
};

journeyRouter.post('/checkpoint', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const body = checkpointSchema.parse(req.body);

    await ensureDefaultPet(userId);
    const pet = await prisma.pet.findUniqueOrThrow({ where: { userId } });

    let bondAwarded = 0;
    if (body.bondXp && body.bondXp > 0) {
      const granted = await awardBondXp(
        pet.id,
        body.bondXp,
        'journey_checkpoint',
        body.sceneId,
        `Checkpoint ${body.chapterId}`,
      );
      if (granted) bondAwarded = body.bondXp;
    }

    let unlockedBackground: CheckpointResponse['unlockedBackground'] = null;
    if (body.backgroundKey) {
      // Fundalul trebuie sa existe in DB (populat manual de admin/tine).
      const bg = await prisma.profileBackground.findUnique({
        where: { key: body.backgroundKey },
      });
      if (!bg) {
        logger.warn(
          { backgroundKey: body.backgroundKey },
          'journey.checkpoint_background_missing — nu exista in ProfileBackground',
        );
      } else if (bg.active) {
        // Unlock idempotent.
        try {
          await prisma.userBackground.create({
            data: { userId, backgroundKey: bg.key },
          });
        } catch (err: any) {
          // P2002 = deja deblocat → ignoram, returnam tot fundalul.
          if (err?.code !== 'P2002') throw err;
        }
        unlockedBackground = {
          key: bg.key,
          name: bg.name,
          imageUrl: bg.imageUrl,
          tier: bg.tier,
        };
      }
    }

    const response: CheckpointResponse = { bondAwarded, unlockedBackground };
    res.json(response);
  } catch (e) {
    if (e instanceof z.ZodError) return next(badRequest('invalid_body', e.message));
    next(e);
  }
});

// GET /journey/health
journeyRouter.get('/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});
