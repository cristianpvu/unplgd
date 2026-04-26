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
  // Provider TTS — 'eleven' (calitate naturala, plata) sau 'edge' (gratis,
  // robotic). Daca eleven pica sau lipseste API key, fallback automat la edge.
  TTS_PROVIDER: z.enum(['eleven', 'edge']).default('edge'),
  ELEVENLABS_API_KEY: z.string().optional(),
  // Voice ID din ElevenLabs Voice Library (string opaque). Default global daca
  // pet-urile inca nu au voce proprie per specie.
  ELEVENLABS_VOICE_ID: z.string().optional(),
  // Model ElevenLabs — multilingual v2 are calitate top pe romana cu accent.
  ELEVENLABS_MODEL: z.string().default('eleven_multilingual_v2'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
