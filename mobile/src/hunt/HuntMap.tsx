import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
import type { GeoJsonPolygon, HeartbeatResponse, MonsterType, Warmth } from '../api/hunt';

type Props = {
  parkPolygon: GeoJsonPolygon;
  zonePolygon: GeoJsonPolygon | null;
  myCoords: { lat: number; lng: number } | null;
  heartbeat: HeartbeatResponse | null;
  warmth: Warmth;
  bearing: number | null;
  heading: number | null;
};

const WARMTH_HEX: Record<Warmth, string> = {
  cold: '#5C8AB5',
  cool: '#6FB1D8',
  warm: '#F2B23B',
  hot: '#F37D3B',
  very_hot: '#E74C3C',
};

// Raza wedge-ului proportionala cu warmth bucket-ul: aproape inseamna wedge
// scurt/intens, departe inseamna fascicul lat. Cold = ascuns (n-avem directie).
const WEDGE_RADIUS_M: Record<Warmth, number> = {
  cold: 0,
  cool: 90,
  warm: 55,
  hot: 28,
  very_hot: 14,
};

const HALO_RADIUS_M: Record<Warmth, number> = {
  cold: 0,
  cool: 28,
  warm: 18,
  hot: 12,
  very_hot: 8,
};

// Construieste un poligon "wedge" centrat pe user, deschis in directia bearing.
// Format: [center, arc points..., center] — closed ring pt Polygon.
function buildWedge(
  center: { lat: number; lng: number },
  bearingDeg: number,
  radiusM: number,
  halfAngleDeg = 28,
  steps = 18,
): { latitude: number; longitude: number }[] {
  const ring: { latitude: number; longitude: number }[] = [
    { latitude: center.lat, longitude: center.lng },
  ];
  const cosLat = Math.cos((center.lat * Math.PI) / 180);
  for (let i = 0; i <= steps; i++) {
    const angle = bearingDeg - halfAngleDeg + (i / steps) * (halfAngleDeg * 2);
    const rad = (angle * Math.PI) / 180;
    const dLat = (radiusM * Math.cos(rad)) / 111_000;
    const dLng = (radiusM * Math.sin(rad)) / (111_000 * cosLat);
    ring.push({
      latitude: center.lat + dLat,
      longitude: center.lng + dLng,
    });
  }
  ring.push({ latitude: center.lat, longitude: center.lng });
  return ring;
}

function withAlpha(hex: string, alpha: number): string {
  const a = Math.max(0, Math.min(255, Math.round(alpha * 255)))
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

const MONSTER_COLOR: Record<MonsterType, string> = {
  green: '#7DCEA0',
  yellow: '#F4D03F',
  red: '#E74C3C',
  gold: '#F1C40F',
};

const MONSTER_EMOJI: Record<MonsterType, string> = {
  green: '👻',
  yellow: '🐲',
  red: '👹',
  gold: '🐉',
};

function ringToLatLng(ring: number[][]): { latitude: number; longitude: number }[] {
  return ring.map(([lng, lat]) => ({ latitude: lat as number, longitude: lng as number }));
}

// Pentru Polygon returneaza ring-urile (outer + holes). Pentru MultiPolygon
// aplatizeaza in lista de ring-uri (fiecare sub-polygon are propriul outer).
function polygonRings(p: GeoJsonPolygon): number[][][] {
  if (p.type === 'Polygon') return p.coordinates;
  return p.coordinates.flat();
}

function bboxOf(p: GeoJsonPolygon) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const ring of polygonRings(p)) {
    for (const [lng, lat] of ring) {
      if (lat! < minLat) minLat = lat!;
      if (lat! > maxLat) maxLat = lat!;
      if (lng! < minLng) minLng = lng!;
      if (lng! > maxLng) maxLng = lng!;
    }
  }
  return { minLat, maxLat, minLng, maxLng };
}

export function HuntMap({
  parkPolygon,
  zonePolygon,
  myCoords,
  heartbeat,
  warmth,
  bearing,
  heading,
}: Props) {
  const mapRef = useRef<MapView | null>(null);

  // Heading-up navigation: rotim camera ca directia in care merge user-ul
  // sa fie mereu "sus". Throttle minimal — animateCamera face interpolation
  // smooth la nivel nativ.
  const lastHeadingRef = useRef<number>(0);
  useEffect(() => {
    if (heading == null || !mapRef.current) return;
    if (Math.abs(heading - lastHeadingRef.current) < 2) return;
    lastHeadingRef.current = heading;
    mapRef.current.animateCamera({ heading }, { duration: 250 });
  }, [heading]);

  const initialRegion = useMemo(() => {
    const bbox = bboxOf(parkPolygon);
    const latitude = (bbox.minLat + bbox.maxLat) / 2;
    const longitude = (bbox.minLng + bbox.maxLng) / 2;
    const latitudeDelta = Math.max(0.0008, (bbox.maxLat - bbox.minLat) * 1.6);
    const longitudeDelta = Math.max(0.0008, (bbox.maxLng - bbox.minLng) * 1.6);
    return { latitude, longitude, latitudeDelta, longitudeDelta };
  }, [parkPolygon]);

  const parkRings = useMemo(() => polygonRings(parkPolygon), [parkPolygon]);
  const zoneRings = useMemo(
    () => (zonePolygon ? polygonRings(zonePolygon) : []),
    [zonePolygon],
  );

  const engagedMonsters = heartbeat?.status === 'ACTIVE' ? heartbeat.engagedMonsters : [];
  const revealMonster = heartbeat?.status === 'ACTIVE' ? heartbeat.revealMonster : null;

  const wedgeCoords = useMemo(() => {
    if (!myCoords || warmth === 'cold' || bearing === null) return null;
    return buildWedge(myCoords, bearing, WEDGE_RADIUS_M[warmth]);
  }, [myCoords, warmth, bearing]);

  const warmthHex = WARMTH_HEX[warmth];

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsPointsOfInterest={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {parkRings.map((ring, idx) => (
          <Polygon
            key={`park-${idx}`}
            coordinates={ringToLatLng(ring)}
            strokeColor="rgba(46,204,113,0.85)"
            fillColor="rgba(46,204,113,0.10)"
            strokeWidth={2}
          />
        ))}
        {zoneRings.map((ring, idx) => (
          <Polygon
            key={`zone-${idx}`}
            coordinates={ringToLatLng(ring)}
            strokeColor="rgba(243,125,59,0.95)"
            fillColor="rgba(243,125,59,0.20)"
            strokeWidth={3}
          />
        ))}
        {wedgeCoords && (
          <Polygon
            coordinates={wedgeCoords}
            fillColor={withAlpha(warmthHex, 0.32)}
            strokeColor={withAlpha(warmthHex, 0.9)}
            strokeWidth={2}
          />
        )}
        {myCoords && warmth !== 'cold' && (
          <Circle
            center={{ latitude: myCoords.lat, longitude: myCoords.lng }}
            radius={HALO_RADIUS_M[warmth]}
            fillColor={withAlpha(warmthHex, 0.18)}
            strokeColor={withAlpha(warmthHex, 0.7)}
            strokeWidth={1.5}
          />
        )}
        {myCoords && (
          <Marker
            coordinate={{ latitude: myCoords.lat, longitude: myCoords.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
          >
            <View style={styles.meDotOuter}>
              <View style={styles.meDotInner} />
            </View>
          </Marker>
        )}
        {engagedMonsters.map((m) => (
          <Marker
            key={`eng-${m.id}`}
            coordinate={{ latitude: m.lat, longitude: m.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            title={m.name}
          >
            <View style={[styles.monsterMarker, { backgroundColor: MONSTER_COLOR[m.type] }]}>
              <Text style={styles.monsterEmoji}>{MONSTER_EMOJI[m.type]}</Text>
            </View>
          </Marker>
        ))}
        {revealMonster && !engagedMonsters.some((m) => m.id === revealMonster.id) && (
          <Marker
            coordinate={{ latitude: revealMonster.lat, longitude: revealMonster.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View
              style={[
                styles.monsterMarker,
                { backgroundColor: MONSTER_COLOR[revealMonster.type] },
              ]}
            >
              <Text style={styles.monsterEmoji}>{MONSTER_EMOJI[revealMonster.type]}</Text>
            </View>
          </Marker>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden', borderRadius: 18 },
  meDotOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(33,150,243,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2196F3',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  monsterMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  monsterEmoji: { fontSize: 20 },
});
