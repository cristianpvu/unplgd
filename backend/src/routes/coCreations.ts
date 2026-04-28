import { Router, json as expressJson } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { isStorageConfigured, uploadImage, getSignedUrl } from '../lib/storage/gcs.js';
import {
  validateCoCreation,
  type ImageMediaType,
} from '../lib/ai/cocreationValidator.js';
import { generateIllustration, isImagenConfigured } from '../lib/ai/imagen.js';
import { awardXp, XP_REWARDS } from '../lib/xp.js';

export const coCreationsRouter = Router();
coCreationsRouter.use(requireAuth);

const SESSION_TTL_MIN = 30;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

// Body limit ridicat doar pe acest router (default global e 100kb). Pozele
// sunt in base64 ~33% bloat fata de raw → 4mb leeway pt 3mb raw.
const submitJson = expressJson({ limit: '5mb' });

const startSchema = z.object({
  friendId: z.string().min(1),
  storyId: z.string().min(1),
});

const submitSchema = z.object({
  image: z.string().min(100), // base64, fara prefix data:
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

// Returneaza true daca cei doi useri au prietenie ACCEPTED.
async function areFriends(a: string, b: string): Promise<boolean> {
  const f = await prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: a, receiverId: b },
        { requesterId: b, receiverId: a },
      ],
    },
    select: { id: true },
  });
  return !!f;
}

type SerializedCoCreation = {
  id: string;
  status: string;
  startedAt: Date;
  expiresAt: Date;
  submittedAt: Date | null;
  originalImageUrl: string | null;
  aiImageUrl: string | null;
  aiValid: boolean | null;
  aiFeedback: string | null;
  story: { id: string; title: string; body: string };
  participants: { id: string; name: string }[];
};

async function serialize(cocId: string, userId: string): Promise<SerializedCoCreation> {
  const c = await prisma.coCreation.findUnique({
    where: { id: cocId },
    include: {
      story: { select: { id: true, title: true, body: true } },
      userA: { select: { id: true, name: true } },
      userB: { select: { id: true, name: true } },
    },
  });
  if (!c) throw notFound('cocreation_not_found', 'Sesiune inexistenta');
  if (c.userAId !== userId && c.userBId !== userId) {
    throw forbidden('not_yours', 'Nu esti parte din sesiune');
  }

  const [originalImageUrl, aiImageUrl] = await Promise.all([
    c.originalImageKey ? getSignedUrl(c.originalImageKey).catch(() => null) : Promise.resolve(null),
    c.aiImageKey ? getSignedUrl(c.aiImageKey).catch(() => null) : Promise.resolve(null),
  ]);

  return {
    id: c.id,
    status: c.status,
    startedAt: c.startedAt,
    expiresAt: c.expiresAt,
    submittedAt: c.submittedAt,
    originalImageUrl,
    aiImageUrl,
    aiValid: c.aiValid,
    aiFeedback: c.aiFeedback,
    story: c.story,
    participants: [c.userA, c.userB],
  };
}

// Pipeline async dupa /submit: valideaza cu Claude, daca trece genereaza
// imagine cu Imagen, upload, marcheaza COMPLETED, acorda XP. Toate erorile sunt
// inghitite in log — sesiunea e marcata FAILED in DB ca user-ul sa stie.
async function runValidationPipeline(cocId: string, imageBase64: string, mimeType: ImageMediaType) {
  try {
    const c = await prisma.coCreation.findUniqueOrThrow({
      where: { id: cocId },
      include: { story: true },
    });

    const validation = await validateCoCreation(
      imageBase64,
      mimeType,
      c.story.title,
      c.story.body,
    );

    if (!validation.valid) {
      await prisma.coCreation.update({
        where: { id: cocId },
        data: {
          status: 'REJECTED',
          aiValid: false,
          aiFeedback: validation.reason,
        },
      });
      return;
    }

    // Genereaza ilustratia digitala
    const generated = await generateIllustration(validation.scenePrompt);
    const aiKey = `ai-${cocId}.${generated.mimeType === 'image/jpeg' ? 'jpg' : 'png'}`;
    await uploadImage(aiKey, generated.buffer, generated.mimeType);

    await prisma.coCreation.update({
      where: { id: cocId },
      data: {
        status: 'COMPLETED',
        aiValid: true,
        aiFeedback: validation.reason,
        aiImageKey: aiKey,
      },
    });

    // XP idempotent pt amandoi (key unic = sourceType+sourceId per user)
    await Promise.all([
      awardXp(c.userAId, XP_REWARDS.CO_CREATION, 'co_creation', cocId, 'Co-creatie validata'),
      awardXp(c.userBId, XP_REWARDS.CO_CREATION, 'co_creation', cocId, 'Co-creatie validata'),
    ]);
  } catch (err) {
    logger.error({ err, cocId }, 'cocreation.pipeline_failed');
    await prisma.coCreation
      .update({
        where: { id: cocId },
        data: {
          status: 'FAILED',
          aiFeedback: err instanceof Error ? err.message.slice(0, 500) : String(err),
        },
      })
      .catch((updateErr) => logger.error({ err: updateErr, cocId }, 'cocreation.failed_status_update_failed'));
  }
}

// POST /co-creations/start — A scaneaza NFC pe B, alege poveste comuna.
coCreationsRouter.post('/start', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { friendId, storyId } = startSchema.parse(req.body);

    if (friendId === me) throw badRequest('self_friend', 'Nu poti porni cu tine');

    if (!(await areFriends(me, friendId))) {
      throw forbidden('not_friends', 'Trebuie sa fiti prieteni acceptati');
    }

    // Story trebuie sa apartina unuia dintre ei (poveste comuna = a unuia
    // dintre cei doi copii, alta varianta nu are sens narativ).
    const story = await prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, authorId: true, title: true, body: true },
    });
    if (!story) throw notFound('story_not_found', 'Povestea nu exista');
    if (story.authorId !== me && story.authorId !== friendId) {
      throw forbidden('story_not_owned', 'Povestea trebuie sa fie a unuia dintre voi');
    }

    // Inchide automat sesiunile expirate ale user-ului (housekeeping inline)
    await prisma.coCreation.updateMany({
      where: {
        OR: [{ userAId: me }, { userBId: me }],
        status: 'ACTIVE',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });

    // 1 sesiune ACTIVE per user. Daca exista deja una, returneaza-o (idempotent
    // contra dublu-tap NFC) DOAR daca e cu acelasi prieten + aceeasi poveste.
    // Altfel, conflict — user-ul trebuie sa anuleze sesiunea curenta intai.
    const existing = await prisma.coCreation.findFirst({
      where: {
        OR: [{ userAId: me }, { userBId: me }],
        status: 'ACTIVE',
      },
    });
    if (existing) {
      const matchSamePair =
        (existing.userAId === me && existing.userBId === friendId) ||
        (existing.userBId === me && existing.userAId === friendId);
      if (matchSamePair && existing.storyId === storyId) {
        res.json(await serialize(existing.id, me));
        return;
      }
      throw conflict('active_session', 'Ai deja o sesiune activa — finalizeaz-o sau asteapta sa expire');
    }

    const expiresAt = new Date(Date.now() + SESSION_TTL_MIN * 60 * 1000);
    const created = await prisma.coCreation.create({
      data: {
        userAId: me,
        userBId: friendId,
        storyId,
        expiresAt,
      },
    });

    res.status(201).json(await serialize(created.id, me));
  } catch (e) {
    next(e);
  }
});

// POST /co-creations/:id/submit — body { image (base64), mimeType }.
// Returneaza imediat 202 PROCESSING; mobile face polling pe GET.
coCreationsRouter.post('/:id/submit', submitJson, async (req, res, next) => {
  try {
    const me = req.userId!;
    const { id } = req.params;
    if (!id) throw badRequest('missing_id', 'cocreationId lipsa');

    if (!isStorageConfigured() || !isImagenConfigured()) {
      throw badRequest('storage_not_configured', 'Serviciul de storage/AI nu e configurat');
    }

    const { image, mimeType } = submitSchema.parse(req.body);

    // Validare dimensiune base64 → bytes raw aproximativ (3/4 din lungime)
    const approxBytes = Math.floor((image.length * 3) / 4);
    if (approxBytes > MAX_IMAGE_BYTES) {
      throw badRequest('image_too_large', `Poza prea mare (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB)`);
    }

    const c = await prisma.coCreation.findUnique({ where: { id } });
    if (!c) throw notFound('cocreation_not_found', 'Sesiune inexistenta');
    if (c.userAId !== me && c.userBId !== me) {
      throw forbidden('not_yours', 'Nu esti parte din sesiune');
    }
    if (c.status !== 'ACTIVE') {
      throw conflict('not_active', `Sesiune in status ${c.status}, nu mai accepta submit`);
    }
    if (c.expiresAt.getTime() < Date.now()) {
      await prisma.coCreation.update({
        where: { id },
        data: { status: 'EXPIRED' },
      });
      throw conflict('expired', 'Sesiunea a expirat');
    }

    // Upload poza originala intai — daca pica, lasam ACTIVE sa poata re-incerca
    const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
    const originalKey = `original-${id}.${ext}`;
    const buf = Buffer.from(image, 'base64');
    await uploadImage(originalKey, buf, mimeType);

    // Marcheaza PROCESSING + porneste pipeline async (fire-and-forget)
    await prisma.coCreation.update({
      where: { id },
      data: {
        status: 'PROCESSING',
        originalImageKey: originalKey,
        submittedById: me,
        submittedAt: new Date(),
      },
    });

    void runValidationPipeline(id, image, mimeType);

    res.status(202).json(await serialize(id, me));
  } catch (e) {
    next(e);
  }
});

// GET /co-creations/active — sesiunea ACTIVE curenta a user-ului (sau null).
// Definit INAINTE de GET /:id altfel `/active` matcheaza ca id.
coCreationsRouter.get('/active', async (req, res, next) => {
  try {
    const me = req.userId!;
    // Marcheaza expirate inainte de query
    await prisma.coCreation.updateMany({
      where: {
        OR: [{ userAId: me }, { userBId: me }],
        status: 'ACTIVE',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });
    const c = await prisma.coCreation.findFirst({
      where: {
        OR: [{ userAId: me }, { userBId: me }],
        status: { in: ['ACTIVE', 'PROCESSING'] },
      },
      orderBy: { startedAt: 'desc' },
    });
    if (!c) {
      res.json({ active: null });
      return;
    }
    res.json({ active: await serialize(c.id, me) });
  } catch (e) {
    next(e);
  }
});

// GET /co-creations/album — albumul user-ului (toate co-creatiile COMPLETED).
// Definit INAINTE de GET /:id altfel `/album` matcheaza ca id.
coCreationsRouter.get('/album', async (req, res, next) => {
  try {
    const me = req.userId!;
    const list = await prisma.coCreation.findMany({
      where: {
        status: 'COMPLETED',
        OR: [{ userAId: me }, { userBId: me }],
      },
      orderBy: { submittedAt: 'desc' },
      include: {
        story: { select: { id: true, title: true } },
        userA: { select: { id: true, name: true } },
        userB: { select: { id: true, name: true } },
      },
    });

    const items = await Promise.all(
      list.map(async (c) => {
        const [originalImageUrl, aiImageUrl] = await Promise.all([
          c.originalImageKey ? getSignedUrl(c.originalImageKey).catch(() => null) : null,
          c.aiImageKey ? getSignedUrl(c.aiImageKey).catch(() => null) : null,
        ]);
        return {
          id: c.id,
          submittedAt: c.submittedAt,
          story: c.story,
          participants: [c.userA, c.userB],
          originalImageUrl,
          aiImageUrl,
        };
      }),
    );

    res.json({ items });
  } catch (e) {
    next(e);
  }
});

// GET /co-creations/:id — polling state (PROCESSING → COMPLETED/REJECTED/FAILED).
coCreationsRouter.get('/:id', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { id } = req.params;
    if (!id) throw badRequest('missing_id', 'cocreationId lipsa');
    res.json(await serialize(id, me));
  } catch (e) {
    next(e);
  }
});

// DELETE /co-creations/:id — anuleaza sesiunea ACTIVE (cazuri abandon).
coCreationsRouter.delete('/:id', async (req, res, next) => {
  try {
    const me = req.userId!;
    const { id } = req.params;
    if (!id) throw badRequest('missing_id', 'cocreationId lipsa');

    const c = await prisma.coCreation.findUnique({ where: { id } });
    if (!c) throw notFound('cocreation_not_found', 'Sesiune inexistenta');
    if (c.userAId !== me && c.userBId !== me) {
      throw forbidden('not_yours', 'Nu esti parte din sesiune');
    }
    if (c.status !== 'ACTIVE') {
      throw conflict('not_active', 'Doar sesiuni ACTIVE pot fi anulate');
    }

    await prisma.coCreation.update({
      where: { id },
      data: { status: 'EXPIRED' },
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
