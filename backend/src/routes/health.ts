import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const checks = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    redis.ping(),
  ]);

  const db = checks[0].status === 'fulfilled';
  const cache = checks[1].status === 'fulfilled';

  res.status(db && cache ? 200 : 503).json({
    ok: db && cache,
    db,
    redis: cache,
    uptime: process.uptime(),
  });
});
