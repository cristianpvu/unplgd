import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { badRequest } from '../lib/errors.js';
import { getParksNear } from '../lib/hunt/overpass.js';

export const huntRouter = Router();
huntRouter.use(requireAuth);

const nearbySchema = z.object({
  lat: z.coerce.number().gte(-90).lte(90),
  lng: z.coerce.number().gte(-180).lte(180),
});

// GET /hunt/parks/nearby?lat=...&lng=...
// Returneaza parcurile in raza de 5km. Cache OSM in DB cu refresh saptamanal.
// Mobile-ul foloseste lista pentru ecranul "alege un parc" la pornirea hunt-ului.
huntRouter.get('/parks/nearby', async (req, res, next) => {
  try {
    const parsed = nearbySchema.safeParse(req.query);
    if (!parsed.success) throw badRequest('invalid_coords', 'Coordonate GPS invalide');
    const { lat, lng } = parsed.data;

    const parks = await getParksNear(lat, lng);

    res.json({
      parks: parks.map((p) => ({
        id: p.id,
        osmId: p.osmId,
        name: p.name,
        polygon: JSON.parse(p.polygon),
        bbox: {
          minLat: p.bboxMinLat,
          maxLat: p.bboxMaxLat,
          minLng: p.bboxMinLng,
          maxLng: p.bboxMaxLng,
        },
        areaSqm: Math.round(p.areaSqm),
        city: p.city,
        distanceM: Math.round(p.distanceM),
      })),
    });
  } catch (e) {
    next(e);
  }
});
