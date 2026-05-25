import { Router } from 'express';
import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { ANTHROPIC_MODEL } from '../lib/ai/client.js';
import { claudeMessages } from '../lib/ai/usage.js';
import {
  storyCreateSystemPrompt,
  storyExtendSystemPrompt,
  storyVerifySystemPrompt,
} from '../lib/ai/storyPrompts.js';
import { awardXp, XP_REWARDS } from '../lib/xp.js';
import { awardSkillsForEvent, SKILL_REWARDS } from '../lib/skills.js';
import { awardDomainXp, DOMAIN_REWARDS } from '../lib/domains.js';
import { classifyTopic } from '../lib/ai/topicClassify.js';
import { getChildProfileSnapshot } from '../lib/pet/childProfile.js';
import { predictNextRootDomain } from '../lib/social/markov.js';
import { bumpQuestProgress } from '../lib/quests/progress.js';
import {
  appendChatTurn,
  clearChatHistory,
  loadChatHistory,
} from '../lib/ai/chatContext.js';
import { extractJsonBlock } from '../lib/ai/jsonExtract.js';
import { synthesizeTts } from '../lib/ai/tts.js';
import {
  NARRATOR_EDGE_VOICE,
  narratorElevenVoiceId,
} from '../lib/ai/narrator.js';
import { badRequest, conflict, forbidden, notFound, serverError } from '../lib/errors.js';

// TTS pt joculetul de povesti — voce narator fixa, independent de pet-ul
// user-ului. Forteaza ElevenLabs cand NARRATOR_VOICE_ID/ELEVENLABS_VOICE_ID e
// in env; altfel cade pe Edge TTS cu vocea NARRATOR_EDGE_VOICE.
function ttsNarrator(text: string) {
  return synthesizeTts(text, NARRATOR_EDGE_VOICE, {
    elevenVoiceId: narratorElevenVoiceId(),
  });
}

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

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const cacheKey = `story:create:${userId}`;
    const history = await loadChatHistory(cacheKey);
    const userTurn = { role: 'user' as const, content: message };

    // Profil copil — naratorul biaseaza propunerile creative catre pasiunile
    // lui. Cache 5min in Redis, deci nu e cost suplimentar real per mesaj.
    const [profile, prediction] = await Promise.all([
      getChildProfileSnapshot(userId),
      predictNextRootDomain(userId).catch(() => null),
    ]);
    const childCtx = {
      topDomains: profile.topDomains,
      topSkills: profile.topSkills,
      predictedNextDomain: prediction?.name ?? null,
    };

    const completion = await claudeMessages({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: storyCreateSystemPrompt(user.name, childCtx),
      messages: [...history, userTurn].map((t) => ({
        role: t.role,
        content: t.content,
      })),
    }, 'story_create');

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
      // chainRootId se autoreferentiaza la creare (povestea e propriul root al
      // unui posibil lant viitor). Update separat ca sa avem id-ul deja generat.
      await prisma.story.update({
        where: { id: story.id },
        data: { chainRootId: story.id },
      });
      await clearChatHistory(cacheKey);

      // Quest progress: a creat o poveste.
      void bumpQuestProgress(userId, 'story_author').catch(() => {});

      // TTS pe body — vocea Povestitorului (fixa pt toti, independent de pet).
      // Daca trece, persistam pe Story (audioUrl + audioProvider).
      let bodyAudioUrl: string | null = null;
      let ttsProvider: string | null = null;
      let ttsError: string | null = null;
      try {
        const tts = await ttsNarrator(json.body);
        bodyAudioUrl = tts.urlPath;
        ttsProvider = tts.provider;
        await prisma.story.update({
          where: { id: story.id },
          data: { audioUrl: tts.urlPath, audioProvider: tts.provider },
        });
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

    // TTS pe replica curenta a naratorului. Best-effort, nu blocheaza response.
    let replyAudioUrl: string | null = null;
    try {
      const tts = await ttsNarrator(replyText);
      replyAudioUrl = tts.urlPath;
    } catch (err) {
      req.log.error({ err }, 'tts.reply_failed');
    }

    res.json({ reply: replyText, replyAudioUrl });
  } catch (e) {
    next(e);
  }
});

// Cap pe numarul de capitole intr-un lant. Dincolo de 5 povestea devine
// obositoare si AI-ul are dificultati sa pastreze coerenta. Nu confundat cu
// numarul de extensii ale aceluiasi parinte (branching) — fiecare frunza din
// arbore are propriul lant cu propriul cap.
const CHAIN_MAX_LENGTH = 5;
// Pragul peste care acordam bonus XP retroactiv tuturor autorilor din lant.
// Idempotent prin XpTransaction unique pe (userId, "story_chain_4plus", chainRootId).
const CHAIN_BONUS_THRESHOLD = 4;
const CHAIN_BONUS_XP = 50;

type ChainEntry = { id: string; authorId: string; authorName: string; body: string };

// Urmareste linia parintelui pana la radacina, returnand toate capitolele in
// ordine cronologica (root → leaf). Limitat la CHAIN_MAX_LENGTH ca safety net
// in caz ca apare un ciclu (nu ar trebui — schema previne, dar paranoia).
async function loadAncestry(leafStoryId: string): Promise<ChainEntry[]> {
  const chain: ChainEntry[] = [];
  let nextId: string | null = leafStoryId;
  for (let i = 0; i < CHAIN_MAX_LENGTH + 1; i++) {
    if (nextId === null) break;
    const currentId: string = nextId;
    const s = await prisma.story.findUnique({
      where: { id: currentId },
      select: {
        id: true,
        authorId: true,
        body: true,
        parentStoryId: true,
        author: { select: { name: true } },
      },
    });
    if (!s) break;
    chain.unshift({
      id: s.id,
      authorId: s.authorId,
      authorName: s.author.name,
      body: s.body,
    });
    nextId = s.parentStoryId;
  }
  return chain;
}

// POST /stories/tts — sintetizeaza un text arbitrar cu vocea Povestitorului
// (independent de pet). Folosit de mobile pt replicile hardcodate ale
// joculetului de povesti (intro etc.).
const ttsSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

storiesRouter.post('/tts', async (req, res, next) => {
  try {
    const { text } = ttsSchema.parse(req.body);
    const tts = await ttsNarrator(text);
    res.json({ audioUrl: tts.urlPath, provider: tts.provider });
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
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
        _count: { select: { likes: true } },
      },
    });
    res.json({
      stories: stories.map((s) => ({
        id: s.id,
        title: s.title,
        body: s.body,
        createdAt: s.createdAt,
        likeCount: s._count.likes,
        likedByMe: false, // autorul nu se vede ca a apreciat propria poveste
      })),
    });
  } catch (e) {
    next(e);
  }
});

storiesRouter.get('/by-friend/:friendId', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { friendId } = req.params;
    if (!friendId) throw badRequest('missing_id', 'friendId lipsa');

    const friendship = await prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: me, receiverId: friendId },
          { requesterId: friendId, receiverId: me },
        ],
      },
      select: { id: true },
    });
    if (!friendship) {
      throw forbidden('not_friends', 'Nu sunteti prieteni');
    }

    const stories = await prisma.story.findMany({
      where: { authorId: friendId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
        _count: { select: { likes: true } },
      },
    });
    const myLikes = await prisma.storyLike.findMany({
      where: { userId: me, storyId: { in: stories.map((s) => s.id) } },
      select: { storyId: true },
    });
    const likedSet = new Set(myLikes.map((l) => l.storyId));
    res.json({
      stories: stories.map((s) => ({
        id: s.id,
        title: s.title,
        body: s.body,
        createdAt: s.createdAt,
        likeCount: s._count.likes,
        likedByMe: likedSet.has(s.id),
      })),
    });
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

    const listener = await prisma.user.findUniqueOrThrow({ where: { id: me } });

    const keyFacts = claim.story.keyFacts as unknown as { q: string; expected: string }[];
    if (!Array.isArray(keyFacts) || keyFacts.length !== 5) {
      throw serverError('story_corrupt', 'Povestea are date corupte');
    }

    const cacheKey = `story:verify:${claim.id}`;
    const history = await loadChatHistory(cacheKey);
    const userTurn = { role: 'user' as const, content: message };

    const completion = await claudeMessages({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: storyVerifySystemPrompt(
        listener.name,
        claim.story.author.name,
        keyFacts,
      ),
      messages: [...history, userTurn].map((t) => ({ role: t.role, content: t.content })),
    }, 'story_verify');

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
        // Quest progress: listener-ul a verificat o poveste; author-ul are
        // o poveste validata (story_author quest e despre creare, dar setam
        // pe verify ca semnal de "poveste a ajuns la cineva").
        void bumpQuestProgress(me, 'story_verify').catch(() => {});
        xpListener = XP_REWARDS.STORY_LISTENED_BY_SCORE[json.score] ?? 0;
        xpAuthor = XP_REWARDS.STORY_TOLD_BY_SCORE[json.score] ?? 0;
        await Promise.all([
          awardXp(me, xpListener, 'story_listened', claim.id, 'Poveste verificata'),
          awardXp(claim.story.authorId, xpAuthor, 'story_told', claim.id, 'Poveste spusa'),
          // Skills: listener primeste empatie+sociabilitate, author primeste
          // creativitate+curiozitate. Idempotent pe claim.id (un singur
          // listening per claim).
          awardSkillsForEvent(
            me,
            'story_listened',
            claim.id,
            SKILL_REWARDS.STORY_LISTENED_VERIFIED,
            'Poveste verificata',
          ),
          awardSkillsForEvent(
            claim.story.authorId,
            'story_told',
            claim.id,
            SKILL_REWARDS.STORY_AUTHORED,
            'Poveste spusa',
          ),
        ]);

        // Domain extraction din povestea verificata — clasificam o data la
        // verificare (nu la fiecare listening; cheia pt idempotenta e story.id
        // ca sa nu hranesc acelasi domeniu de N ori pt o singura poveste).
        // Fire-and-forget — daca pica clasificarea, XP-ul deja s-a dat.
        // La final, backfill EXPLICIT_LIKE pt useri care au dat like inainte
        // sa fi fost clasificata povestea (idempotent oricum).
        void (async () => {
          try {
            const fullStory = await prisma.story.findUnique({
              where: { id: claim.story.id },
              select: { body: true, title: true, domainSlug: true },
            });
            if (!fullStory) return;

            let domain = fullStory.domainSlug;
            if (!domain) {
              const textForClassify = `${fullStory.title}. ${fullStory.body}`;
              const cls = await classifyTopic(textForClassify);
              if (!cls || cls.domain === null || cls.confidence < 0.6) return;
              domain = cls.domain;
              // Persistam pe Story — refolosit la EXPLICIT_LIKE fara reclassify.
              await prisma.story
                .update({ where: { id: claim.story.id }, data: { domainSlug: domain } })
                .catch(() => {});
            }

            // Cheia sourceId = story.id → poveste de un autor cu N listeners,
            // domeniul lui se acorda O SINGURA DATA pe autor (idempotent).
            // Si listener-ul primeste pe story_listened ca sa-l hraneasca pe el
            // pe domeniul respectiv (sourceId distinct claim.id).
            await Promise.all([
              awardDomainXp(
                claim.story.authorId,
                domain,
                DOMAIN_REWARDS.STORY_AUTHORED,
                'story_authored',
                claim.story.id,
                `Story domain ${domain}`,
              ),
              awardDomainXp(
                me,
                domain,
                DOMAIN_REWARDS.STORY_LISTENED,
                'story_listened',
                claim.id,
                `Story domain ${domain}`,
              ),
            ]);

            // Backfill EXPLICIT_LIKE pt likes preexistente fara domain
            // cunoscut. Idempotent pe (userId, sourceType, sourceId=storyId).
            const existingLikes = await prisma.storyLike.findMany({
              where: { storyId: claim.story.id },
              select: { userId: true },
            });
            for (const like of existingLikes) {
              await awardDomainXp(
                like.userId,
                domain,
                DOMAIN_REWARDS.EXPLICIT_LIKE,
                'explicit_like',
                claim.story.id,
                'Backfill: like dat inainte de clasificare',
              ).catch(() => {});
            }
          } catch (err) {
            req.log.warn({ err, storyId: claim.story.id }, 'story.domain_extract_failed');
          }
        })();
      }

      await clearChatHistory(cacheKey);

      // TTS pe summary — Povestitorul (acelasi pt toti) inchide verificarea.
      let summaryAudioUrl: string | null = null;
      let ttsProvider: string | null = null;
      let ttsError: string | null = null;
      try {
        const tts = await ttsNarrator(json.summary);
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

    let replyAudioUrl: string | null = null;
    try {
      const tts = await ttsNarrator(replyText);
      replyAudioUrl = tts.urlPath;
    } catch (err) {
      req.log.error({ err }, 'tts.verify_reply_failed');
    }

    res.json({ reply: replyText, replyAudioUrl });
  } catch (e) {
    next(e);
  }
});

// POST /stories/:storyId/extend — chat conversational pt extinderea unei povesti
// pe care eu am verificat-o (StoryClaim VERIFIED). Creeaza un Story nou cu
// parentStoryId = storyId, mostenind chainRootId. keyFacts pe extensie sunt
// CUMULATIVE (acopera tot lantul) — un viitor ascultator e quizz-uit pe povestea
// integrala asa cum o aude de la mine. Limita zilnica e combinata cu /stories
// (1/zi total per autor, anti-farm).
type StoryExtendDraft = {
  body: string;
  keyFacts: { q: string; expected: string }[];
};

function isStoryExtendDraft(x: unknown): x is StoryExtendDraft {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (typeof o.body !== 'string') return false;
  if (!Array.isArray(o.keyFacts) || o.keyFacts.length !== 5) return false;
  return o.keyFacts.every(
    (f) =>
      f && typeof f === 'object' &&
      typeof (f as Record<string, unknown>).q === 'string' &&
      typeof (f as Record<string, unknown>).expected === 'string',
  );
}

storiesRouter.post('/:storyId/extend', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { storyId } = req.params;
    if (!storyId) throw badRequest('missing_id', 'storyId lipsa');
    const { message } = chatSchema.parse(req.body);

    const story = await prisma.story.findUnique({
      where: { id: storyId },
      select: {
        id: true,
        authorId: true,
        title: true,
        chainRootId: true,
      },
    });
    if (!story) throw notFound('story_not_found', 'Povestea nu exista');
    if (story.authorId === me) {
      throw forbidden('self_extend', 'Nu poti continua propria poveste');
    }

    const claim = await prisma.storyClaim.findUnique({
      where: { storyId_listenerId: { storyId, listenerId: me } },
      select: { status: true },
    });
    if (!claim || claim.status !== 'VERIFIED') {
      throw forbidden('not_verified', 'Trebuie sa fi verificat povestea ca sa o continui');
    }

    // Un user poate extinde un parinte o singura data — fara reluari.
    const existingExtension = await prisma.story.findFirst({
      where: { parentStoryId: storyId, authorId: me },
      select: { id: true },
    });
    if (existingExtension) {
      throw conflict('already_extended', 'Ai continuat deja aceasta poveste');
    }

    // Cap pe lant + anti-ciclu: nu reapar in propria mea ascendenta.
    const ancestry = await loadAncestry(storyId);
    if (ancestry.length >= CHAIN_MAX_LENGTH) {
      throw badRequest('chain_full', `Lantul a atins limita de ${CHAIN_MAX_LENGTH} capitole`);
    }
    if (ancestry.some((c) => c.authorId === me)) {
      throw forbidden('already_in_chain', 'Esti deja autor in acest lant');
    }

    // Limita zilnica combinata: o singura contributie pe zi (originala SAU extensie).
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayCount = await prisma.story.count({
      where: { authorId: me, createdAt: { gte: startOfDay } },
    });
    if (todayCount >= 1) {
      throw conflict(
        'daily_limit',
        'Ai creat sau continuat deja o poveste azi. Mai poti maine!',
      );
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: me } });

    const cacheKey = `story:extend:${me}:${storyId}`;
    const history = await loadChatHistory(cacheKey);
    const userTurn = { role: 'user' as const, content: message };

    // Profil copil (acelasi pattern ca la create).
    const [profileExt, predictionExt] = await Promise.all([
      getChildProfileSnapshot(me),
      predictNextRootDomain(me).catch(() => null),
    ]);
    const childCtxExt = {
      topDomains: profileExt.topDomains,
      topSkills: profileExt.topSkills,
      predictedNextDomain: predictionExt?.name ?? null,
    };

    const completion = await claudeMessages({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: storyExtendSystemPrompt(
        user.name,
        ancestry.map((c) => ({ authorName: c.authorName, body: c.body })),
        childCtxExt,
      ),
      messages: [...history, userTurn].map((t) => ({ role: t.role, content: t.content })),
    }, 'story_extend');

    const replyText = completion.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (!replyText) throw serverError('ai_empty', 'AI-ul nu a raspuns');

    const json = extractJsonBlock(replyText);

    if (json && isStoryExtendDraft(json)) {
      // Final — creeaza extensia + TTS + XP. chainRootId mostenit (sau fallback la
      // story.id pt rare cazuri legacy in care n-a fost backfill-uit).
      const chainRootId = story.chainRootId ?? story.id;

      const newStory = await prisma.story.create({
        data: {
          authorId: me,
          title: story.title, // mostenim titlul lantului — UX-ul afiseaza autorul per capitol
          body: json.body,
          keyFacts: json.keyFacts as unknown as object,
          parentStoryId: story.id,
          chainRootId,
        },
      });
      await clearChatHistory(cacheKey);

      let bodyAudioUrl: string | null = null;
      let ttsProvider: string | null = null;
      let ttsError: string | null = null;
      try {
        const tts = await ttsNarrator(json.body);
        bodyAudioUrl = tts.urlPath;
        ttsProvider = tts.provider;
        await prisma.story.update({
          where: { id: newStory.id },
          data: { audioUrl: tts.urlPath, audioProvider: tts.provider },
        });
      } catch (err) {
        req.log.error({ err }, 'tts.story_extend_failed');
        ttsError = err instanceof Error ? err.message : String(err);
      }

      // XP pentru autorul extensiei (CO_CREATION = 80). sourceId-ul e id-ul
      // noii povesti — unique per extensie, idempotent.
      const xpExtender = await awardXp(
        me,
        XP_REWARDS.CO_CREATION,
        'story_extension',
        newStory.id,
        'Continuare poveste',
      );

      // Skills pe extensie — extending = continuare creativa, e poveste noua
      // plus empatie pt cel ce a ascultat prima poveste.
      await awardSkillsForEvent(
        me,
        'story_extension',
        newStory.id,
        SKILL_REWARDS.STORY_CHAIN_EXTENDED,
        'Continuare poveste',
      );

      // Bonus retroactiv la atingerea pragului de lant lung. Idempotent pe
      // (userId, "story_chain_4plus", chainRootId): daca pragul a mai fost atins
      // anterior cu o alta ramura din arbore, awardXp returneaza alreadyAwarded.
      const totalChainLength = ancestry.length + 1;
      let chainBonusAwarded = false;
      if (totalChainLength >= CHAIN_BONUS_THRESHOLD) {
        const chainAuthorIds = [...new Set([...ancestry.map((c) => c.authorId), me])];
        await Promise.all(
          chainAuthorIds.map((uid) =>
            awardXp(uid, CHAIN_BONUS_XP, 'story_chain_4plus', chainRootId, 'Bonus lant 4+'),
          ),
        );
        chainBonusAwarded = true;
      }

      res.status(201).json({
        finalStory: {
          id: newStory.id,
          title: newStory.title,
          body: newStory.body,
          parentStoryId: newStory.parentStoryId,
          chainRootId: newStory.chainRootId,
          chainLength: totalChainLength,
          bodyAudioUrl,
          ttsProvider,
          ttsError,
        },
        xp: { extender: xpExtender, chainBonusAwarded },
      });
      return;
    }

    await appendChatTurn(cacheKey, userTurn);
    await appendChatTurn(cacheKey, { role: 'assistant', content: replyText });

    let replyAudioUrl: string | null = null;
    try {
      const tts = await ttsNarrator(replyText);
      replyAudioUrl = tts.urlPath;
    } catch (err) {
      req.log.error({ err }, 'tts.extend_reply_failed');
    }

    res.json({ reply: replyText, replyAudioUrl });
  } catch (e) {
    next(e);
  }
});

// GET /stories/:storyId/chain — lantul ordonat root → leaf cu autor + body +
// audio per capitol. Acces:
//   - oricine e autor in lant, SAU
//   - oricine are claim VERIFIED pe orice capitol din lant.
// Refuzam in tacere alte useri (404 vs 403 — ascundem existenta).
storiesRouter.get('/:storyId/chain', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { storyId } = req.params;
    if (!storyId) throw badRequest('missing_id', 'storyId lipsa');

    const target = await prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, chainRootId: true },
    });
    if (!target) throw notFound('story_not_found', 'Povestea nu exista');

    const chainRootId = target.chainRootId ?? target.id;

    // Toate capitolele lantului. Scoatem keyFacts — nu se expun (un autor din
    // lant le-ar folosi sa cheat-uiasca un viitor verify pe un alt capitol).
    const all = await prisma.story.findMany({
      where: { chainRootId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        authorId: true,
        body: true,
        audioUrl: true,
        audioProvider: true,
        parentStoryId: true,
        createdAt: true,
        title: true,
        author: {
          select: { id: true, name: true, avatar: { select: { svg: true } } },
        },
      },
    });

    // Construieste lantul liniar de la storyId catre root (acelasi loadAncestry
    // dar pe dataset-ul deja in memorie, fara extra round-trip-uri).
    const byId = new Map(all.map((s) => [s.id, s]));
    const ordered: typeof all = [];
    let cursor: string | null = storyId;
    for (let i = 0; i < CHAIN_MAX_LENGTH + 1 && cursor; i++) {
      const s = byId.get(cursor);
      if (!s) break;
      ordered.unshift(s);
      cursor = s.parentStoryId;
    }

    // Acces: autor in lant SAU listener cu claim VERIFIED pe vreun capitol.
    const authorIds = new Set(ordered.map((s) => s.authorId));
    let allowed = authorIds.has(me);
    if (!allowed) {
      const verifiedClaim = await prisma.storyClaim.findFirst({
        where: {
          listenerId: me,
          status: 'VERIFIED',
          storyId: { in: ordered.map((s) => s.id) },
        },
        select: { id: true },
      });
      allowed = !!verifiedClaim;
    }
    if (!allowed) throw notFound('story_not_found', 'Povestea nu exista');

    const orderedIds = ordered.map((s) => s.id);
    const [likeCounts, myLikes] = await Promise.all([
      prisma.storyLike.groupBy({
        by: ['storyId'],
        where: { storyId: { in: orderedIds } },
        _count: { _all: true },
      }),
      prisma.storyLike.findMany({
        where: { userId: me, storyId: { in: orderedIds } },
        select: { storyId: true },
      }),
    ]);
    const countByStory = new Map(likeCounts.map((c) => [c.storyId, c._count._all]));
    const likedSet = new Set(myLikes.map((l) => l.storyId));

    res.json({
      chainRootId,
      chainLength: ordered.length,
      chapters: ordered.map((s, i) => ({
        order: i + 1,
        storyId: s.id,
        title: s.title,
        body: s.body,
        audioUrl: s.audioUrl,
        audioProvider: s.audioProvider,
        createdAt: s.createdAt,
        author: {
          id: s.author.id,
          name: s.author.name,
          avatarSvg: s.author.avatar?.svg ?? null,
        },
        isMine: s.authorId === me,
        likeCount: countByStory.get(s.id) ?? 0,
        likedByMe: likedSet.has(s.id) && s.authorId !== me,
      })),
    });
  } catch (e) {
    next(e);
  }
});

// DELETE /stories/:storyId/extend/draft — reset chat-ului de extindere
// (pereche cu DELETE /stories/draft pentru creare).
storiesRouter.delete('/:storyId/extend/draft', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { storyId } = req.params;
    if (!storyId) throw badRequest('missing_id', 'storyId lipsa');
    await clearChatHistory(`story:extend:${me}:${storyId}`);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// POST /stories/:storyId/like — toggle on. Idempotent: re-apel = no-op pe XP
// (sourceId=storyId), si row-ul StoryLike e protejat de unique constraint.
// La primul like: +EXPLICIT_LIKE domain XP (daca avem domainSlug) + curiozitate
// skill XP. Daca povestea n-a fost clasificata inca, primesti skill XP acum si
// domain XP la backfill cand classifier-ul ruleaza la prima verificare.
storiesRouter.post('/:storyId/like', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { storyId } = req.params;
    if (!storyId) throw badRequest('missing_id', 'storyId lipsa');

    const story = await prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, authorId: true, domainSlug: true },
    });
    if (!story) throw notFound('story_not_found', 'Povestea nu exista');

    // Self-like blocat — semnal de preferinta = doar de la listeners. Pe lant
    // un author la el insusi nu spune nimic, si ar polua ML-ul.
    if (story.authorId === me) {
      throw badRequest('cannot_like_own', 'Nu poti aprecia propria poveste');
    }

    // Upsert idempotent — re-apel = exact aceeasi stare.
    const like = await prisma.storyLike.upsert({
      where: { userId_storyId: { userId: me, storyId } },
      create: { userId: me, storyId },
      update: {},
    });

    // Quest progress: doar la primul like (cand row-ul tocmai s-a creat).
    // upsert returneaza acelasi like si la re-apel, deci verificam createdAt.
    const isNew = Date.now() - like.createdAt.getTime() < 5000;
    if (isNew) {
      void bumpQuestProgress(me, 'explicit_like').catch(() => {});
    }

    // Award XP fire-and-forget (idempotent oricum) — nu blocheaza raspunsul.
    void (async () => {
      try {
        await awardSkillsForEvent(
          me,
          'explicit_like',
          storyId,
          SKILL_REWARDS.EXPLICIT_LIKE,
          'Like pe poveste',
        );
        if (story.domainSlug) {
          await awardDomainXp(
            me,
            story.domainSlug,
            DOMAIN_REWARDS.EXPLICIT_LIKE,
            'explicit_like',
            storyId,
            'Like pe poveste',
          );
        }
      } catch (err) {
        req.log.warn({ err, storyId }, 'story.like_award_failed');
      }
    })();

    const likeCount = await prisma.storyLike.count({ where: { storyId } });
    res.json({ liked: true, likeCount, likeId: like.id });
  } catch (e) {
    next(e);
  }
});

// DELETE /stories/:storyId/like — sterge marcajul vizibil. XP-ul ramane in DB
// (sursa de adevar istorica pt ML). Idempotent — delete pe inexistent = ok.
storiesRouter.delete('/:storyId/like', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { storyId } = req.params;
    if (!storyId) throw badRequest('missing_id', 'storyId lipsa');

    await prisma.storyLike
      .delete({ where: { userId_storyId: { userId: me, storyId } } })
      .catch(() => {}); // ignore not-found

    const likeCount = await prisma.storyLike.count({ where: { storyId } });
    res.json({ liked: false, likeCount });
  } catch (e) {
    next(e);
  }
});
