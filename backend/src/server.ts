import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { mkdirSync } from 'node:fs';
import { pinoHttp } from 'pino-http';
import { env } from './env.js';
import { logger } from './lib/logger.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { meRouter } from './routes/me.js';
import { friendsRouter } from './routes/friends.js';
import { interactionsRouter } from './routes/interactions.js';
import { avatarRouter } from './routes/avatar.js';
import { braceletRouter } from './routes/bracelet.js';
import { storiesRouter } from './routes/stories.js';
import { coCreationsRouter } from './routes/coCreations.js';
import { errorHandler } from './middleware/error.js';
import { authRateLimit } from './middleware/rateLimit.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';

const app = express();

// Behind nginx reverse proxy - trust X-Forwarded-* so req.ip is the real client IP.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(pinoHttp({ logger }));

// Cache MP3 TTS — servim static peste /tts-cache. Cream directorul la boot
// ca express.static sa nu eseze daca volumul e gol pe primul start.
mkdirSync(env.TTS_CACHE_DIR, { recursive: true });
app.use('/tts-cache', express.static(env.TTS_CACHE_DIR, { maxAge: '7d', immutable: true }));

app.use('/health', healthRouter);
app.use('/auth', authRateLimit, authRouter);
app.use('/me', meRouter);
app.use('/friends', friendsRouter);
app.use('/interactions', interactionsRouter);
app.use(avatarRouter);
app.use(braceletRouter);
app.use('/stories', storiesRouter);
app.use('/co-creations', coCreationsRouter);

app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  logger.info(`unplgd backend listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close();
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
