import { setTimeout as sleep } from 'node:timers/promises';
import { env } from '../../env.js';
import { logger } from '../logger.js';

// RVC voice conversion via Replicate (zsxkib/realistic-voice-cloning).
// Input: URL public la un MP3 (TTS-ul de baza in romana)
// Output: URL temporar la MP3-ul cu timbrul personajului (Vader, Stitch, etc.)
// Caller-ul (tts.ts) descarca si cache-uieste.

export type RvcParams = {
  // URL public la audio-ul sursa (MP3). Replicate face GET catre acest URL.
  audioUrl: string;
  // URL la .zip cu .pth + .index (HuggingFace, voice-models.com).
  modelZipUrl: string;
  // Semitone shift (-12..+12). Negativ = mai grav.
  pitchShift: number;
};

// Modelul Replicate creeaza folderul /src/rvc_models/<NAME> in care extrage
// zip-ul. NAME = numele fisierului fara ".zip" si fara URL encoding. Daca nu
// pasezi `custom_rvc_model_download_name`, foloseste valoarea lui `rvc_model`
// (care la noi e "CUSTOM" → folder "CUSTOM" inexistent → eroarea pe care am
// vazut-o).
function deriveModelName(zipUrl: string): string {
  const last = zipUrl.split('/').pop() ?? 'CustomModel';
  const decoded = decodeURIComponent(last).replace(/\.zip$/i, '');
  // Fara spatii / caractere ciudate ca sa nu sparga path-ul de pe disc al
  // modelului Replicate (au avut bug-uri pe nume cu paranteze sau spatii).
  return decoded.replace(/[^A-Za-z0-9_-]+/g, '_') || 'CustomModel';
}

// Minim necesar din shape-ul Replicate prediction.
type Prediction = {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output: string | string[] | null;
  error: string | null;
  urls: { get: string; cancel: string };
};

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_MS = 5 * 60 * 1000; // 5 min hard cap (cold start poate fi lent)

export function isRvcConfigured(): boolean {
  return !!env.REPLICATE_API_TOKEN;
}

/**
 * Ruleaza RVC pe Replicate si returneaza URL-ul output-ului (de pe replicate.delivery).
 * Caller-ul trebuie sa-l fetch-uiasca rapid — link-ul expira la cateva ore.
 *
 * Throw daca:
 *  - REPLICATE_API_TOKEN lipseste
 *  - prediction-ul esueaza
 *  - timeout (5 min)
 */
export async function convertVoiceRvc({
  audioUrl,
  modelZipUrl,
  pitchShift,
}: RvcParams): Promise<string> {
  if (!env.REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN lipseste — RVC dezactivat');
  }

  const modelName = deriveModelName(modelZipUrl);

  const startRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Token ${env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: env.REPLICATE_RVC_VERSION,
      input: {
        // Sursa = audio MP3 publicat pe domeniul nostru (TTS-ul de baza).
        song_input: audioUrl,
        // Schema reala (vezi openapi schema): "rvc_model si
        // custom_rvc_model_download_name TREBUIE sa coincida". Daca lipseste
        // download_name, modelul nu descarca zip-ul si esueaza cu
        // "/src/rvc_models/<name> does not exist". Pasam ambele = modelName.
        rvc_model: modelName,
        custom_rvc_model_download_name: modelName,
        custom_rvc_model_download_url: modelZipUrl,
        // ATENTIE: pitch_change e in OCTAVE (1 octava = 12 semitones). NU
        // pasam pitchShift aici — am rupe vocea. Pentru fine-tune in semitones
        // foloseste pitch_change_all (vezi mai jos).
        pitch_change: 0,
        pitch_change_all: pitchShift,
        // Setari blande pt voce vorbita (NU canta). Daca audio-ul de input e
        // deja un MP3 de TTS curat, nu vrem sa amestecam cu vocala / instrumental.
        index_rate: 0.5,
        filter_radius: 3,
        rms_mix_rate: 0.25,
        protect: 0.33,
        pitch_detection_algorithm: 'rmvpe',
        // Fara reverb — adaugi tu manual daca vrei in post.
        reverb_size: 0,
        reverb_wetness: 0,
        reverb_dryness: 0,
      },
    }),
  });

  if (!startRes.ok) {
    const body = await startRes.text().catch(() => '');
    throw new Error(`Replicate start ${startRes.status}: ${body.slice(0, 200)}`);
  }

  let pred = (await startRes.json()) as Prediction;
  logger.info(
    { id: pred.id, status: pred.status, modelZipUrl, modelName, pitchShift },
    'rvc.started',
  );

  const deadline = Date.now() + MAX_POLL_MS;
  while (pred.status === 'starting' || pred.status === 'processing') {
    if (Date.now() > deadline) {
      throw new Error(`RVC timeout (>${MAX_POLL_MS / 1000}s) pe prediction ${pred.id}`);
    }
    await sleep(POLL_INTERVAL_MS);

    const pollRes = await fetch(pred.urls.get, {
      headers: { Authorization: `Token ${env.REPLICATE_API_TOKEN}` },
    });
    if (!pollRes.ok) {
      const body = await pollRes.text().catch(() => '');
      throw new Error(`Replicate poll ${pollRes.status}: ${body.slice(0, 200)}`);
    }
    pred = (await pollRes.json()) as Prediction;
  }

  if (pred.status !== 'succeeded') {
    throw new Error(`RVC ${pred.status}: ${pred.error ?? 'fara detalii'}`);
  }

  // Output e fie string fie array. La RVC-ul asta e string (URL la MP3).
  const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (!out || typeof out !== 'string') {
    throw new Error(`RVC output gol pe prediction ${pred.id}`);
  }

  logger.info({ id: pred.id, output: out }, 'rvc.done');
  return out;
}
