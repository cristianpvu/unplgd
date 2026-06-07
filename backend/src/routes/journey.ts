// Journey — TTS pentru povestile predefinite + cautare random friend pet.
//
// Mobile detine continutul povestilor. Backend ofera:
//   - POST /journey/tts          → sintetizeaza textul cu voce narator sau pet
//   - GET  /journey/random-friend → un pet random al unui prieten, pt encounter

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, notFound, conflict } from '../lib/errors.js';
import { ensureDefaultPet } from '../lib/pet.js';
import { questDateForNow } from '../lib/quests/daily.js';
import { logger } from '../lib/logger.js';
import { synthesizeTts } from '../lib/ai/tts.js';
import { NARRATOR_EDGE_VOICE, narratorElevenVoiceId } from '../lib/ai/narrator.js';
import { resolvePetImagePath, resolveBackgroundAssets } from '../lib/petImage.js';
import { awardBondXp } from '../lib/pet/bond.js';
import { awardSkillsForEvent, SKILL_REWARDS } from '../lib/skills.js';
import { awardDomainXp, DOMAIN_REWARDS } from '../lib/domains.js';
import { bumpQuestProgress } from '../lib/quests/progress.js';

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
  explanation: string | null;
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
      SELECT id, prompt, options, "correctIndex", "successLine", "failLine", explanation
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

// POST /journey/answer
// Granularitate per intrebare. Mobile face validare locala pt UX instant,
// dar trimite raspunsul aici fire-and-forget ca sa hranim domain XP + skill XP
// pe domain-ul intrebarii. Idempotent: re-apel cu acelasi (userId, questionId)
// = no-op. Server valideaza correctIndex (chiar daca mobile a vazut deja
// raspunsul corect — vrem sa fim siguri pe semnal).
//
// Greselile NU se rasplatesc dar le logam pt analytics (ce domenii/varste sunt
// grele). NU exista penalty XP.
const answerSchema = z.object({
  questionId: z.string().min(1).max(64),
  chosenIndex: z.number().int().min(0).max(20),
});

journeyRouter.post('/answer', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const body = answerSchema.parse(req.body);

    const question = await prisma.journeyQuestion.findUnique({
      where: { id: body.questionId },
      select: { id: true, domain: true, correctIndex: true },
    });
    if (!question) throw notFound('question_not_found', 'Intrebare inexistenta');

    const correct = body.chosenIndex === question.correctIndex;

    if (!correct) {
      // Logam pt analytics — nu acordam XP la greseala.
      logger.info(
        { userId, questionId: question.id, domain: question.domain, chosenIndex: body.chosenIndex },
        'journey.answer_incorrect',
      );
      res.json({ correct: false, awarded: { domain: 0, skills: 0 } });
      return;
    }

    // Award XP idempotent pe questionId.
    const [domainAward] = await Promise.all([
      awardDomainXp(
        userId,
        question.domain,
        DOMAIN_REWARDS.JOURNEY_QUESTION_CORRECT,
        'journey_question',
        question.id,
        `Intrebare corecta ${question.domain}`,
      ),
      awardSkillsForEvent(
        userId,
        'journey_question',
        question.id,
        SKILL_REWARDS.JOURNEY_QUESTION_CORRECT,
        `Intrebare corecta ${question.domain}`,
      ),
    ]);

    res.json({
      correct: true,
      awarded: {
        domain: domainAward.alreadyAwarded ? 0 : domainAward.amount,
        domainSlug: question.domain,
        skills: domainAward.alreadyAwarded ? 0 : 1, // bool simplu pt mobile
      },
    });
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
  // Slug-ul speciei pet-ului la momentul completarii — util pentru grupare in
  // pagina de chat (cate capitole are pet-ul X completate). Optional pentru
  // compatibilitate cu apeluri vechi.
  petSlug: z.string().min(1).max(64).optional(),
  bondXp: z.number().int().min(0).max(1000).optional(),
  backgroundKey: z.string().min(1).max(80).optional(),
});

type CheckpointResponse = {
  bondAwarded: number;
  unlockedBackground: {
    key: string;
    name: string;
    imageUrl: string;
    videoUrl: string | null;
    tier: number;
  } | null;
};

// Limita: maxim un capitol nou de journey pe zi (Bucharest), GLOBAL pe toate
// pet-urile. Scop: copiii nu stau pe telefon sa termine toata povestea dintr-o
// data. `excludeChapterId` = capitolul curent, ca re-claim-ul aceluiasi capitol
// (idempotent) sa nu fie considerat "alt capitol azi".
async function hasCompletedChapterToday(userId: string, excludeChapterId?: string): Promise<boolean> {
  const latest = await prisma.journeyChapterProgress.findFirst({
    where: {
      userId,
      ...(excludeChapterId ? { chapterId: { not: excludeChapterId } } : {}),
    },
    orderBy: { completedAt: 'desc' },
    select: { completedAt: true },
  });
  if (!latest) return false;
  return questDateForNow(latest.completedAt) === questDateForNow();
}

journeyRouter.post('/checkpoint', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const body = checkpointSchema.parse(req.body);

    await ensureDefaultPet(userId);
    const pet = await prisma.pet.findUniqueOrThrow({
      where: { userId },
      include: { species: true },
    });
    const petSlug = body.petSlug ?? pet.species.slug;

    // Backstop limita zilnica: daca e capitol NOU (nu re-claim) si user-ul a mai
    // terminat un capitol azi, refuzam. Frontend-ul oricum blocheaza intrarea;
    // asta e plasa de siguranta pe API.
    const alreadyDone = await prisma.journeyChapterProgress.findUnique({
      where: { userId_chapterId: { userId, chapterId: body.chapterId } },
    });
    if (!alreadyDone && (await hasCompletedChapterToday(userId, body.chapterId))) {
      throw conflict('journey_daily_limit', 'Ai terminat deja un capitol azi. Revino maine!');
    }

    // Inregistram capitolul ca terminat. Idempotent prin unique (userId, chapterId).
    try {
      await prisma.journeyChapterProgress.create({
        data: {
          userId,
          chapterId: body.chapterId,
          petSlug,
        },
      });
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err;
    }

    // Skill award la chapter completed (perseverenta + curiozitate). Idempotent
    // pe chapterId. Granularitatea per intrebare e acordata separat prin
    // POST /journey/answer (fire-and-forget din mobile pe fiecare raspuns).
    await awardSkillsForEvent(
      userId,
      'journey_chapter',
      body.chapterId,
      SKILL_REWARDS.JOURNEY_CHAPTER_COMPLETED,
      `Capitol journey ${body.chapterId} terminat`,
    );

    void bumpQuestProgress(userId, 'journey_chapter').catch(() => {});

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
        const resolved = await resolveBackgroundAssets(bg);
        unlockedBackground = {
          key: bg.key,
          name: bg.name,
          imageUrl: resolved.imageUrl,
          videoUrl: resolved.videoUrl,
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

// GET /journey/progress?petSlug=darth-vader
// Returneaza lista de chapterIds completate de user pt un pet (sau global daca
// nu se da petSlug). Mobile cere asta la deschiderea chat-ului ca sa stie daca
// pet-ul mai are povesti necompletate si afiseaza butonul de aventura.
type ProgressResponse = {
  petSlug: string | null;
  completedChapters: string[];
  // True daca user-ul a terminat deja un capitol AZI (global, orice pet). Cand
  // e true, mobile blocheaza pornirea unui capitol nou ("Revino maine").
  completedToday: boolean;
};

journeyRouter.get('/progress', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const petSlug = typeof req.query.petSlug === 'string' ? req.query.petSlug : null;
    const where: { userId: string; petSlug?: string } = { userId };
    if (petSlug) where.petSlug = petSlug;
    const [rows, completedToday] = await Promise.all([
      prisma.journeyChapterProgress.findMany({
        where,
        select: { chapterId: true },
      }),
      hasCompletedChapterToday(userId),
    ]);
    const response: ProgressResponse = {
      petSlug,
      completedChapters: rows.map((r) => r.chapterId),
      completedToday,
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
