import { Router } from 'express';
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { petChatRateLimit } from '../middleware/rateLimit.js';
import { ensureDefaultPet } from '../lib/pet.js';
import { badRequest, conflict, forbidden, notFound, serverError } from '../lib/errors.js';
import { resolvePetImagePath } from '../lib/petImage.js';
import { ANTHROPIC_MODEL } from '../lib/ai/client.js';
import { claudeMessages } from '../lib/ai/usage.js';
import { petChatSystemPrompt } from '../lib/ai/petChatPrompt.js';
import {
  appendChatTurn,
  clearChatHistory,
  loadChatHistory,
} from '../lib/ai/chatContext.js';
import { synthesizeTts } from '../lib/ai/tts.js';

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

async function speciesDto(s: {
  slug: string;
  name: string;
  imagePath: string | null;
  shortLore: string;
  tone: string;
  catchphrases: string[];
  interests: string[];
}): Promise<SpeciesSummary> {
  return {
    slug: s.slug,
    name: s.name,
    imagePath: await resolvePetImagePath(s.imagePath),
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

    const [petSpecies, cardSpecies] = await Promise.all([
      speciesDto(pet.species),
      Promise.all(cards.map((c) => speciesDto(c.species))),
    ]);

    res.json({
      pet: {
        id: pet.id,
        name: pet.name,
        bondXp: pet.bondXp,
        species: petSpecies,
      },
      cards: cards.map((c, i) => ({
        id: c.id,
        uid: c.uid,
        nickname: c.nickname,
        claimedAt: c.claimedAt,
        equipped: c.speciesId === pet.speciesId,
        species: cardSpecies[i]!,
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

    const [petSpecies, cardSpeciesDto] = await Promise.all([
      speciesDto(pet.species),
      speciesDto(updatedCard.species),
    ]);

    res.json({
      newClaim: wasUnclaimed,
      pet: {
        id: pet.id,
        name: pet.name,
        bondXp: pet.bondXp,
        species: petSpecies,
      },
      card: {
        id: updatedCard.id,
        uid: updatedCard.uid,
        nickname: updatedCard.nickname,
        claimedAt: updatedCard.claimedAt,
        equipped: true,
        species: cardSpeciesDto,
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

    const [petSpecies, cardSpeciesDto] = await Promise.all([
      speciesDto(pet.species),
      speciesDto(card.species),
    ]);

    res.json({
      pet: {
        id: pet.id,
        name: pet.name,
        bondXp: pet.bondXp,
        species: petSpecies,
      },
      card: {
        id: card.id,
        uid: card.uid,
        nickname: card.nickname,
        claimedAt: card.claimedAt,
        equipped: true,
        species: cardSpeciesDto,
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
        species: await speciesDto(updated.species),
      },
    });
  } catch (e) {
    next(e);
  }
});

// =====================================================================
// Chat AI cu pet-ul echipat. Persona = species (systemHint, catchphrases,
// interests). Istoricul stocat in Redis 1h cu cap pe turn-uri (vezi
// chatContext.ts). NU exista "task done" — chat liber.
//
// Cheie Redis: pet:chat:{userId} — istoricul e pe user, NU pe specie. Daca
// echipezi alt card, conversatia continua dar persona se schimba (pet-ul
// nou "tine minte" ce s-a discutat cu cel anterior, oarecum). Acceptabil
// pentru MVP — alternativa (history per specie) ar duce la fragmentare.
// =====================================================================

const chatMessageSchema = z.object({
  message: z.string().trim().min(1).max(500),
});

function chatCacheKey(userId: string): string {
  return `pet:chat:${userId}`;
}

function calcAge(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  return age;
}

// GET /pets/chat — istoric curent (mobile-ul afiseaza la deschiderea ecranului).
// Returneaza max ultimele MAX_TURNS mesaje, in ordine cronologica.
//
// Doua scenarii audio pt voce naturala in live mode:
//  - history GOL → sintetizez un `intro` (catchphrase) → mobile afiseaza-l ca
//    bubble de assistant si live mode il canta cu TTS (vezi `intro` de mai jos).
//  - history NEGOL → sintetizez TTS-ul ultimului mesaj assistant si i-l atasez
//    ca `audioUrl` pe mesaj. Daca textul a fost cantat la POST anterior, cache-ul
//    sha256 face fileExists hit imediat (zero compute). Asa, cand user re-intra
//    in chat dupa o conversatie, live mode redireaza ultima replica in voce
//    naturala, fara fallback pe expo-speech (robotic).
petsRouter.get('/chat', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const history = await loadChatHistory(chatCacheKey(userId));

    type ChatMessageDto = {
      id: string;
      role: 'user' | 'assistant';
      content: string;
      audioUrl: string | null;
    };

    const messages: ChatMessageDto[] = history.map((t, i) => ({
      id: `h-${i}`,
      role: t.role,
      content: t.content,
      audioUrl: null,
    }));

    let intro: { text: string; audioUrl: string | null; ttsProvider: string | null } | null = null;

    // Pet-ul ne trebuie pt vocea TTS in ambele scenarii — il incarcam o data.
    let pet: Awaited<ReturnType<typeof prisma.pet.findUniqueOrThrow>> & {
      species: Awaited<ReturnType<typeof prisma.petSpecies.findUniqueOrThrow>>;
    } | null = null;
    const ensurePet = async () => {
      if (pet) return pet;
      await ensureDefaultPet(userId);
      pet = await prisma.pet.findUniqueOrThrow({
        where: { userId },
        include: { species: true },
      });
      return pet;
    };
    const ttsFor = (text: string) =>
      ensurePet().then((p) =>
        synthesizeTts(text, p.species.voiceId, {
          elevenVoiceId: p.species.elevenVoiceId,
          rvc: p.species.rvcModelUrl
            ? { modelZipUrl: p.species.rvcModelUrl, pitchShift: p.species.rvcPitchShift }
            : undefined,
        }),
      );

    if (messages.length === 0) {
      const p = await ensurePet();
      const phrases = p.species.catchphrases;
      const introText = phrases.length > 0
        ? phrases[Math.floor(Math.random() * phrases.length)]!
        : 'Hei.';
      let audioUrl: string | null = null;
      let ttsProvider: string | null = null;
      try {
        const tts = await ttsFor(introText);
        audioUrl = tts.urlPath;
        ttsProvider = tts.provider;
      } catch (err) {
        req.log.error({ err }, 'tts.pet_chat_intro_failed');
      }
      intro = { text: introText, audioUrl, ttsProvider };
    } else {
      // Resincronizam audio pe ultimul mesaj assistant (live mode il canta la
      // re-deschiderea ecranului). Iteram de la coada catre cap ca sa luam
      // primul `assistant` intalnit.
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i]!;
        if (m.role !== 'assistant') continue;
        try {
          const tts = await ttsFor(m.content);
          m.audioUrl = tts.urlPath;
        } catch (err) {
          req.log.error({ err }, 'tts.pet_chat_history_last_failed');
        }
        break;
      }
    }

    res.json({ messages, intro });
  } catch (e) {
    next(e);
  }
});

// POST /pets/chat — trimite mesaj, primeste raspuns + audio TTS al pet-ului.
petsRouter.post('/chat', petChatRateLimit, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { message } = chatMessageSchema.parse(req.body);

    const [user, pet] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, name: true, birthDate: true },
      }),
      ensureDefaultPet(userId).then((p) =>
        prisma.pet.findUniqueOrThrow({
          where: { id: p.id },
          include: { species: true },
        }),
      ),
    ]);

    const cacheKey = chatCacheKey(userId);
    const history = await loadChatHistory(cacheKey);
    const userTurn = { role: 'user' as const, content: message };

    const completion = await claudeMessages({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      system: petChatSystemPrompt({
        name: pet.name,
        speciesName: pet.species.name,
        systemHint: pet.species.systemHint,
        shortLore: pet.species.shortLore,
        tone: pet.species.tone,
        catchphrases: pet.species.catchphrases,
        interests: pet.species.interests,
        childName: user.name,
        childAge: calcAge(user.birthDate),
      }),
      messages: [...history, userTurn].map((t) => ({ role: t.role, content: t.content })),
    }, 'pet_chat');

    const replyText = completion.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (!replyText) throw serverError('ai_empty', 'Pet-ul nu a raspuns');

    await appendChatTurn(cacheKey, userTurn);
    await appendChatTurn(cacheKey, { role: 'assistant', content: replyText });

    let replyAudioUrl: string | null = null;
    let ttsProvider: string | null = null;
    try {
      const tts = await synthesizeTts(replyText, pet.species.voiceId, {
        elevenVoiceId: pet.species.elevenVoiceId,
        rvc: pet.species.rvcModelUrl
          ? {
              modelZipUrl: pet.species.rvcModelUrl,
              pitchShift: pet.species.rvcPitchShift,
            }
          : undefined,
      });
      replyAudioUrl = tts.urlPath;
      ttsProvider = tts.provider;
    } catch (err) {
      req.log.error({ err }, 'tts.pet_chat_reply_failed');
    }

    res.json({ reply: replyText, replyAudioUrl, ttsProvider });
  } catch (e) {
    next(e);
  }
});

// DELETE /pets/chat — sterge istoricul (button "conversatie noua" in mobile).
petsRouter.delete('/chat', async (req, res, next) => {
  try {
    const userId = req.userId!;
    await clearChatHistory(chatCacheKey(userId));
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
