import { GoogleAuth } from 'google-auth-library';
import { env } from '../../env.js';
import { logger } from '../logger.js';

// Singleton GoogleAuth — cere access tokens pt API-ul Vertex AI. Acelasi
// service account ca GCS (rolul `Vertex AI User` adaugat in plus pe project).
let auth: GoogleAuth | null = null;
let initialized = false;

function getAuth(): GoogleAuth | null {
  if (initialized) return auth;
  initialized = true;

  if (!env.GCP_PROJECT_ID) {
    logger.warn('Imagen not configured (GCP_PROJECT_ID missing) — image generation disabled');
    return null;
  }

  const opts: ConstructorParameters<typeof GoogleAuth>[0] = {
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  };
  if (env.GCP_SERVICE_ACCOUNT_JSON) {
    try {
      opts.credentials = JSON.parse(env.GCP_SERVICE_ACCOUNT_JSON);
    } catch (err) {
      logger.error({ err }, 'GCP_SERVICE_ACCOUNT_JSON invalid — Imagen disabled');
      return null;
    }
  } else if (env.GCP_SERVICE_ACCOUNT_FILE) {
    opts.keyFilename = env.GCP_SERVICE_ACCOUNT_FILE;
  }

  auth = new GoogleAuth(opts);
  return auth;
}

export function isImagenConfigured(): boolean {
  return getAuth() !== null;
}

type ImagenPrediction = {
  bytesBase64Encoded?: string;
  mimeType?: string;
};

type ImagenResponse = {
  predictions?: ImagenPrediction[];
};

export type GeneratedImage = {
  buffer: Buffer;
  mimeType: string;
};

// Genereaza o ilustratie pe baza unui prompt english. Setari hardcodate pe
// safety maxim si personGeneration='dont_allow' — politica obligatorie pt
// app-ul de copii (cerinta coordonator + COPPA-style hygiene).
export async function generateIllustration(prompt: string): Promise<GeneratedImage> {
  const a = getAuth();
  if (!a) throw new Error('Imagen not configured');

  const url = `https://${env.VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${env.GCP_PROJECT_ID}/locations/${env.VERTEX_LOCATION}/publishers/google/models/${env.IMAGEN_MODEL}:predict`;

  const client = await a.getClient();
  const tokenResponse = await client.getAccessToken();
  const accessToken = tokenResponse.token;
  if (!accessToken) throw new Error('Failed to obtain access token for Vertex AI');

  const body = {
    instances: [{ prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: '1:1',
      safetyFilterLevel: 'block_some',
      personGeneration: 'dont_allow',
      addWatermark: false,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Imagen API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as ImagenResponse;
  const pred = data.predictions?.[0];
  if (!pred?.bytesBase64Encoded) {
    throw new Error('Imagen returned no image data');
  }

  return {
    buffer: Buffer.from(pred.bytesBase64Encoded, 'base64'),
    mimeType: pred.mimeType ?? 'image/png',
  };
}
