import { prisma } from './prisma.js';
import { logger } from './logger.js';
import { getSignedUrl, isStorageConfigured } from './storage/gcs.js';

// Rezolva `Pet.species.imagePath` la URL utilizabil de mobile. Format suportat:
//  - `https://...` / `http://...` → URL absolut (CDN/extern), pasat ca atare
//  - `/pets/foo.png` → ruta servita static din backend/public/pets/, pasata
//    ca atare; mobile-ul prepend-uieste API_BASE_URL
//  - `gs://<bucket>/<key>` sau `<key>` → key GCS pe bucket-ul privat,
//    generam signed URL cu TTL 1h
//
// Centralizat in fisierul asta ca sa-l refoloseasca pets.ts, friends.ts,
// users.ts, me.ts si cowalkEmit.ts fara duplicare. Daca schimbam politica
// (CDN public, alt TTL, etc.) modificam aici si toata aplicatia urmeaza.
export async function resolvePetImagePath(
  imagePath: string | null,
): Promise<string | null> {
  if (!imagePath) return null;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  if (imagePath.startsWith('/')) return imagePath;

  if (!isStorageConfigured()) {
    logger.warn(
      { imagePath },
      'pet imagePath looks like GCS key but storage not configured',
    );
    return null;
  }

  const key = imagePath.startsWith('gs://')
    ? imagePath.replace(/^gs:\/\/[^/]+\//, '')
    : imagePath;
  try {
    return await getSignedUrl(key, 3600);
  } catch (err) {
    logger.error({ err, imagePath }, 'Failed to sign pet image URL');
    return null;
  }
}

// Theme song-ul speciei — acelasi format ca imagePath (static, URL absolut,
// sau cheie GCS). Alias semantic spre resolvePetImagePath ca sa nu duplicam
// logica de signed URL si fallback-uri.
export const resolvePetSoundPath = resolvePetImagePath;

// Generic alias — orice asset GCS / static / URL absolut (ex. fundaluri de
// profil cu imageUrl+videoUrl). Aceeasi politica de TTL + fallback ca la pet.
export const resolveAssetPath = resolvePetImagePath;

// Convenience pentru ProfileBackground: rezolva imageUrl + videoUrl in paralel.
// Trecere oricare format (URL absolut, ruta statica /..., cheie GCS sau gs://).
// videoUrl ramane null daca lipseste din DB.
export async function resolveBackgroundAssets(bg: {
  imageUrl: string;
  videoUrl: string | null;
}): Promise<{ imageUrl: string; videoUrl: string | null }> {
  const [imageUrl, videoUrl] = await Promise.all([
    resolveAssetPath(bg.imageUrl),
    bg.videoUrl ? resolveAssetPath(bg.videoUrl) : Promise.resolve(null),
  ]);
  return {
    imageUrl: imageUrl ?? bg.imageUrl,
    videoUrl: videoUrl ?? null,
  };
}

// Forma compacta a pet-ului echipat — atasata oriunde returnam un user public
// (lista de prieteni, profil, co-walk, /me). Cand userul nu si-a echipat un
// pet inca (extrem de rar — `ensureDefaultPet` se ruleaza la register), null.
export type PetSummary = {
  name: string;
  speciesSlug: string;
  speciesName: string;
  imageUrl: string | null;
};

// Batch lookup cu rezolvare URL paralela. Folosit pe endpoint-uri care
// returneaza N useri (lista friends, cowalk participants).
export async function getPetSummariesByUserIds(
  userIds: string[],
): Promise<Map<string, PetSummary>> {
  const out = new Map<string, PetSummary>();
  if (userIds.length === 0) return out;

  const pets = await prisma.pet.findMany({
    where: { userId: { in: userIds } },
    include: { species: true },
  });

  const resolved = await Promise.all(
    pets.map(async (p) => ({
      userId: p.userId,
      summary: {
        name: p.name,
        speciesSlug: p.species.slug,
        speciesName: p.species.name,
        imageUrl: await resolvePetImagePath(p.species.imagePath),
      } satisfies PetSummary,
    })),
  );

  for (const { userId, summary } of resolved) {
    out.set(userId, summary);
  }
  return out;
}

// Lookup pentru un singur user — convenience wrapper. null daca user nu are pet.
export async function getPetSummaryByUserId(
  userId: string,
): Promise<PetSummary | null> {
  const map = await getPetSummariesByUserIds([userId]);
  return map.get(userId) ?? null;
}
