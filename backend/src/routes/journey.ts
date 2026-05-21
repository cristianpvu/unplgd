// Journey — endpoint TTS pentru povestile predefinite din mobile.
//
// Mobile-ul detine tot continutul (StoryPack-uri TS predefinite). Aici doar
// sintetizam audio pentru un text dat, cu voce de narator sau voce a speciei
// pet-ului echipat. Cache SHA pe text+voce → al doilea play e instant.

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, serverError } from '../lib/errors.js';
import { ensureDefaultPet } from '../lib/pet.js';
import { logger } from '../lib/logger.js';
import { synthesizeTts } from '../lib/ai/tts.js';
import { NARRATOR_EDGE_VOICE, narratorElevenVoiceId } from '../lib/ai/narrator.js';

export const journeyRouter = Router();
journeyRouter.use(requireAuth);

// Lungime maxima rezonabila pentru un beat de scena — ~3-4 propozitii.
const MAX_TEXT = 600;

const ttsSchema = z.object({
  text: z.string().min(2).max(MAX_TEXT),
  // 'narrator' = voce generala de povestitor.
  // 'pet'      = voce a speciei pet-ului echipat (PetSpecies.elevenVoiceId).
  voice: z.enum(['narrator', 'pet']),
});

type TtsResponse = {
  text: string;
  audioUrl: string | null;
  provider: 'eleven' | 'edge' | null;
};

// POST /journey/tts
// Sintetizeaza textul cu voce de narator sau pet. Erori pe TTS → audioUrl=null,
// mobile cade pe expo-speech device-side.
journeyRouter.post('/tts', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const body = ttsSchema.parse(req.body);

    let elevenVoiceId: string | null = null;
    let edgeVoiceFallback = NARRATOR_EDGE_VOICE;

    if (body.voice === 'pet') {
      // Voce a pet-ului echipat — luam din PetSpecies.elevenVoiceId.
      await ensureDefaultPet(userId);
      const pet = await prisma.pet.findUniqueOrThrow({
        where: { userId },
        include: { species: true },
      });
      elevenVoiceId = pet.species.elevenVoiceId;
      edgeVoiceFallback = pet.species.voiceId || NARRATOR_EDGE_VOICE;
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
      logger.warn({ err, voice: body.voice, len: body.text.length }, 'journey.tts_failed');
      // Nu blocam UX-ul — mobile cade pe device speech.
      const response: TtsResponse = {
        text: body.text,
        audioUrl: null,
        provider: null,
      };
      res.json(response);
    }
  } catch (e) {
    if (e instanceof z.ZodError) return next(badRequest('invalid_body', e.message));
    next(e);
  }
});

// GET /journey/health — quick check ca ruta e mounted.
journeyRouter.get('/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// Bara stub — placeholder pentru viitor (progress per user). Pastram serverError
// daca cineva incearca acum, ca sa nu primeasca 404 silent.
journeyRouter.get('/progress/:petSlug', (_req, _res, next) => {
  next(serverError('not_implemented', 'Progress persistat vine intr-o iteratie viitoare.'));
});
