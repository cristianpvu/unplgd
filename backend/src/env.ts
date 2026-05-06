import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  // Secret pt token-ul BLE rotativ zilnic. Folosit la HMAC(userId+date) ca alt
  // user nu poata reidentifica un copil dintr-o zi in alta din advertise-ul BLE.
  BLE_SECRET: z.string().min(16),
  ANTHROPIC_API_KEY: z.string().min(1),
  // Modelul Claude folosit la toate apelurile (chat pet, povesti, verify).
  // Default = opus pentru fidelitate maxima pe roleplay si nuanta. Pt dev/cost
  // poti pune sonnet sau haiku via .env.
  ANTHROPIC_MODEL: z.string().default('claude-opus-4-7'),
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
  // Voice ID ElevenLabs pentru naratorul din joculetul de povesti (independent
  // de pet). Cand lipseste, cade pe ELEVENLABS_VOICE_ID, apoi pe Edge TTS.
  NARRATOR_VOICE_ID: z.string().optional(),
  // Model ElevenLabs — multilingual v2 are calitate top pe romana cu accent.
  ELEVENLABS_MODEL: z.string().default('eleven_multilingual_v2'),
  // GCP — folosit pt co-creatii (storage poze + Vertex AI Imagen). Service
  // account JSON fie ca path la fisier (GOOGLE_APPLICATION_CREDENTIALS-style),
  // fie ca string JSON inline (util in Docker secrets). Daca lipsesc, ruta
  // /co-creations e dezactivata la boot (vezi server.ts).
  GCP_PROJECT_ID: z.string().optional(),
  GCP_BUCKET: z.string().optional(),
  GCP_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GCP_SERVICE_ACCOUNT_FILE: z.string().optional(),
  // Locatie Vertex AI — Imagen 3 e disponibil in us-central1, europe-west4.
  // Default us-central1 (cea mai stabila + cea mai larga acoperire de modele).
  VERTEX_LOCATION: z.string().default('us-central1'),
  IMAGEN_MODEL: z.string().default('imagen-3.0-generate-002'),
  // Replicate API token pentru RVC voice conversion (lib/ai/voiceConvert.ts).
  // Optional — daca lipseste, RVC se ignora si TTS-ul de baza e livrat direct.
  REPLICATE_API_TOKEN: z.string().optional(),
  // Versiunea modelului RVC pe Replicate. zsxkib/realistic-voice-cloning —
  // accepta custom .zip prin URL, ~$0.037/run. Pinned pe versiune ca update-uri
  // breaking sa nu strice productia. Verifica replicate.com/zsxkib/realistic-voice-cloning
  // pentru ultima versiune; tine la zi cand e cazul.
  REPLICATE_RVC_VERSION: z
    .string()
    .default('bbdb9b991f627b94d5fa92f0a3eb4037f224bb79cf56ff46b70afe84ce7bb646'),
  // URL public al backend-ului — folosit ca Replicate sa poata fetch-ui MP3-ul
  // intermediar din /tts-cache/<hash>.mp3 (containerul Docker e in spatele
  // nginx la api-unplgd.dinedroid.com). Daca lipseste, RVC e dezactivat.
  PUBLIC_BASE_URL: z.string().url().optional(),
  // Cheie secreta pentru endpoint-uri admin debug (ex. /admin/ai-usage). Nu e
  // JWT — doar un random string pe care doar tu il stii. Pus in .env, accesezi
  // din browser cu ?key=<secret>. Daca lipseste, endpoint-urile admin sunt
  // dezactivate (raspund 503).
  ADMIN_KEY: z.string().optional(),
  // Mod dev pentru hunt: deblocheaza endpoint-ul /hunt/dev/quick-here care
  // creeaza pe loc o sesiune de test cu parc fictiv la coords date + 3 demo
  // useri + monstri spawn-ati in jurul tau. Pentru testare pe device fara teren.
  // OFF in productie reala — un user obisnuit nu trebuie sa-l vada.
  HUNT_DEV_MODE: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
