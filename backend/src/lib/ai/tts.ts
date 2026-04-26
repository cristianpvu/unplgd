import { createHash } from 'node:crypto';
import { mkdir, stat } from 'node:fs/promises';
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

function fingerprint(text: string, voiceId: string) {
  return createHash('sha256').update(`${voiceId}::${text}`).digest('hex').slice(0, 32);
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
 * Sintetizeaza textul cu Microsoft Edge TTS, salveaza MP3 in cache si
 * returneaza URL-ul relativ. Idempotent — daca exista deja MP3 pt aceleasi
 * (text, voiceId), il refoloseste instant.
 *
 * Voci suggested: ro-RO-EmilNeural (barbat), ro-RO-AlinaNeural (femeie).
 */
export async function synthesizeTts(text: string, voiceId: string): Promise<string> {
  await ensureCacheDir();

  const hash = fingerprint(text, voiceId);
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
  logger.info({ voiceId, hash, len: text.length }, 'tts.synthesized');

  return urlPath;
}
