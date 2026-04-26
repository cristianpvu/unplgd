import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  ANTHROPIC_API_KEY: z.string().min(1),
  // Modelul Claude folosit la chat-uri (story create/verify). Default = sonnet.
  // Pt dev/loc poti folosi haiku (mai ieftin) prin override in .env.
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),
  // Director cache MP3-uri TTS. Static-served prin Express. In prod sub volum
  // persistent; cleanup-ul se face manual sau prin cron (LRU pe atime).
  TTS_CACHE_DIR: z.string().default('./tts-cache'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
