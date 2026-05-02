import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';

type AnyPolygon = Polygon | MultiPolygon;

// Imparte poligonul parc-ului in N zone de joc folosind bbox stripes/quadrante
// intersectate cu polygon-ul real. Rezultatul respecta curbele parcului — o
// zona poate avea forma neregulata si include un lac sau alei, dar nu iese
// din parc. Pentru >4 echipe folosim N stripes verticale uniforme.
export function splitPolygonIntoZones(
  parkPolygon: AnyPolygon,
  n: number,
): AnyPolygon[] {
  if (n <= 1) return [parkPolygon];

  const parkFeature = turf.feature(parkPolygon);
  const [minLng, minLat, maxLng, maxLat] = turf.bbox(parkFeature);

  // Slabe defensive: bbox degenerat (parc cu 0 latime/inaltime din cauza date OSM
  // proaste). Returnam tot ca o singura zona.
  if (maxLng <= minLng || maxLat <= minLat) return [parkPolygon];

  const slices: { minLng: number; maxLng: number; minLat: number; maxLat: number }[] = [];

  if (n === 4) {
    // Quadrante 2x2 — distributie buna pentru parcuri patrate.
    const midLng = (minLng + maxLng) / 2;
    const midLat = (minLat + maxLat) / 2;
    slices.push({ minLng, maxLng: midLng, minLat: midLat, maxLat }); // NW
    slices.push({ minLng: midLng, maxLng, minLat: midLat, maxLat }); // NE
    slices.push({ minLng, maxLng: midLng, minLat, maxLat: midLat }); // SW
    slices.push({ minLng: midLng, maxLng, minLat, maxLat: midLat }); // SE
  } else {
    // 2, 3, sau 5+ stripes verticale uniforme. Decizie: pe parcuri lungi
    // orizontal (mai late ca lungi) stripes verticale dau zone proportionate.
    // Pentru parcuri lungi vertical (rare), tot e ok — fiecare stripe e o
    // banda subtire dar functionala.
    const dLng = (maxLng - minLng) / n;
    for (let i = 0; i < n; i++) {
      slices.push({
        minLng: minLng + i * dLng,
        maxLng: minLng + (i + 1) * dLng,
        minLat,
        maxLat,
      });
    }
  }

  const zones: AnyPolygon[] = [];
  for (const s of slices) {
    const slice = turf.bboxPolygon([s.minLng, s.minLat, s.maxLng, s.maxLat]);
    try {
      const intersection = turf.intersect(turf.featureCollection([parkFeature, slice]));
      if (!intersection) continue;
      const geom = intersection.geometry;
      if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
        zones.push(geom);
      }
    } catch {
      // turf.intersect ridica pe poligoane self-intersecting — sarim zona,
      // celelalte raman valide.
    }
  }

  // Fallback: daca ceva n-a mers (toate zonele sunt vide), intoarce parc-ul
  // intreg pentru toate echipele — game still playable, doar fara split.
  if (zones.length === 0) {
    return Array(n).fill(parkPolygon);
  }
  return zones;
}

// Aria zonei in m^2.
export function zoneAreaSqm(zone: AnyPolygon): number {
  return turf.area(turf.feature(zone));
}

// Genereaza un punct random in interiorul unui polygon prin rejection
// sampling pe bounding box. Cap la maxTries ca sa nu se blocheze pe forme
// foarte subtiri/curbate.
export function randomPointInPolygon(
  polygon: AnyPolygon,
  maxTries = 100,
): { lat: number; lng: number } | null {
  const feature: Feature<AnyPolygon> = turf.feature(polygon);
  const [minLng, minLat, maxLng, maxLat] = turf.bbox(feature);
  for (let i = 0; i < maxTries; i++) {
    const lng = minLng + Math.random() * (maxLng - minLng);
    const lat = minLat + Math.random() * (maxLat - minLat);
    if (turf.booleanPointInPolygon(turf.point([lng, lat]), feature)) {
      return { lat, lng };
    }
  }
  return null;
}

// Genereaza N puncte random in interiorul polygon-ului cu spatiere minima
// (in metri) intre ele. Anti-aglomerare: nu vrei 5 monstri intr-un cerc de 3m.
export function randomPointsInPolygon(
  polygon: AnyPolygon,
  count: number,
  minSpacingM = 15,
): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  const maxAttemptsPerPoint = 30;
  for (let i = 0; i < count; i++) {
    let placed: { lat: number; lng: number } | null = null;
    for (let t = 0; t < maxAttemptsPerPoint; t++) {
      const candidate = randomPointInPolygon(polygon);
      if (!candidate) break;
      const tooClose = points.some(
        (p) =>
          turf.distance(turf.point([candidate.lng, candidate.lat]), turf.point([p.lng, p.lat]), {
            units: 'meters',
          }) < minSpacingM,
      );
      if (!tooClose) {
        placed = candidate;
        break;
      }
    }
    if (placed) points.push(placed);
    // Daca n-am gasit punct dupa 30 incercari (zona prea aglomerata), trecem
    // la urmatorul. Spawn count rezultat poate fi sub target — acceptabil.
  }
  return points;
}

export function bboxOfPolygon(polygon: AnyPolygon): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  const [minLng, minLat, maxLng, maxLat] = turf.bbox(turf.feature(polygon));
  return { minLat, maxLat, minLng, maxLng };
}
