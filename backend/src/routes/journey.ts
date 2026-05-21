// Journey — endpoint pentru beat-uri narrative + TTS optional.
//
// Mobile cere arc-uri narrative pe masura ce pet-ul merge: fiecare arc are
// 4 beat-uri scurte pe care narator-ul le rosteste in secventa. Cache-uim
// per (pet, biome, sectionIndex) — al doilea start in acelasi biome livreaza
// aceleasi beat-uri instant.

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, notFound, serverError } from '../lib/errors.js';
import { ensureDefaultPet } from '../lib/pet.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import {
  generateNarratorArc,
  type NarratorArc,
  type NarratorBiome,
  type NarratorPet,
} from '../lib/ai/journeyNarrator.js';
import { synthesizeTts } from '../lib/ai/tts.js';
import {
  NARRATOR_EDGE_VOICE,
  narratorElevenVoiceId,
} from '../lib/ai/narrator.js';

export const journeyRouter = Router();
journeyRouter.use(requireAuth);

// Cache key — invalidam manual din admin daca vrem.
function arcCacheKey(speciesSlug: string, biomeKey: string, sectionIndex: number): string {
  return `journey:arc:v1:${speciesSlug}:${biomeKey}:${sectionIndex}`;
}

const ARC_TTL_SEC = 60 * 60 * 24 * 30; // 30 zile

const narrateSchema = z.object({
  biomeKey: z.string().min(1).max(64),
  biomeName: z.string().min(1).max(64),
  worldHint: z.string().min(1).max(64),
  // Index al "sectiunii" — folosit ca seed pt cache. 0, 1, 2, ... Mobile
  // creste pe masura ce pet-ul parcurge segmente.
  sectionIndex: z.number().int().min(0).max(99),
  // Daca true, sintetizam TTS si returnam audioUrl per beat. Costuri mai mari
  // — mobile cheama doar daca user-ul nu a oprit sunetul.
  withAudio: z.boolean().optional().default(false),
});

type BeatDto = {
  text: string;
  audioUrl: string | null;
};

type NarrateResponse = {
  beats: BeatDto[];
  cached: boolean;
  ttsProvider: 'eleven' | 'edge' | null;
};

// POST /journey/narrate
// Body: { biomeKey, biomeName, worldHint, sectionIndex, withAudio? }
journeyRouter.post('/narrate', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const body = narrateSchema.parse(req.body);

    await ensureDefaultPet(userId);
    const pet = await prisma.pet.findUniqueOrThrow({
      where: { userId },
      include: { species: true, user: { select: { name: true } } },
    });

    const narratorPet: NarratorPet = {
      petName: pet.name,
      speciesName: pet.species.name,
      childName: pet.user.name,
      expertiseDomains: pet.species.expertiseDomains,
      shortLore: pet.species.shortLore || `${pet.species.name} curios si jucaus.`,
    };
    const narratorBiome: NarratorBiome = {
      name: body.biomeName,
      worldHint: body.worldHint,
    };

    const cacheKey = arcCacheKey(pet.species.slug, body.biomeKey, body.sectionIndex);

    let arc: NarratorArc | null = null;
    let cached = false;
    try {
      const raw = await redis.get(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw) as NarratorArc;
        if (parsed?.beats?.length) {
          arc = parsed;
          cached = true;
        }
      }
    } catch (err) {
      logger.warn({ err, cacheKey }, 'journey.cache_read_failed');
    }

    if (!arc) {
      try {
        arc = await generateNarratorArc(narratorPet, narratorBiome, 4);
      } catch (err) {
        logger.error({ err, biome: body.biomeKey }, 'journey.generation_failed');
        throw serverError('narration_failed', 'Nu am putut genera povestea acum.');
      }
      try {
        await redis.set(cacheKey, JSON.stringify(arc), 'EX', ARC_TTL_SEC);
      } catch (err) {
        logger.warn({ err, cacheKey }, 'journey.cache_write_failed');
      }
    }

    // Sintetizam audio per beat doar daca clientul cere. Erorile pe TTS NU
    // dau fail intregului request — livram textul, audioUrl=null.
    let ttsProvider: 'eleven' | 'edge' | null = null;
    const beats: BeatDto[] = await Promise.all(
      arc.beats.map(async (b) => {
        if (!body.withAudio) return { text: b.text, audioUrl: null };
        try {
          const result = await synthesizeTts(b.text, NARRATOR_EDGE_VOICE, {
            elevenVoiceId: narratorElevenVoiceId(),
          });
          ttsProvider = result.provider;
          return { text: b.text, audioUrl: result.urlPath };
        } catch (err) {
          logger.warn({ err, text: b.text.slice(0, 50) }, 'journey.tts_failed');
          return { text: b.text, audioUrl: null };
        }
      }),
    );

    const response: NarrateResponse = { beats, cached, ttsProvider };
    res.json(response);
  } catch (e) {
    if (e instanceof z.ZodError) return next(badRequest('invalid_body', e.message));
    next(e);
  }
});

// Stub — daca admin vrea sa forteze regenerare la urmatorul play.
journeyRouter.delete('/cache/:speciesSlug', async (req, res, next) => {
  try {
    const { speciesSlug } = req.params;
    if (!speciesSlug) throw notFound('species_required', 'Lipseste species slug');
    const keys = await redis.keys(`journey:arc:v1:${speciesSlug}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    res.json({ cleared: keys.length });
  } catch (e) {
    next(e);
  }
});
