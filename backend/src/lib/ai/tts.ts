import { createHash } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { env } from '../../env.js';
import { logger } from '../logger.js';

// URL prefix sub care servim cache-ul. Trebuie sa coincida cu app.use() din
// server.ts.
export const TTS_URL_PREFIX = '/tts-cache';

let cacheDirReady: Promise<void> | null = null;
async function ensureCacheDir() {
  if (!cacheDirReady) {
    cacheDirReady = mkdir(env.TTS_CACHE_DIR, { recursive: true }).then(() => undefined);
  }
  return cacheDirReady;
}

function fingerprint(provider: string, text: string, voiceId: string) {
  return createHash('sha256')
    .update(`${provider}::${voiceId}::${text}`)
    .digest('hex')
    .slice(0, 32);
}

async function fileExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sintetizeaza textul si returneaza URL-ul MP3 cache-uit. Dispatcher intre
 * provideri — preferinta `TTS_PROVIDER`, fallback automat la Edge daca pica.
 *
 * `voiceId` e voicea din DB-ul pet-ului (ex: ro-RO-EmilNeural pt Edge). Pt
 * ElevenLabs folosim `ELEVENLABS_VOICE_ID` din env (override global).
 */
export async function synthesizeTts(text: string, voiceId: string): Promise<string> {
  if (
    env.TTS_PROVIDER === 'eleven' &&
    env.ELEVENLABS_API_KEY &&
    env.ELEVENLABS_VOICE_ID
  ) {
    try {
      return await synthesizeEleven(text, env.ELEVENLABS_VOICE_ID);
    } catch (err) {
      logger.warn({ err }, 'tts.eleven_failed_fallback_edge');
      // fall through la Edge ca fallback
    }
  }
  return synthesizeEdge(text, voiceId);
}

async function synthesizeEdge(text: string, voiceId: string): Promise<string> {
  await ensureCacheDir();
  const hash = fingerprint('edge', text, voiceId);
  const filename = `${hash}.mp3`;
  const filePath = join(env.TTS_CACHE_DIR, filename);
  const urlPath = `${TTS_URL_PREFIX}/${filename}`;

  if (await fileExists(filePath)) return urlPath;

  const tts = new MsEdgeTTS();
  await tts.setMetadata(voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text);

  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(filePath);
    audioStream.on('error', reject);
    out.on('error', reject);
    out.on('finish', () => resolve());
    audioStream.pipe(out);
  });

  tts.close();
  logger.info({ voiceId, hash, len: text.length }, 'tts.edge_synthesized');
  return urlPath;
}

async function synthesizeEleven(text: string, voiceId: string): Promise<string> {
  await ensureCacheDir();
  const model = env.ELEVENLABS_MODEL;
  const hash = fingerprint(`eleven:${model}`, text, voiceId);
  const filename = `${hash}.mp3`;
  const filePath = join(env.TTS_CACHE_DIR, filename);
  const urlPath = `${TTS_URL_PREFIX}/${filename}`;

  if (await fileExists(filePath)) return urlPath;

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_22050_32`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': env.ELEVENLABS_API_KEY!,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: model,
      // Setari echilibrate pt povestit copii: voce stabila, expresivitate
      // moderata, fara exagerare. Tweak-uim cand alegem voce finala.
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.8,
        style: 0.15,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`elevenlabs ${res.status}: ${body.slice(0, 200)}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(filePath, buf);

  logger.info(
    { voiceId, model, hash, len: text.length, bytes: buf.length },
    'tts.eleven_synthesized',
  );
  return urlPath;
}
