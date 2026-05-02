import type { Warmth } from '../api/hunt';

const EARTH_R = 6_371_000;

export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function bearingDegrees(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Mirror al backend-ului (lib/hunt/warmth.ts) — clientul recalculeaza warmth
// din coords + nearestPosition fara sa astepte heartbeat-ul de 5s.
export function warmthForDistance(d: number): Warmth {
  if (d < 8) return 'very_hot';
  if (d < 25) return 'hot';
  if (d < 60) return 'warm';
  if (d < 120) return 'cool';
  return 'cold';
}
