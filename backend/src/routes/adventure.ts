import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, conflict, notFound, serverError } from '../lib/errors.js';
import { ensureDefaultPet } from '../lib/pet.js';
import { bondXpToLevel, awardBondXp, BOND_REWARDS } from '../lib/pet/bond.js';
import { resolveBackgroundAssets } from '../lib/petImage.js';
import {
  generateStoryArc,
  type StoryArc,
  type StoryPet,
  type StoryWorldConfig,
} from '../lib/ai/storyAdventure.js';
import { logger } from '../lib/logger.js';

export const adventureRouter = Router();
adventureRouter.use(requireAuth);

// Forma progresului stocat pe AdventureRun.progressJson.
type RunProgress = {
  nodeIndex: number; // urmatorul nod de jucat (0..nodeCount)
  nodeAnswers: { nodeId: string; correct: boolean }[];
  bossDefeated: boolean;
};

function emptyProgress(): RunProgress {
  return { nodeIndex: 0, nodeAnswers: [], bossDefeated: false };
}

// Numara victoriile la boss ale user-ului pe o lume (completed runs) — pt
// requiredCompletions la deblocarea fundalurilor pe tier-uri.
async function countWorldCompletions(userId: string, worldSlug: string): Promise<number> {
  return prisma.adventureRun.count({
    where: { userId, worldSlug, status: 'COMPLETED' },
  });
}

// Incarca pet-ul activ al user-ului + specia + numele copilului. Lazy-create
// defensiv.
async function loadActivePet(userId: string) {
  await ensureDefaultPet(userId);
  return prisma.pet.findUniqueOrThrow({
    where: { userId },
    include: { species: true, user: { select: { name: true } } },
  });
}

// GET /adventure/worlds
// Lumile disponibile pentru specia pet-ului activ + status (completions +
// fundaluri deblocate). Data-driven: filtram pe speciesSlug.
adventureRouter.get('/worlds', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const pet = await loadActivePet(userId);

    const worlds = await prisma.adventureWorld.findMany({
      where: { speciesSlug: pet.species.slug, active: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        backgrounds: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
      },
    });

    const [completionsByWorld, unlocks, inProgressRuns] = await Promise.all([
      prisma.adventureRun.groupBy({
        by: ['worldSlug'],
        where: { userId, status: 'COMPLETED' },
        _count: { _all: true },
      }),
      prisma.userBackground.findMany({ where: { userId }, select: { backgroundKey: true } }),
      prisma.adventureRun.findMany({
        where: { userId, status: 'IN_PROGRESS' },
        select: { id: true, worldSlug: true },
      }),
    ]);

    const completionMap = new Map(completionsByWorld.map((c) => [c.worldSlug, c._count._all]));
    const unlockedKeys = new Set(unlocks.map((u) => u.backgroundKey));
    const inProgressMap = new Map(inProgressRuns.map((r) => [r.worldSlug, r.id]));

    res.json({
      pet: { name: pet.name, speciesName: pet.species.name },
      worlds: worlds.map((w) => ({
        slug: w.slug,
        name: w.name,
        lore: w.lore,
        domain: w.domain,
        bossName: w.bossName,
        nodeCount: w.nodeCount,
        accentColor: w.accentColor,
        bgColor: w.bgColor,
        obstacleStyle: w.obstacleStyle,
        completions: completionMap.get(w.slug) ?? 0,
        activeRunId: inProgressMap.get(w.slug) ?? null,
        backgrounds: w.backgrounds.map((b) => ({
          key: b.key,
          name: b.name,
          imageUrl: b.imageUrl,
          tier: b.tier,
          requiredCompletions: b.requiredCompletions,
          unlocked: unlockedKeys.has(b.key),
        })),
      })),
    });
  } catch (e) {
    next(e);
  }
});

// Serializare client-safe a arcului: ASCUNDE correctIndex + fact ca sa nu
// poata fi citite din payload. Validarea raspunsului se face server-side.
function publicArc(arc: StoryArc) {
  return {
    intro: arc.intro,
    outro: arc.outro,
    nodes: arc.nodes.map((n) => ({
      id: n.id,
      narrative: n.narrative,
      obstacle: {
        prompt: n.obstacle.prompt,
        options: n.obstacle.options,
      },
    })),
    boss: {
      intro: arc.boss.intro,
      victoryLine: arc.boss.victoryLine,
      questions: arc.boss.questions.map((q, i) => ({
        id: `b${i}`,
        prompt: q.prompt,
        options: q.options,
        recapNodeIndex: q.recapNodeIndex,
      })),
    },
  };
}

function runDto(
  run: { id: string; worldSlug: string; status: string; contentJson: unknown; progressJson: unknown },
) {
  return {
    runId: run.id,
    worldSlug: run.worldSlug,
    status: run.status,
    progress: (run.progressJson as RunProgress) ?? emptyProgress(),
    arc: publicArc(run.contentJson as StoryArc),
  };
}

// POST /adventure/worlds/:slug/run
// Porneste un run nou SAU reia cel in progres. Genereaza continutul AI o data
// si il cache-uieste pe run. Re-apel cand exista run IN_PROGRESS = returneaza
// acelasi continut (nu regenereaza, nu pierzi progresul).
adventureRouter.post('/worlds/:slug/run', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { slug } = req.params;
    if (!slug) throw badRequest('missing_slug', 'worldSlug lipsa');

    const world = await prisma.adventureWorld.findUnique({ where: { slug } });
    if (!world || !world.active) throw notFound('world_not_found', 'Lume inexistenta');

    const pet = await loadActivePet(userId);
    if (pet.species.slug !== world.speciesSlug) {
      throw conflict('wrong_species', 'Lumea apartine altei specii de pet');
    }

    // Reia run-ul in progres daca exista.
    const existing = await prisma.adventureRun.findFirst({
      where: { userId, worldSlug: slug, status: 'IN_PROGRESS' },
    });
    if (existing) {
      res.json(runDto(existing));
      return;
    }

    // Genereaza arc nou.
    const storyPet: StoryPet = {
      petName: pet.name,
      speciesName: pet.species.name,
      systemHint: pet.species.systemHint,
      tone: pet.species.tone,
      catchphrases: pet.species.catchphrases,
      childName: pet.user.name,
      bondLevel: bondXpToLevel(pet.bondXp),
    };
    const worldConfig: StoryWorldConfig = {
      name: world.name,
      lore: world.lore,
      domain: world.domain,
      bossName: world.bossName,
      bossLore: world.bossLore,
      nodeCount: world.nodeCount,
      obstacleStyle: world.obstacleStyle,
    };

    let arc: StoryArc;
    try {
      arc = await generateStoryArc(storyPet, worldConfig);
    } catch (err) {
      logger.error({ err: String(err), slug }, 'adventure.generate_failed');
      throw serverError('generation_failed', 'Nu am putut crea aventura, incearca din nou');
    }

    const run = await prisma.adventureRun.create({
      data: {
        userId,
        worldSlug: slug,
        status: 'IN_PROGRESS',
        contentJson: arc as object,
        progressJson: emptyProgress() as object,
      },
    });

    res.json(runDto(run));
  } catch (e) {
    next(e);
  }
});

// POST /adventure/runs/:id/node/:nodeIndex/answer
// Valideaza raspunsul la obstacolul unui nod. Returneaza correct + liniile
// pet-ului (success/fail) + faptul. Salveaza progresul. Idempotent pe nod —
// re-answer la acelasi nod cu acelasi rezultat nu strica nimic.
const answerSchema = z.object({ optionIndex: z.number().int().min(0).max(10) });

adventureRouter.post('/runs/:id/node/:nodeIndex/answer', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { id, nodeIndex } = req.params;
    const idx = Number(nodeIndex);
    if (!id || Number.isNaN(idx)) throw badRequest('bad_params', 'parametri invalizi');
    const { optionIndex } = answerSchema.parse(req.body);

    const run = await prisma.adventureRun.findUnique({ where: { id } });
    if (!run || run.userId !== userId) throw notFound('run_not_found', 'Run inexistent');
    if (run.status !== 'IN_PROGRESS') throw conflict('run_closed', 'Aventura s-a incheiat');

    const arc = run.contentJson as StoryArc;
    const node = arc.nodes[idx];
    if (!node) throw badRequest('bad_node', 'Nod inexistent');

    const correct = optionIndex === node.obstacle.correctIndex;

    const progress = (run.progressJson as RunProgress) ?? emptyProgress();
    // Inregistreaza raspunsul (suprascrie daca re-answer).
    const filtered = progress.nodeAnswers.filter((a) => a.nodeId !== node.id);
    filtered.push({ nodeId: node.id, correct });
    const newProgress: RunProgress = {
      ...progress,
      nodeAnswers: filtered,
      // Avansam nodeIndex doar la corect (la gresit, copilul reincearca).
      nodeIndex: correct ? Math.max(progress.nodeIndex, idx + 1) : progress.nodeIndex,
    };

    await prisma.adventureRun.update({
      where: { id },
      data: { progressJson: newProgress as object },
    });

    res.json({
      correct,
      line: correct ? node.obstacle.successLine : node.obstacle.failLine,
      fact: node.obstacle.fact,
      correctIndex: node.obstacle.correctIndex,
    });
  } catch (e) {
    next(e);
  }
});

// POST /adventure/runs/:id/boss/answer
// Valideaza un raspuns la o intrebare de boss. Returneaza correct + correctIndex.
const bossAnswerSchema = z.object({
  questionIndex: z.number().int().min(0).max(50),
  optionIndex: z.number().int().min(0).max(10),
});

adventureRouter.post('/runs/:id/boss/answer', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    if (!id) throw badRequest('missing_id', 'runId lipsa');
    const { questionIndex, optionIndex } = bossAnswerSchema.parse(req.body);

    const run = await prisma.adventureRun.findUnique({ where: { id } });
    if (!run || run.userId !== userId) throw notFound('run_not_found', 'Run inexistent');
    if (run.status !== 'IN_PROGRESS') throw conflict('run_closed', 'Aventura s-a incheiat');

    const arc = run.contentJson as StoryArc;
    const q = arc.boss.questions[questionIndex];
    if (!q) throw badRequest('bad_question', 'Intrebare boss inexistenta');

    const correct = optionIndex === q.correctIndex;
    res.json({ correct, correctIndex: q.correctIndex });
  } catch (e) {
    next(e);
  }
});

// POST /adventure/runs/:id/complete
// Finalizeaza run-ul dupa ce boss-ul e invins. Marcheaza COMPLETED, acorda bond
// xp, deblocheaza fundalurile a caror requiredCompletions e atins. Idempotent:
// un run deja COMPLETED returneaza recompensele fara dublare.
adventureRouter.post('/runs/:id/complete', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    if (!id) throw badRequest('missing_id', 'runId lipsa');

    const run = await prisma.adventureRun.findUnique({ where: { id } });
    if (!run || run.userId !== userId) throw notFound('run_not_found', 'Run inexistent');

    const alreadyDone = run.status === 'COMPLETED';
    if (!alreadyDone) {
      const progress = (run.progressJson as RunProgress) ?? emptyProgress();
      await prisma.adventureRun.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          progressJson: { ...progress, bossDefeated: true } as object,
        },
      });
    }

    // Acorda bond xp la pet-ul activ (idempotent pe runId).
    const pet = await prisma.pet.findUnique({ where: { userId } });
    if (pet) {
      await awardBondXp(
        pet.id,
        BOND_REWARDS.ADVENTURE_COMPLETE,
        'adventure',
        run.id,
        `Aventura ${run.worldSlug} completata`,
      );
    }

    // Deblocheaza fundalurile eligibile (requiredCompletions <= completions).
    const completions = await countWorldCompletions(userId, run.worldSlug);
    const backgrounds = await prisma.profileBackground.findMany({
      where: { worldSlug: run.worldSlug, active: true },
    });
    const eligible = backgrounds.filter((b) => b.requiredCompletions <= completions);

    const newlyUnlocked: string[] = [];
    for (const bg of eligible) {
      try {
        await prisma.userBackground.create({
          data: { userId, backgroundKey: bg.key },
        });
        newlyUnlocked.push(bg.key);
      } catch (err: any) {
        // P2002 = deja deblocat, skip.
        if (err?.code !== 'P2002') throw err;
      }
    }

    const unlockedBackgrounds = backgrounds
      .filter((b) => eligible.some((e) => e.key === b.key))
      .map((b) => ({
        key: b.key,
        name: b.name,
        imageUrl: b.imageUrl,
        tier: b.tier,
        isNew: newlyUnlocked.includes(b.key),
      }));

    res.json({
      worldSlug: run.worldSlug,
      completions,
      bondAwarded: alreadyDone ? 0 : BOND_REWARDS.ADVENTURE_COMPLETE,
      unlockedBackgrounds,
    });
  } catch (e) {
    next(e);
  }
});

// GET /adventure/backgrounds
// Toate fundalurile deblocate de user + cel selectat curent.
adventureRouter.get('/backgrounds', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const [unlocks, user] = await Promise.all([
      prisma.userBackground.findMany({
        where: { userId },
        include: { background: true },
        orderBy: { unlockedAt: 'desc' },
      }),
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { selectedBackgroundKey: true },
      }),
    ]);

    const activeUnlocks = unlocks.filter((u) => u.background.active);
    // Rezolva imageUrl + videoUrl in paralel pe toata lista (signed URLs cand
    // valoarea din DB e o cheie GCS, altfel URL pasat ca atare).
    const resolvedAssets = await Promise.all(
      activeUnlocks.map((u) => resolveBackgroundAssets(u.background)),
    );

    res.json({
      selectedKey: user.selectedBackgroundKey,
      backgrounds: activeUnlocks.map((u, i) => ({
        key: u.background.key,
        name: u.background.name,
        imageUrl: resolvedAssets[i].imageUrl,
        videoUrl: resolvedAssets[i].videoUrl,
        tier: u.background.tier,
        worldSlug: u.background.worldSlug,
      })),
    });
  } catch (e) {
    next(e);
  }
});

// POST /adventure/backgrounds/select
// Seteaza fundalul de profil. Trebuie sa fie deblocat. `key=null` reseteaza la
// default.
const selectSchema = z.object({ key: z.string().nullable() });

adventureRouter.post('/backgrounds/select', async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { key } = selectSchema.parse(req.body);

    if (key !== null) {
      const owned = await prisma.userBackground.findUnique({
        where: { userId_backgroundKey: { userId, backgroundKey: key } },
      });
      if (!owned) throw badRequest('not_unlocked', 'Fundalul nu e deblocat');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { selectedBackgroundKey: key },
    });

    res.json({ selectedKey: key });
  } catch (e) {
    next(e);
  }
});
