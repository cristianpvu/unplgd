import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { notFound } from '../lib/errors.js';

export const meRouter = Router();

meRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) throw notFound('user_not_found', 'User not found');
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      birthDate: user.birthDate,
      xp: user.xp,
      level: user.level,
      createdAt: user.createdAt,
    });
  } catch (e) {
    next(e);
  }
});
