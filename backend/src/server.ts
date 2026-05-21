import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinoHttp } from 'pino-http';
import { env } from './env.js';
import { logger } from './lib/logger.js';
import { initIO } from './lib/socket/io.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { meRouter } from './routes/me.js';
import { friendsRouter } from './routes/friends.js';
import { interactionsRouter } from './routes/interactions.js';
import { presenceRouter } from './routes/presence.js';
import { avatarRouter } from './routes/avatar.js';
import { braceletRouter } from './routes/bracelet.js';
import { storiesRouter } from './routes/stories.js';
import { coCreationsRouter } from './routes/coCreations.js';
import { usersRouter } from './routes/users.js';
import { huntRouter } from './routes/hunt.js';
import { petsRouter } from './routes/pets.js';
import { adminRouter } from './routes/admin.js';
import { phoneDownRouter } from './routes/phonedown.js';
import { chestsRouter } from './routes/chests.js';
import { adventureRouter } from './routes/adventure.js';
import { journeyRouter } from './routes/journey.js';
import { errorHandler } from './middleware/error.js';
import { authRateLimit } from './middleware/rateLimit.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';

const app = express();

// Behind nginx reverse proxy - trust X-Forwarded-* so req.ip is the real client IP.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());

const largeJson = express.json({ limit: '6mb' });
app.use((req, res, next) => {
  if (req.method === 'POST' && /^\/co-creations\/[^/]+\/submit$/.test(req.path)) {
    return largeJson(req, res, next);
  }
  return next();
});
app.use(express.json({ limit: '100kb' }));
app.use(pinoHttp({ logger }));

// Cache MP3 TTS — servim static peste /tts-cache. Cream directorul la boot
// ca express.static sa nu eseze daca volumul e gol pe primul start.
mkdirSync(env.TTS_CACHE_DIR, { recursive: true });
app.use('/tts-cache', express.static(env.TTS_CACHE_DIR, { maxAge: '7d', immutable: true }));

// PNG-uri pet species. Comise in repo (backend/public/pets/<slug>.png) ca
// build-ul Docker sa le aiba pe loc, fara volum extern.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const petsImageDir = path.resolve(__dirname, '../public/pets');
mkdirSync(petsImageDir, { recursive: true });
app.use('/pets', express.static(petsImageDir, { maxAge: '30d', immutable: true }));

app.use('/health', healthRouter);
app.use('/auth', authRateLimit, authRouter);
app.use('/me', meRouter);
app.use('/friends', friendsRouter);
app.use('/interactions', interactionsRouter);
app.use('/presence', presenceRouter);
app.use(avatarRouter);
app.use(braceletRouter);
app.use('/stories', storiesRouter);
app.use('/co-creations', coCreationsRouter);
app.use('/users', usersRouter);
app.use('/hunt', huntRouter);
app.use('/pets', petsRouter);
app.use('/admin', adminRouter);
app.use('/phonedown', phoneDownRouter);
app.use('/chests', chestsRouter);
app.use('/adventure', adventureRouter);
app.use('/journey', journeyRouter);

app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
app.use(errorHandler);

const server = createServer(app);
initIO(server);
server.listen(env.PORT, () => {
  logger.info(`unplgd backend listening on http://localhost:${env.PORT} (with socket.io)`);
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close();
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
