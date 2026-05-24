import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon, Position } from 'geojson';
import { logger } from '../logger.js';
import { prisma } from '../prisma.js';

// Overpass endpoint public — fara cost, fara auth, rate limit blajin pt
// volume mici. In productie poate fi inlocuit cu un mirror self-hosted daca
// volumul creste.
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// TTL pentru cache: re-fetch un parc dupa 7 zile (geometria se schimba rar
// in OSM, dar adaugam noi tag-uri si putem prinde corectii).
const PARK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Raza maxima de cautare in jurul user-ului. 5km e suficient pentru parcuri
// urbane mari; mai mult inseamna fetch lent + rezultate irrelevante.
const SEARCH_RADIUS_M = 5000;

// Aria minima pe care un poligon trebuie sa o aiba ca sa fie considerat parc
// jucabil. Sub 2000 m^2 (~ 0.2 ha) e prea mic pentru o sesiune cu 2 echipe.
const MIN_PARK_AREA_SQM = 2000;

type OverpassElement =
  | {
      type: 'way';
      id: number;
      tags?: Record<string, string>;
      geometry?: Array<{ lat: number; lon: number }>;
    }
  | {
      type: 'relation';
      id: number;
      tags?: Record<string, string>;
      members?: Array<{
        type: 'way';
        ref: number;
        role: string;
        geometry?: Array<{ lat: number; lon: number }>;
      }>;
    }
  | { type: 'node'; id: number; lat: number; lon: number; tags?: Record<string, string> };

// Construieste GeoJSON Polygon dintr-o linie de coords OSM. OSM poate
// returna deschis (last != first) — inchidem manual.
function ringFromCoords(coords: Array<{ lat: number; lon: number }>): Position[] {
  const ring: Position[] = coords.map((c) => [c.lon, c.lat]);
  if (ring.length === 0) return ring;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0]!, first[1]!]);
  return ring;
}

// Construieste un Polygon dintr-un way OSM. Way-ul e o linie inchisa care
// formeaza un singur outer ring.
function wayToPolygon(way: Extract<OverpassElement, { type: 'way' }>): Polygon | null {
  if (!way.geometry || way.geometry.length < 4) return null;
  const ring = ringFromCoords(way.geometry);
  if (ring.length < 4) return null;
  return { type: 'Polygon', coordinates: [ring] };
}

// Construieste un MultiPolygon dintr-o relatie OSM (multipolygon = parc cu
// gauri sau bucati separate). Members marcate ca "outer" devin ringuri
// independente; inele "inner" devin gauri pe ringul outer corespunzator.
// Versiune simplificata: tratam fiecare outer ca un poligon separat fara
// gauri (suficient pentru MVP — 95% din parcuri sunt single-outer fara holes).
function relationToPolygons(rel: Extract<OverpassElement, { type: 'relation' }>): Polygon[] {
  const polygons: Polygon[] = [];
  for (const m of rel.members ?? []) {
    if (m.type !== 'way' || m.role !== 'outer' || !m.geometry) continue;
    const ring = ringFromCoords(m.geometry);
    if (ring.length < 4) continue;
    polygons.push({ type: 'Polygon', coordinates: [ring] });
  }
  return polygons;
}

function bbox(poly: Polygon | MultiPolygon): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  const visit = (ring: Position[]) => {
    for (const [lng, lat] of ring) {
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  };
  if (poly.type === 'Polygon') {
    for (const r of poly.coordinates) visit(r);
  } else {
    for (const p of poly.coordinates) for (const r of p) visit(r);
  }
  return { minLat, maxLat, minLng, maxLng };
}

// Distanta minima de la un punct la bounding box-ul unui parc, in metri
// (aproximare planara — corect pentru distante de cateva km).
export function distanceToBbox(
  lat: number,
  lng: number,
  b: { minLat: number; maxLat: number; minLng: number; maxLng: number },
): number {
  const dx = Math.max(b.minLng - lng, 0, lng - b.maxLng);
  const dy = Math.max(b.minLat - lat, 0, lat - b.maxLat);
  // 1 deg lat ~ 111km, 1 deg lng la latitudine ~ 111km * cos(lat).
  const mPerLat = 111_000;
  const mPerLng = 111_000 * Math.cos((lat * Math.PI) / 180);
  return Math.sqrt((dx * mPerLng) ** 2 + (dy * mPerLat) ** 2);
}

// Apel la Overpass cu queryul standard pentru parcuri intr-o raza GPS.
// Filtreaza implicit pe leisure=park (ignoram leisure=playground si altele).
// Ignoram parcuri sub MIN_PARK_AREA — neviabile pt zone splitting.
async function fetchOverpassParks(lat: number, lng: number): Promise<{
  osmId: string;
  name: string;
  polygon: Polygon | MultiPolygon;
  areaSqm: number;
  city: string | null;
}[]> {
  const query = `
    [out:json][timeout:20];
    (
      way["leisure"="park"](around:${SEARCH_RADIUS_M},${lat},${lng});
      relation["leisure"="park"](around:${SEARCH_RADIUS_M},${lat},${lng});
    );
    out geom;
  `;

  const resp = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'unplgd-mobile/1.0',
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    logger.warn(
      { status: resp.status, body: body.slice(0, 200) },
      'overpass.fetch_failed',
    );
    throw new Error(`Overpass HTTP ${resp.status}`);
  }

  const json = (await resp.json()) as { elements: OverpassElement[] };
  const out: {
    osmId: string;
    name: string;
    polygon: Polygon | MultiPolygon;
    areaSqm: number;
    city: string | null;
  }[] = [];

  for (const el of json.elements ?? []) {
    let polygon: Polygon | MultiPolygon | null = null;
    let osmId: string;
    let tags: Record<string, string> | undefined;

    if (el.type === 'way') {
      polygon = wayToPolygon(el);
      osmId = `way/${el.id}`;
      tags = el.tags;
    } else if (el.type === 'relation') {
      const polys = relationToPolygons(el);
      if (polys.length === 1) polygon = polys[0]!;
      else if (polys.length > 1)
        polygon = { type: 'MultiPolygon', coordinates: polys.map((p) => p.coordinates) };
      osmId = `relation/${el.id}`;
      tags = el.tags;
    } else {
      continue;
    }

    if (!polygon) continue;

    const name = tags?.name ?? tags?.['name:ro'] ?? 'Parc fara nume';
    const city = tags?.['addr:city'] ?? null;
    const feature: Feature = { type: 'Feature', geometry: polygon, properties: {} };
    const areaSqm = turf.area(feature);
    if (areaSqm < MIN_PARK_AREA_SQM) continue;

    out.push({ osmId, name, polygon, areaSqm, city });
  }

  return out;
}

// Fetch + cache: incearca DB intai pe bbox match, fallback la Overpass daca
// sub TTL nu avem nimic local sau parcurile cache-uite sunt vechi.
export async function getParksNear(
  lat: number,
  lng: number,
): Promise<
  Array<{
    id: string;
    osmId: string;
    name: string;
    polygon: string;
    bboxMinLat: number;
    bboxMaxLat: number;
    bboxMinLng: number;
    bboxMaxLng: number;
    areaSqm: number;
    city: string | null;
    distanceM: number;
  }>
> {
  // Bbox de cautare in jurul punctului (5km in toate directiile, marja larga).
  const dLat = SEARCH_RADIUS_M / 111_000;
  const dLng = SEARCH_RADIUS_M / (111_000 * Math.cos((lat * Math.PI) / 180));

  // Pas 1: vedem ce avem deja in DB cu bbox overlap pe regiunea cautata.
  const cached = await prisma.park.findMany({
    where: {
      bboxMinLat: { lte: lat + dLat },
      bboxMaxLat: { gte: lat - dLat },
      bboxMinLng: { lte: lng + dLng },
      bboxMaxLng: { gte: lng - dLng },
    },
  });

  // Decizie de refresh: daca avem 0 parcuri local SAU cel mai recent fetch e
  // peste TTL, declansam Overpass. In rest, folosim cache-ul direct.
  const now = Date.now();
  const newestFetch = cached.reduce(
    (max, p) => Math.max(max, p.lastFetchedAt.getTime()),
    0,
  );
  const cacheStale = cached.length === 0 || now - newestFetch > PARK_TTL_MS;

  let working = cached;
  if (cacheStale) {
    try {
      const fresh = await fetchOverpassParks(lat, lng);
      // Upsert per osmId — nou sau refresh.
      const upserts = await Promise.all(
        fresh.map((p) => {
          const b = bbox(p.polygon);
          return prisma.park.upsert({
            where: { osmId: p.osmId },
            create: {
              osmId: p.osmId,
              name: p.name,
              polygon: JSON.stringify(p.polygon),
              bboxMinLat: b.minLat,
              bboxMaxLat: b.maxLat,
              bboxMinLng: b.minLng,
              bboxMaxLng: b.maxLng,
              areaSqm: p.areaSqm,
              city: p.city,
              lastFetchedAt: new Date(),
            },
            update: {
              name: p.name,
              polygon: JSON.stringify(p.polygon),
              bboxMinLat: b.minLat,
              bboxMaxLat: b.maxLat,
              bboxMinLng: b.minLng,
              bboxMaxLng: b.maxLng,
              areaSqm: p.areaSqm,
              city: p.city,
              lastFetchedAt: new Date(),
            },
          });
        }),
      );
      working = upserts;
    } catch (err) {
      // Daca Overpass pica, mergem mai departe cu cache-ul stale (better than
      // nothing) — log ca admin sa vada.
      logger.warn({ err }, 'overpass.fetch_failed_using_stale_cache');
    }
  }

  // Pas 2: filtreaza pe distanta reala bbox→punct si sorteaza ascending.
  const decorated = working
    .map((p) => ({
      ...p,
      distanceM: distanceToBbox(lat, lng, {
        minLat: p.bboxMinLat,
        maxLat: p.bboxMaxLat,
        minLng: p.bboxMinLng,
        maxLng: p.bboxMaxLng,
      }),
    }))
    .filter((p) => p.distanceM <= SEARCH_RADIUS_M)
    .sort((a, b) => a.distanceM - b.distanceM);

  return decorated;
}

// Verifica daca un punct (lat, lng) e in interiorul unui parc cache-uit.
// Folosit la pornire sesiune si la heartbeat.
export function pointInPark(
  lat: number,
  lng: number,
  parkPolygon: string,
): boolean {
  try {
    const geom = JSON.parse(parkPolygon) as Polygon | MultiPolygon;
    return turf.booleanPointInPolygon(turf.point([lng, lat]), turf.feature(geom));
  } catch {
    return false;
  }
}
