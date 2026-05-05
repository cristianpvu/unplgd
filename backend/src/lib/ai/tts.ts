import { createHash } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { env } from '../../env.js';
import { logger } from '../logger.js';
import { convertVoiceRvc, isRvcConfigured } from './voiceConvert.js';

// URL prefix sub care servim cache-ul. Trebuie sa coincida cu app.use() din
// server.ts.
export const TTS_URL_PREFIX = '/tts-cache';

// Boot diagnostic — arata in log-uri exact ce TTS e activ. Util cand env
// var-urile par sa nu ajunga la container (typo, restart lipsa, etc.)
logger.info(
  {
    provider: env.TTS_PROVIDER,
    hasElevenKey: !!env.ELEVENLABS_API_KEY,
    hasElevenVoice: !!env.ELEVENLABS_VOICE_ID,
    elevenModel: env.ELEVENLABS_MODEL,
  },
  'tts.config',
);

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

export type TtsResult = {
  urlPath: string;
  provider: 'eleven' | 'edge';
  // True daca s-a aplicat conversie RVC peste TTS-ul de baza.
  rvcApplied: boolean;
};

// Optional RVC overlay applied dupa TTS-ul de baza. Daca lipseste / nu e
// configurat, se livreaza TTS-ul direct.
export type RvcOverlay = {
  modelZipUrl: string;
  pitchShift: number;
};

export type TtsOptions = {
  // Per-species ElevenLabs voice override. Cand setat → forteaza ElevenLabs
  // chiar daca TTS_PROVIDER=edge (cazul Vader: Edge n-are voce dramatica, dar
  // ElevenLabs are voci comunitare deep). Daca null → cade pe TTS_PROVIDER.
  elevenVoiceId?: string | null;
  // RVC peste TTS (independent de provider). Optional, default off.
  rvc?: RvcOverlay;
};

/**
 * Sintetizeaza textul si returneaza URL-ul MP3 cache-uit + provider-ul folosit.
 *
 * Pipeline:
 *  1. TTS de baza:
 *     - daca `opts.elevenVoiceId` setat → ElevenLabs cu acea voce (overide)
 *     - altfel TTS_PROVIDER (eleven cu env voice, sau edge cu `voiceId`)
 *  2. RVC overlay optional (daca `opts.rvc` setat + Replicate configurat).
 *
 * Cache local pe sha256 — al doilea play al aceluiasi text+voce e gratis.
 */
export async function synthesizeTts(
  text: string,
  voiceId: string,
  opts: TtsOptions = {},
): Promise<TtsResult> {
  // Step 1 — TTS de baza
  let baseUrlPath: string;
  let provider: 'eleven' | 'edge';
  if (opts.elevenVoiceId) {
    if (!env.ELEVENLABS_API_KEY) {
      throw new Error('elevenVoiceId setat pe specie dar ELEVENLABS_API_KEY lipseste in env');
    }
    baseUrlPath = await synthesizeEleven(text, opts.elevenVoiceId);
    provider = 'eleven';
  } else if (env.TTS_PROVIDER === 'eleven') {
    if (!env.ELEVENLABS_API_KEY) {
      throw new Error('TTS_PROVIDER=eleven dar ELEVENLABS_API_KEY lipseste');
    }
    if (!env.ELEVENLABS_VOICE_ID) {
      throw new Error('TTS_PROVIDER=eleven dar ELEVENLABS_VOICE_ID lipseste');
    }
    baseUrlPath = await synthesizeEleven(text, env.ELEVENLABS_VOICE_ID);
    provider = 'eleven';
  } else {
    baseUrlPath = await synthesizeEdge(text, voiceId);
    provider = 'edge';
  }
  const rvc = opts.rvc;

  // Step 2 — RVC overlay (optional). Daca lipsesc preconditii, livram TTS direct.
  if (!rvc) return { urlPath: baseUrlPath, provider, rvcApplied: false };
  if (!isRvcConfigured()) {
    logger.warn(
      { rvcModelUrl: rvc.modelZipUrl },
      'rvc.requested_but_not_configured — livrez TTS direct (REPLICATE_API_TOKEN lipseste)',
    );
    return { urlPath: baseUrlPath, provider, rvcApplied: false };
  }
  if (!env.PUBLIC_BASE_URL) {
    logger.warn(
      'rvc.public_base_url_missing — Replicate nu poate fetch-ui MP3-ul intermediar; livrez TTS direct',
    );
    return { urlPath: baseUrlPath, provider, rvcApplied: false };
  }

  try {
    const rvcUrlPath = await applyRvc(baseUrlPath, provider, voiceId, text, rvc);
    return { urlPath: rvcUrlPath, provider, rvcApplied: true };
  } catch (err) {
    // Fallback: TTS-ul de baza ramane utilizabil daca RVC pica.
    logger.error({ err, rvc }, 'rvc.failed — livrez TTS de baza ca fallback');
    return { urlPath: baseUrlPath, provider, rvcApplied: false };
  }
}

async function applyRvc(
  baseUrlPath: string,
  provider: 'eleven' | 'edge',
  voiceId: string,
  text: string,
  rvc: RvcOverlay,
): Promise<string> {
  await ensureCacheDir();
  const hash = createHash('sha256')
    .update(`rvc::${provider}::${voiceId}::${text}::${rvc.modelZipUrl}::${rvc.pitchShift}`)
    .digest('hex')
    .slice(0, 32);
  const filename = `${hash}.mp3`;
  const filePath = join(env.TTS_CACHE_DIR, filename);
  const urlPath = `${TTS_URL_PREFIX}/${filename}`;

  if (await fileExists(filePath)) return urlPath;

  // Audio-ul de baza trebuie sa fie accesibil PUBLIC pentru ca Replicate sa-l
  // poata fetch-ui. baseUrlPath e relative ("/tts-cache/<hash>.mp3") — il
  // facem absolut prin PUBLIC_BASE_URL.
  const audioUrl = `${env.PUBLIC_BASE_URL}${baseUrlPath}`;

  const replicateOutputUrl = await convertVoiceRvc({
    audioUrl,
    modelZipUrl: rvc.modelZipUrl,
    pitchShift: rvc.pitchShift,
  });

  // Descarcam output-ul Replicate si-l persistam local. Link-ul Replicate
  // expira (cateva ore), cache-ul nostru ramane permanent.
  const dlRes = await fetch(replicateOutputUrl);
  if (!dlRes.ok) {
    throw new Error(`Download RVC output ${dlRes.status}: ${replicateOutputUrl}`);
  }
  const buf = Buffer.from(await dlRes.arrayBuffer());
  await writeFile(filePath, buf);

  logger.info(
    { hash, bytes: buf.length, modelZipUrl: rvc.modelZipUrl, pitchShift: rvc.pitchShift },
    'rvc.cached',
  );
  return urlPath;
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
