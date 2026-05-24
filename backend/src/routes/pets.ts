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
import { bondProgress } from '../lib/pet/bond.js';
import { awardTopicFromMessage } from '../lib/pet/topicAward.js';
import { getOrGenerateDailyHook } from '../lib/pet/dailyHook.js';
import { getChildProfileSnapshot } from '../lib/pet/childProfile.js';
import { extractAndSaveMemories, getPetMemoriesForPrompt } from '../lib/pet/memory.js';

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

// GET /pets/me — pet activ + colectia de carduri detinute + specia default
// ("Buddy") pe care toti userii o au mereu, indiferent de carduri. Lazy-creeaza
// pet-ul daca lipseste (defensiv pt conturi vechi inainte de feature).
petsRouter.get('/me', async (req, res, next) => {
  try {
    const userId = req.userId!;
    await ensureDefaultPet(userId);

    const [pet, cards, defaultSpecies] = await Promise.all([
      prisma.pet.findUniqueOrThrow({
        where: { userId },
        include: { species: true },
      }),
      prisma.nfcPetCard.findMany({
        where: { ownerId: userId },
        include: { species: true },
        orderBy: { claimedAt: 'asc' },
      }),
      prisma.petSpecies.findFirst({ where: { isDefault: true } }),
    ]);

    if (!defaultSpecies) {
      throw serverError('no_default_species', 'Specia default nu e seedata');
    }

    const [petSpecies, defaultSpeciesDto, cardSpecies] = await Promise.all([
      speciesDto(pet.species),
      speciesDto(defaultSpecies),
      Promise.all(cards.map((c) => speciesDto(c.species))),
    ]);

    res.json({
      pet: {
        id: pet.id,
        name: pet.name,
        bondXp: pet.bondXp,
        bond: bondProgress(pet.bondXp),
        species: petSpecies,
      },
      defaultSpecies: defaultSpeciesDto,
      defaultEquipped: pet.speciesId === defaultSpecies.id,
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
        bond: bondProgress(pet.bondXp),
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

// POST /pets/equip-default — revino la Buddy default. Nu necesita card —
// specia default e disponibila tuturor userilor mereu. Resetam si numele
// la "Buddy" (cel default) ca sa nu pastram nickname-ul vechi de card.
petsRouter.post('/equip-default', async (req, res, next) => {
  try {
    const userId = req.userId!;

    const defaultSpecies = await prisma.petSpecies.findFirst({
      where: { isDefault: true },
    });
    if (!defaultSpecies) {
      throw serverError('no_default_species', 'Specia default nu e seedata');
    }

    await ensureDefaultPet(userId);
    const pet = await prisma.pet.update({
      where: { userId },
      data: { speciesId: defaultSpecies.id, name: 'Buddy' },
      include: { species: true },
    });
    // Chat-ul pet-ului anterior nu mai are sens cu specia noua (alta voce,
    // alt personaj). Stergem ca utilizatorul sa primeasca intro proaspat.
    await clearChatHistory(chatCacheKey(userId));

    res.json({
      pet: {
        id: pet.id,
        name: pet.name,
        bondXp: pet.bondXp,
        bond: bondProgress(pet.bondXp),
        species: await speciesDto(pet.species),
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

    // La switch intre carduri, numele Pet-ului trebuie sa reflecte cardul
    // nou echipat — fara asta, utilizatorul pastreaza "Groot" cand schimba
    // la "Luna". Preferinta: nickname-ul cardului → numele speciei.
    const newName = card.nickname ?? card.species.name;
    const pet = await prisma.pet.update({
      where: { userId },
      data: { speciesId: card.speciesId, name: newName },
      include: { species: true },
    });
    // Chat-ul pet-ului anterior nu mai are sens cu specia noua. Stergem ca
    // user-ul sa primeasca un intro proaspat in vocea noului companion.
    await clearChatHistory(chatCacheKey(userId));

    const [petSpecies, cardSpeciesDto] = await Promise.all([
      speciesDto(pet.species),
      speciesDto(card.species),
    ]);

    res.json({
      pet: {
        id: pet.id,
        name: pet.name,
        bondXp: pet.bondXp,
        bond: bondProgress(pet.bondXp),
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
// Cheie Redis: pet:chat:{userId} — istoricul e pe user, NU pe specie.
// Cand user-ul schimba pet-ul via /pets/equip sau /pets/equip-default,
// stergem explicit cache-ul (vezi handler-ele) ca noul pet sa porneasca
// proaspat — alta voce, alta personalitate.
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
      await ensurePet();
      // Intro = acelasi daily hook care apare in bubble-ul pe home, ca sa
      // existe continuitate cand user-ul tap-uieste pe pet (bubble teasere ->
      // chat continua firul). Hook-ul e cached zilnic, deci e instant aici.
      let introText: string;
      try {
        const hook = await getOrGenerateDailyHook(userId);
        introText = hook.text;
      } catch (err) {
        req.log.error({ err }, 'pet_hook.intro_fallback_to_catchphrase');
        const p = await ensurePet();
        const phrases = p.species.catchphrases;
        introText = phrases.length > 0
          ? phrases[Math.floor(Math.random() * phrases.length)]!
          : 'Hei.';
      }
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

      // Persistam intro-ul DOAR in chat history (Redis), NU in messages
      // returnat aici — altfel mobile-ul l-ar afisa duplicat (o data ca intro
      // si o data ca mesaj). Pe urmatorul GET /chat history.length > 0 si
      // intro = null; mesajul intra natural ca prima replica assistant.
      //
      // Beneficiu real: la primul mesaj al kid-ului, Claude vede in context
      // [intro_text, kid_msg] si continua firul, nu porneste de la zero.
      try {
        await appendChatTurn(chatCacheKey(userId), {
          role: 'assistant',
          content: introText,
        });
      } catch (err) {
        req.log.warn({ err }, 'pet_hook.intro_history_persist_failed');
      }
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

    const [user, pet, childProfile] = await Promise.all([
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
      // Background context concise — pet-ul stie pe ce sa puna accent fara
      // sa-l listeze. Cached 5min in Redis. Daca pica, prompt-ul cade pe
      // varianta fara CHILD_PROFILE block (pet-ul ramane generic).
      getChildProfileSnapshot(userId),
    ]);

    // Memorii persistente per (user, species). Fetched dupa pet ca sa stim
    // speciesSlug-ul; separat de Promise.all-ul de mai sus pt simplicitate.
    const memories = await getPetMemoriesForPrompt(userId, pet.species.slug);

    // Log diagnostic ca sa putem verifica ca profilul ajunge la model.
    // Scoatem dupa ce confirmam comportamentul end-to-end.
    req.log.info(
      {
        userId,
        topSkills: childProfile.topSkills,
        topDomains: childProfile.topDomains,
        recentHighlights: childProfile.recentHighlights,
        bondLevel: childProfile.bondLevel,
        profileEmpty:
          childProfile.topSkills.length === 0 &&
          childProfile.topDomains.length === 0 &&
          childProfile.recentHighlights.length === 0,
      },
      'pet_chat.child_profile_snapshot',
    );

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
        childProfile,
        memories,
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

    // Topic detection fire-and-forget — clasifica mesajul copilului si acordeaza
    // DomainXp daca confidence-ul depaseste threshold-ul. NU blocheaza raspunsul
    // pet-ului. Cap zilnic 5/(user, domain) gestionat in topicAward.
    void awardTopicFromMessage(userId, message).catch((err) => {
      req.log.warn({ err }, 'topic.award_unexpected_throw');
    });

    // Pet memory fire-and-forget — extragem fapte durabile despre copil din
    // schimbul curent si le salvam per (user, speciesSlug). La conversatia
    // urmatoare cu ACEST pet, faptele sunt injectate in prompt. Alt pet (alta
    // specie) NU vede aceste memorii.
    void extractAndSaveMemories({
      userId,
      speciesSlug: pet.species.slug,
      userMessage: message,
      assistantReply: replyText,
    }).catch((err) => {
      req.log.warn({ err }, 'pet_memory.extract_unexpected_throw');
    });

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

// GET /pets/daily-hook — mesajul personalizat care apare in bubble-ul pet-ului
// pe home, generat o data pe zi per user pe baza activitatii recente (48h).
// Cache 24h in Redis (cheia se schimba la miezul noptii Bucuresti).
//
// Acelasi text e folosit ca intro la chat cand history-ul e gol — asa
// conversatia continua firul tease-uit pe home.
petsRouter.get('/daily-hook', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const hook = await getOrGenerateDailyHook(userId);
    res.json({ text: hook.text, generatedAt: hook.generatedAt });
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
