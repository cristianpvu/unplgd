import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { conflict, notFound } from '../lib/errors.js';

export const braceletRouter = Router();

const provisionSchema = z.object({
  // UID-ul citit de NFCManager — hex string (NTAG213/215 = 14 hex chars). Acceptam
  // orice in [4, 64] ca sa nu legam validarea de un anumit chipset.
  uid: z.string().min(4).max(64).regex(/^[0-9a-fA-F:]+$/, 'UID hex invalid'),
});

braceletRouter.post('/me/bracelet', requireAuth, async (req, res, next) => {
  try {
    const me = req.userId!;
    const { uid } = provisionSchema.parse(req.body);
    const normalizedUid = uid.toLowerCase().replace(/:/g, '');

    // Daca tag-ul e deja revendicat de altcineva, refuzam — vrem 1 bratara = 1
    // user. Re-provisioning de catre acelasi user e ok (suprascrie).
    const existing = await prisma.nfcBracelet.findUnique({ where: { uid: normalizedUid } });
    if (existing && existing.userId !== me) {
      throw conflict('bracelet_taken', 'Bratara e deja inregistrata pe alt cont');
    }

    const bracelet = await prisma.nfcBracelet.upsert({
      where: { userId: me },
      create: { userId: me, uid: normalizedUid },
      update: { uid: normalizedUid, provisionedAt: new Date() },
    });

    res.status(201).json(bracelet);
  } catch (e) {
    next(e);
  }
});

braceletRouter.get('/me/bracelet', requireAuth, async (req, res, next) => {
  try {
    const bracelet = await prisma.nfcBracelet.findUnique({
      where: { userId: req.userId! },
    });
    if (!bracelet) throw notFound('bracelet_not_found', 'Nicio bratara legata');
    res.json(bracelet);
  } catch (e) {
    next(e);
  }
});

braceletRouter.delete('/me/bracelet', requireAuth, async (req, res, next) => {
  try {
    await prisma.nfcBracelet.deleteMany({ where: { userId: req.userId! } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
