import { Router } from 'express';
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { anthropic, ANTHROPIC_MODEL } from '../lib/ai/client.js';
import {
  storyCreateSystemPrompt,
  storyVerifySystemPrompt,
  type PetContext,
} from '../lib/ai/storyPrompts.js';
import { awardXp, XP_REWARDS } from '../lib/xp.js';
import {
  appendChatTurn,
  clearChatHistory,
  loadChatHistory,
} from '../lib/ai/chatContext.js';
import { extractJsonBlock } from '../lib/ai/jsonExtract.js';
import { synthesizeTts } from '../lib/ai/tts.js';
import { ensureDefaultPet } from '../lib/pet.js';
import { badRequest, conflict, forbidden, notFound, serverError } from '../lib/errors.js';

export const storiesRouter = Router();
storiesRouter.use(requireAuth);

const chatSchema = z.object({
  message: z.string().trim().min(1).max(500),
});

type StoryDraft = {
  title: string;
  body: string;
  keyFacts: { q: string; expected: string }[];
};

function isStoryDraft(x: unknown): x is StoryDraft {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (typeof o.title !== 'string' || typeof o.body !== 'string') return false;
  if (!Array.isArray(o.keyFacts) || o.keyFacts.length !== 5) return false;
  return o.keyFacts.every(
    (f) =>
      f && typeof f === 'object' &&
      typeof (f as Record<string, unknown>).q === 'string' &&
      typeof (f as Record<string, unknown>).expected === 'string',
  );
}

// POST /stories — chat conversational pt creare poveste. Limita 1/zi.
storiesRouter.post('/', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { message } = chatSchema.parse(req.body);

    // Limita zilnica: 1 poveste creata per copil per zi calendaristica
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayCount = await prisma.story.count({
      where: { authorId: userId, createdAt: { gte: startOfDay } },
    });
    if (todayCount >= 1) {
      throw conflict(
        'daily_limit',
        'Ai creat deja o poveste azi. Mai poti crea una maine!',
      );
    }

    // Pet + user info pt persona
    const [user, pet] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      ensureDefaultPet(userId).then((p) =>
        prisma.pet.findUniqueOrThrow({
          where: { id: p.id },
          include: { species: true },
        }),
      ),
    ]);

    const petContext: PetContext = {
      name: pet.name,
      speciesName: pet.species.name,
      systemHint: pet.species.systemHint,
    };

    const cacheKey = `story:create:${userId}`;
    const history = await loadChatHistory(cacheKey);
    const userTurn = { role: 'user' as const, content: message };

    const completion = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: storyCreateSystemPrompt(petContext, user.name),
      messages: [...history, userTurn].map((t) => ({
        role: t.role,
        content: t.content,
      })),
    });

    const replyText = completion.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (!replyText) {
      throw serverError('ai_empty', 'AI-ul nu a raspuns');
    }

    // Verifica daca e finalul (JSON) sau intrebare in desfasurare
    const json = extractJsonBlock(replyText);

    if (json && isStoryDraft(json)) {
      // Final — salveaza povestea, sterge contextul Redis
      const story = await prisma.story.create({
        data: {
          authorId: userId,
          title: json.title,
          body: json.body,
          keyFacts: json.keyFacts as unknown as object,
        },
      });
      await clearChatHistory(cacheKey);

      // TTS pe body — vocea pet-ului.
      let bodyAudioUrl: string | null = null;
      let ttsProvider: string | null = null;
      let ttsError: string | null = null;
      try {
        const tts = await synthesizeTts(json.body, pet.species.voiceId);
        bodyAudioUrl = tts.urlPath;
        ttsProvider = tts.provider;
      } catch (err) {
        req.log.error({ err }, 'tts.story_body_failed');
        ttsError = err instanceof Error ? err.message : String(err);
      }

      res.status(201).json({
        finalStory: {
          id: story.id,
          title: story.title,
          body: story.body,
          bodyAudioUrl,
          ttsProvider,
          ttsError,
        },
      });
      return;
    }

    // Continuam conversatia — append in Redis
    await appendChatTurn(cacheKey, userTurn);
    await appendChatTurn(cacheKey, { role: 'assistant', content: replyText });

    res.json({ reply: replyText });
  } catch (e) {
    next(e);
  }
});

// DELETE /stories/draft — reseteaza chat-ul de creare (cazuri de reset / abandon)
storiesRouter.delete('/draft', async (req, res, next) => {
  try {
    const userId = req.userId!;
    await clearChatHistory(`story:create:${userId}`);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// GET /stories/mine — carnetelul autorului. Lista povestilor create de mine,
// cea mai noua prima. NU expunem keyFacts — secrete server-side.
storiesRouter.get('/mine', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const stories = await prisma.story.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, body: true, createdAt: true },
    });
    res.json({ stories });
  } catch (e) {
    next(e);
  }
});

// GET /stories/inbox — pentru fiecare prieten cu poveste creata in ultimele 3
// zile pe care eu nu am verificat-o, returnez ultima poveste a lui + meta.
storiesRouter.get('/inbox', async (req, res, next) => {
  try {
    const me = req.userId!;
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // Lista prieteni acceptati
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: me }, { receiverId: me }],
      },
      select: { requesterId: true, receiverId: true },
    });
    const friendIds = friendships.map((f) =>
      f.requesterId === me ? f.receiverId : f.requesterId,
    );
    if (friendIds.length === 0) {
      res.json({ items: [] });
      return;
    }

    // Povestile recente ale prietenilor + claim-urile mele (verificat / esuat)
    const [recentStories, myClaims] = await Promise.all([
      prisma.story.findMany({
        where: {
          authorId: { in: friendIds },
          createdAt: { gte: threeDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: { id: true, name: true, avatar: { select: { svg: true } } },
          },
        },
      }),
      prisma.storyClaim.findMany({
        where: { listenerId: me },
        select: { storyId: true, status: true },
      }),
    ]);

    // Filtrez storiile care au claim VERIFIED sau FAILED de la mine — astea-s
    // gata. Cele cu ATTEMPTING raman in inbox (in progress).
    const closedStoryIds = new Set(
      myClaims
        .filter((c) => c.status === 'VERIFIED' || c.status === 'FAILED')
        .map((c) => c.storyId),
    );

    // Per prieten, prima (cea mai noua) poveste neinchisa
    const seenAuthors = new Set<string>();
    const items: Array<{
      storyId: string;
      title: string;
      createdAt: Date;
      author: { id: string; name: string; avatarSvg: string | null };
      claimStatus: 'NONE' | 'ATTEMPTING';
    }> = [];

    for (const s of recentStories) {
      if (closedStoryIds.has(s.id)) continue;
      if (seenAuthors.has(s.authorId)) continue;
      seenAuthors.add(s.authorId);
      const myClaim = myClaims.find((c) => c.storyId === s.id);
      items.push({
        storyId: s.id,
        title: s.title,
        createdAt: s.createdAt,
        author: {
          id: s.author.id,
          name: s.author.name,
          avatarSvg: s.author.avatar?.svg ?? null,
        },
        claimStatus: myClaim?.status === 'ATTEMPTING' ? 'ATTEMPTING' : 'NONE',
      });
    }

    res.json({ items });
  } catch (e) {
    next(e);
  }
});

// POST /stories/:storyId/claim — listener apasa "i-a povestit prietenul X".
// Idempotent: daca exista deja un claim ATTEMPTING returneaza-l, daca exista
// VERIFIED/FAILED returneaza 409 (nu mai poate reincerca).
storiesRouter.post('/:storyId/claim', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { storyId } = req.params;
    if (!storyId) throw badRequest('missing_id', 'storyId lipsa');

    const story = await prisma.story.findUnique({
      where: { id: storyId },
      select: {
        id: true,
        authorId: true,
        createdAt: true,
      },
    });
    if (!story) throw notFound('story_not_found', 'Povestea nu exista');
    if (story.authorId === me) {
      throw forbidden('self_claim', 'Nu poti verifica propria poveste');
    }

    // Doar prieteni acceptati pot claim
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: me, receiverId: story.authorId },
          { requesterId: story.authorId, receiverId: me },
        ],
      },
      select: { id: true },
    });
    if (!friendship) {
      throw forbidden('not_friends', 'Trebuie sa fiti prieteni ca sa verifici povestea');
    }

    // 3 zile expirare din momentul crearii — dupa, nu se mai poate claim
    const ageDays = (Date.now() - story.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > 3) {
      throw badRequest('story_expired', 'Povestea e prea veche, a expirat');
    }

    const claim = await prisma.storyClaim.upsert({
      where: { storyId_listenerId: { storyId, listenerId: me } },
      create: { storyId, listenerId: me },
      update: {}, // idempotent — daca exista deja ATTEMPTING, returneaza
    });

    if (claim.status === 'VERIFIED' || claim.status === 'FAILED') {
      throw conflict('already_attempted', 'Ai incercat deja la povestea asta');
    }

    res.status(201).json({ claimId: claim.id });
  } catch (e) {
    next(e);
  }
});

// GET /stories/claims/:claimId — state pt mobile (titlu autor, status, attempts).
// NU expune body sau keyFacts — listener-ul nu trebuie sa le vada niciodata.
storiesRouter.get('/claims/:claimId', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { claimId } = req.params;
    if (!claimId) throw badRequest('missing_id', 'claimId lipsa');

    const claim = await prisma.storyClaim.findUnique({
      where: { id: claimId },
      include: {
        story: {
          select: {
            id: true,
            title: true,
            createdAt: true,
            author: {
              select: { id: true, name: true, avatar: { select: { svg: true } } },
            },
          },
        },
      },
    });
    if (!claim) throw notFound('claim_not_found', 'Verificare inexistenta');
    if (claim.listenerId !== me) {
      throw forbidden('not_yours', 'Nu e verificarea ta');
    }

    res.json({
      claim: {
        id: claim.id,
        status: claim.status,
        attempts: claim.attempts,
        score: claim.score,
        story: {
          id: claim.story.id,
          title: claim.story.title,
          createdAt: claim.story.createdAt,
          author: {
            id: claim.story.author.id,
            name: claim.story.author.name,
            avatarSvg: claim.story.author.avatar?.svg ?? null,
          },
        },
      },
    });
  } catch (e) {
    next(e);
  }
});

// POST /stories/claims/:claimId/answer — chat verify cu pet-ul lui B.
// Pet-ul are in context keyFacts (NU body), pune intrebarile pe rand,
// la final returneaza JSON cu score.
const answerSchema = z.object({
  message: z.string().trim().min(1).max(500),
});

type StoryVerifyResult = {
  score: number;
  perFact: { q: string; given: string; correct: boolean }[];
  summary: string;
};

function isVerifyResult(x: unknown): x is StoryVerifyResult {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (typeof o.score !== 'number' || o.score < 0 || o.score > 5) return false;
  if (typeof o.summary !== 'string') return false;
  if (!Array.isArray(o.perFact)) return false;
  return o.perFact.every(
    (f) =>
      f && typeof f === 'object' &&
      typeof (f as Record<string, unknown>).q === 'string' &&
      typeof (f as Record<string, unknown>).given === 'string' &&
      typeof (f as Record<string, unknown>).correct === 'boolean',
  );
}

storiesRouter.post('/claims/:claimId/answer', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { claimId } = req.params;
    if (!claimId) throw badRequest('missing_id', 'claimId lipsa');
    const { message } = answerSchema.parse(req.body);

    const claim = await prisma.storyClaim.findUnique({
      where: { id: claimId },
      include: {
        story: { include: { author: { select: { id: true, name: true } } } },
      },
    });
    if (!claim) throw notFound('claim_not_found', 'Verificare inexistenta');
    if (claim.listenerId !== me) {
      throw forbidden('not_yours', 'Nu e verificarea ta');
    }
    if (claim.status !== 'ATTEMPTING') {
      throw conflict('claim_closed', 'Verificarea e deja inchisa');
    }

    // Pet-ul listener-ului
    const [listener, pet] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: me } }),
      ensureDefaultPet(me).then((p) =>
        prisma.pet.findUniqueOrThrow({
          where: { id: p.id },
          include: { species: true },
        }),
      ),
    ]);

    const petContext: PetContext = {
      name: pet.name,
      speciesName: pet.species.name,
      systemHint: pet.species.systemHint,
    };

    const keyFacts = claim.story.keyFacts as unknown as { q: string; expected: string }[];
    if (!Array.isArray(keyFacts) || keyFacts.length !== 5) {
      throw serverError('story_corrupt', 'Povestea are date corupte');
    }

    const cacheKey = `story:verify:${claim.id}`;
    const history = await loadChatHistory(cacheKey);
    const userTurn = { role: 'user' as const, content: message };

    const completion = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: storyVerifySystemPrompt(
        petContext,
        listener.name,
        claim.story.author.name,
        keyFacts,
      ),
      messages: [...history, userTurn].map((t) => ({ role: t.role, content: t.content })),
    });

    const replyText = completion.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (!replyText) throw serverError('ai_empty', 'AI-ul nu a raspuns');

    const json = extractJsonBlock(replyText);

    if (json && isVerifyResult(json)) {
      // Final — salveaza scor + acorda XP
      const passed = json.score >= 3;
      const newAttempts = claim.attempts + 1;

      // 2 incercari permise: daca pierzi prima dar n-ai consumat ambele,
      // poti reincerca. Daca pierzi a doua, FAILED definitiv.
      let nextStatus: 'VERIFIED' | 'FAILED' | 'ATTEMPTING' = 'ATTEMPTING';
      if (passed) nextStatus = 'VERIFIED';
      else if (newAttempts >= 2) nextStatus = 'FAILED';

      await prisma.storyClaim.update({
        where: { id: claim.id },
        data: {
          status: nextStatus,
          attempts: newAttempts,
          score: passed ? json.score : claim.score,
          answers: json as unknown as object,
          verifiedAt: nextStatus === 'VERIFIED' ? new Date() : null,
        },
      });

      let xpListener = 0;
      let xpAuthor = 0;
      if (nextStatus === 'VERIFIED') {
        xpListener = XP_REWARDS.STORY_LISTENED_BY_SCORE[json.score] ?? 0;
        xpAuthor = XP_REWARDS.STORY_TOLD_BY_SCORE[json.score] ?? 0;
        await Promise.all([
          awardXp(me, xpListener, 'story_listened', claim.id, 'Poveste verificata'),
          awardXp(claim.story.authorId, xpAuthor, 'story_told', claim.id, 'Poveste spusa'),
        ]);
      }

      await clearChatHistory(cacheKey);

      // TTS pe summary — pet-ul lui B "vorbeste" la inchidere.
      let summaryAudioUrl: string | null = null;
      let ttsProvider: string | null = null;
      let ttsError: string | null = null;
      try {
        const tts = await synthesizeTts(json.summary, pet.species.voiceId);
        summaryAudioUrl = tts.urlPath;
        ttsProvider = tts.provider;
      } catch (err) {
        req.log.error({ err }, 'tts.verify_summary_failed');
        ttsError = err instanceof Error ? err.message : String(err);
      }

      res.json({
        done: true,
        status: nextStatus,
        score: json.score,
        summary: json.summary,
        summaryAudioUrl,
        ttsProvider,
        ttsError,
        perFact: json.perFact,
        canRetry: nextStatus === 'ATTEMPTING',
        xp: { listener: xpListener, author: xpAuthor },
      });
      return;
    }

    // Continuam — append in Redis
    await appendChatTurn(cacheKey, userTurn);
    await appendChatTurn(cacheKey, { role: 'assistant', content: replyText });

    res.json({ reply: replyText });
  } catch (e) {
    next(e);
  }
});
