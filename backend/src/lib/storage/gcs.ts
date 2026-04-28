import { Storage } from '@google-cloud/storage';
import { env } from '../../env.js';
import { logger } from '../logger.js';

// Singleton GCS client. Init lazy ca env-vars-urile sa fie optionale: backend-ul
// porneste si fara GCP configurat (rutele /co-creations returneaza 503), useful
// in dev cand inca lucrezi la mobil si n-ai inca service account-ul.
let cached: { storage: Storage; bucketName: string } | null = null;
let initialized = false;

function init(): { storage: Storage; bucketName: string } | null {
  if (initialized) return cached;
  initialized = true;

  if (!env.GCP_PROJECT_ID || !env.GCP_BUCKET) {
    logger.warn('GCS not configured (GCP_PROJECT_ID/GCP_BUCKET missing) — co-creation storage disabled');
    return null;
  }

  // Service account: fie JSON inline (string), fie path la fisier. Daca lipsesc
  // ambele, SDK-ul incearca ADC (Application Default Credentials) — merge in
  // GCE/GKE/Cloud Run, dar nu in Hetzner; deci log warning explicit.
  let credentials: object | undefined;
  let keyFilename: string | undefined;
  if (env.GCP_SERVICE_ACCOUNT_JSON) {
    try {
      credentials = JSON.parse(env.GCP_SERVICE_ACCOUNT_JSON);
    } catch (err) {
      logger.error({ err }, 'GCP_SERVICE_ACCOUNT_JSON is not valid JSON — co-creation storage disabled');
      return null;
    }
  } else if (env.GCP_SERVICE_ACCOUNT_FILE) {
    keyFilename = env.GCP_SERVICE_ACCOUNT_FILE;
  } else {
    logger.warn('No GCP service account provided — falling back to ADC (only works on GCE/Cloud Run)');
  }

  const storage = new Storage({
    projectId: env.GCP_PROJECT_ID,
    ...(credentials ? { credentials } : {}),
    ...(keyFilename ? { keyFilename } : {}),
  });

  cached = { storage, bucketName: env.GCP_BUCKET };
  logger.info({ bucket: env.GCP_BUCKET }, 'GCS initialized');
  return cached;
}

export function isStorageConfigured(): boolean {
  return init() !== null;
}

export async function uploadImage(key: string, buffer: Buffer, contentType: string): Promise<void> {
  const c = init();
  if (!c) throw new Error('GCS not configured');
  const file = c.storage.bucket(c.bucketName).file(key);
  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: { cacheControl: 'private, max-age=3600' },
  });
}

// Signed URL cu TTL — folosit la GET /co-creations/:id si /album. Bucket-ul
// trebuie sa fie privat (uniform bucket-level access OFF sau ON cu IAM strict).
export async function getSignedUrl(key: string, ttlSeconds = 3600): Promise<string> {
  const c = init();
  if (!c) throw new Error('GCS not configured');
  const file = c.storage.bucket(c.bucketName).file(key);
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + ttlSeconds * 1000,
    version: 'v4',
  });
  return url;
}
