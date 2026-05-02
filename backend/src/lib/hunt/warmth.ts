// Warmth = "cat de aproape e cel mai apropiat monstru ascuns". Backend-ul nu
// dezvaluie distanta exacta sau directia exacta — doar un bucket. Asta tine
// suspans-ul si previne abuz prin GPS triangulation.
//
// Praguri (in metri):
//   <  8  → very_hot   (in raza de discover, urmeaza notificare)
//   <  25 → hot
//   <  60 → warm
//   <  120 → cool
//   >= 120 → cold

export type Warmth = 'cold' | 'cool' | 'warm' | 'hot' | 'very_hot';

export function warmthForDistance(distM: number): Warmth {
  if (distM < 8) return 'very_hot';
  if (distM < 25) return 'hot';
  if (distM < 60) return 'warm';
  if (distM < 120) return 'cool';
  return 'cold';
}

// Distanta haversine in metri intre 2 puncte GPS. Suficient de precis pentru
// distante <5km (eroarea sub 0.5%).
export function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6_371_000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Bearing busola (0=N, 90=E, 180=S, 270=W) de la (a) la (b). Folosit la
// sageata busola din UI care arata directia spre cel mai apropiat monstru.
export function bearingDegrees(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}
