import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  SvgXml,
} from 'react-native-svg';
import type { ChestLoot, ChestTier, ChestTierVisual, Rarity } from '../api/chests';
import { colors } from '../theme/colors';

// Vizualuri + reveal animat pentru cufere — partajat intre homepage (side
// button) si pagina /chests. Sursa de adevar pentru SVG-uri e DB (/chests/tiers);
// componentele BigChest* + MiniChestSvg sunt fallback local daca DB n-a raspuns.

export const TIER_LABEL: Record<ChestTier, string> = {
  BRONZE: 'Bronz',
  SILVER: 'Argint',
  GOLD: 'Aur',
  PLATINUM: 'Platina',
  DIAMOND: 'Diamant',
  CHAMPION: 'Campion',
};

// Culori per raritate pentru pastila/border-ul tile-ului de item in loot reveal.
// Mai rar = mai cald.
export const RARITY_COLOR: Record<Rarity, string> = {
  COMMON: '#A8B4BD',
  RARE: '#5DA9FF',
  EPIC: '#B86AE0',
  LEGENDARY: '#FFB347',
};

export type TierStyle = {
  bg: string;
  dark: string;
  fg: string;
  glow: string;
  // shading suplimentar pt body
  bodyTop: string;
  bodyBot: string;
  // benzi metalice
  metal: string;
  metalDark: string;
  metalLight: string;
  // gem pe lid (null = fara gem)
  gem: string | null;
  gemHi: string;
  // coroana pe top (doar CHAMPION)
  crown: boolean;
};

// Fallback hardcoded — folosit doar daca /chests/tiers nu a raspuns inca.
// DB e sursa de adevar in productie; valorile aici match-uiesc seed.ts.
export const TIER_COLORS: Record<ChestTier, TierStyle> = {
  BRONZE: {
    bg: '#C68B59', dark: '#6B3F1A', fg: '#FFF6E8', glow: '#FFD7A8',
    bodyTop: '#E4A974', bodyBot: '#8E5A2E',
    metal: '#A86C3A', metalDark: '#6B3F1A', metalLight: '#D9A37A',
    gem: null, gemHi: '#FFFFFF', crown: false,
  },
  SILVER: {
    bg: '#C0CBD4', dark: '#5F6F7B', fg: '#1F3344', glow: '#F0F5F9',
    bodyTop: '#DCE4EB', bodyBot: '#8A98A4',
    metal: '#8E9CA8', metalDark: '#5F6F7B', metalLight: '#C8D2DA',
    gem: '#E8F4FF', gemHi: '#FFFFFF', crown: false,
  },
  GOLD: {
    bg: '#F2C744', dark: '#7A5A0E', fg: '#5B3F00', glow: '#FFEFA8',
    bodyTop: '#FFE070', bodyBot: '#B58A14',
    metal: '#D6A012', metalDark: '#7A5A0E', metalLight: '#FFD968',
    gem: '#FF6A6A', gemHi: '#FFD0D0', crown: false,
  },
  PLATINUM: {
    bg: '#7FE0D0', dark: '#1F6358', fg: '#0C3F38', glow: '#C2FFF4',
    bodyTop: '#B4EFE3', bodyBot: '#3FA597',
    metal: '#3FA597', metalDark: '#1F6358', metalLight: '#7CD5C6',
    gem: '#3FE0FF', gemHi: '#E6FAFF', crown: false,
  },
  DIAMOND: {
    bg: '#9AB3FF', dark: '#2B3F8E', fg: '#1B2870', glow: '#E2EAFF',
    bodyTop: '#C7D5FF', bodyBot: '#5A77D4',
    metal: '#5A77D4', metalDark: '#2B3F8E', metalLight: '#A8BAFF',
    gem: '#9DF5FF', gemHi: '#FFFFFF', crown: false,
  },
  CHAMPION: {
    bg: '#FF7A59', dark: '#7A2812', fg: '#FFFFFF', glow: '#FFD9C2',
    bodyTop: '#FFA888', bodyBot: '#C04A2D',
    metal: '#D6A012', metalDark: '#7A5A0E', metalLight: '#FFD968',
    gem: '#FF3A3A', gemHi: '#FFC8C8', crown: true,
  },
};

// Tipul rezolvat al unui tier — culori + SVG strings (cu fallback hardcoded
// pentru culori, fara fallback pentru SVG: daca DB nu a raspuns, randam local).
export type ResolvedTier = {
  bg: string;
  dark: string;
  fg: string;
  glow: string;
  miniSvg: string | null;
  bodySvg: string | null;
  lidSvg: string | null;
};

export function resolveTier(
  tier: ChestTier,
  byTier: Partial<Record<ChestTier, ChestTierVisual>>,
): ResolvedTier {
  const fb = TIER_COLORS[tier];
  const db = byTier[tier];
  return {
    bg: db?.bgColor ?? fb.bg,
    dark: db?.darkColor ?? fb.dark,
    fg: db?.fgColor ?? fb.fg,
    glow: db?.glowColor ?? fb.glow,
    miniSvg: db?.miniSvg ?? null,
    bodySvg: db?.bodySvg ?? null,
    lidSvg: db?.lidSvg ?? null,
  };
}

// Mini chest pt stack-uri (homepage side button). Compus din lid + body cu
// gradient defs intre stacks.
export function MiniChestSvg({ tier }: { tier: ChestTier }) {
  const c = TIER_COLORS[tier];
  const gid = `mini-${tier}`;
  return (
    <Svg width={34} height={32} viewBox="0 0 26 24" fill="none">
      <Defs>
        <LinearGradient id={`${gid}-body`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.bodyTop} />
          <Stop offset="1" stopColor={c.bodyBot} />
        </LinearGradient>
        <LinearGradient id={`${gid}-lid`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.bodyTop} />
          <Stop offset="1" stopColor={c.bg} />
        </LinearGradient>
      </Defs>
      {/* corp */}
      <Path
        d="M3 12 H23 V21 a1.5 1.5 0 0 1 -1.5 1.5 H4.5 A1.5 1.5 0 0 1 3 21 Z"
        fill={`url(#${gid}-body)`}
        stroke={c.dark}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {/* lid */}
      <Path
        d="M3 12 V8 a4 4 0 0 1 4 -4 h12 a4 4 0 0 1 4 4 v4 Z"
        fill={`url(#${gid}-lid)`}
        stroke={c.dark}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {/* banda metalica orizontala (linia de inchidere) */}
      <Path d="M3 12 H23" stroke={c.dark} strokeWidth={1.4} strokeLinecap="round" />
      {/* incuietoare */}
      <Rect x="11" y="13.5" width="4" height="5" rx="0.6" fill={c.metalDark} />
      <Circle cx="13" cy="15.2" r="0.7" fill={c.dark} />
      {/* highlight curbat pe lid */}
      <Path d="M6 8 a5 5 0 0 1 5 -3" stroke={c.glow} strokeWidth={0.9} strokeLinecap="round" fill="none" opacity={0.85} />
    </Svg>
  );
}

// Chest SVG mare pentru animatia de deschidere — corpul si lid-ul sunt SVG-uri
// separate, ca lid-ul sa poata fi animat independent (ridicare + rotire).
function BigChestBody({ tier, size }: { tier: ChestTier; size: number }) {
  const c = TIER_COLORS[tier];
  const gid = `body-${tier}`;
  return (
    <Svg width={size} height={size * 0.7} viewBox="0 0 100 70" fill="none">
      <Defs>
        <LinearGradient id={`${gid}-body`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.bodyTop} />
          <Stop offset="0.5" stopColor={c.bg} />
          <Stop offset="1" stopColor={c.bodyBot} />
        </LinearGradient>
        <LinearGradient id={`${gid}-metal`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.metalLight} />
          <Stop offset="0.5" stopColor={c.metal} />
          <Stop offset="1" stopColor={c.metalDark} />
        </LinearGradient>
        <RadialGradient id={`${gid}-keyhole`} cx="0.5" cy="0.45" r="0.6">
          <Stop offset="0" stopColor={c.metalDark} />
          <Stop offset="1" stopColor="#000000" />
        </RadialGradient>
      </Defs>
      {/* corp principal */}
      <Path
        d="M4 4 H96 V60 a6 6 0 0 1 -6 6 H10 a6 6 0 0 1 -6 -6 Z"
        fill={`url(#${gid}-body)`}
        stroke={c.dark}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      {/* banda metalica de jos */}
      <Rect x="2" y="56" width="96" height="9" rx="2" fill={`url(#${gid}-metal)`} stroke={c.dark} strokeWidth={1.6} />
      {/* nituri pe banda jos */}
      <Circle cx="10" cy="60.5" r="1.6" fill={c.metalLight} stroke={c.dark} strokeWidth={0.8} />
      <Circle cx="50" cy="60.5" r="1.6" fill={c.metalLight} stroke={c.dark} strokeWidth={0.8} />
      <Circle cx="90" cy="60.5" r="1.6" fill={c.metalLight} stroke={c.dark} strokeWidth={0.8} />
      {/* benzi verticale metalice stanga si dreapta */}
      <Rect x="6" y="4" width="8" height="56" fill={`url(#${gid}-metal)`} stroke={c.dark} strokeWidth={1.4} />
      <Rect x="86" y="4" width="8" height="56" fill={`url(#${gid}-metal)`} stroke={c.dark} strokeWidth={1.4} />
      {/* nituri verticale */}
      <Circle cx="10" cy="10" r="1.4" fill={c.metalLight} stroke={c.dark} strokeWidth={0.7} />
      <Circle cx="10" cy="30" r="1.4" fill={c.metalLight} stroke={c.dark} strokeWidth={0.7} />
      <Circle cx="10" cy="50" r="1.4" fill={c.metalLight} stroke={c.dark} strokeWidth={0.7} />
      <Circle cx="90" cy="10" r="1.4" fill={c.metalLight} stroke={c.dark} strokeWidth={0.7} />
      <Circle cx="90" cy="30" r="1.4" fill={c.metalLight} stroke={c.dark} strokeWidth={0.7} />
      <Circle cx="90" cy="50" r="1.4" fill={c.metalLight} stroke={c.dark} strokeWidth={0.7} />
      {/* incuietoare centrala — placa metalica + keyhole */}
      <Rect x="42" y="20" width="16" height="22" rx="2" fill={`url(#${gid}-metal)`} stroke={c.dark} strokeWidth={1.6} />
      <Circle cx="50" cy="28" r="2.4" fill={`url(#${gid}-keyhole)`} stroke={c.dark} strokeWidth={0.8} />
      <Path d="M50 30 L48.5 36 H51.5 Z" fill={c.dark} />
      {/* highlight lung pe corp (luciu vertical stanga) */}
      <Rect x="17" y="6" width="2.5" height="48" fill={c.glow} opacity={0.25} rx="1" />
    </Svg>
  );
}

function BigChestLid({ tier, size }: { tier: ChestTier; size: number }) {
  const c = TIER_COLORS[tier];
  const gid = `lid-${tier}`;
  return (
    <Svg width={size} height={size * 0.5} viewBox="0 0 100 50" fill="none">
      <Defs>
        <LinearGradient id={`${gid}-lid`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.bodyTop} />
          <Stop offset="0.65" stopColor={c.bg} />
          <Stop offset="1" stopColor={c.bodyBot} />
        </LinearGradient>
        <LinearGradient id={`${gid}-metal`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.metalLight} />
          <Stop offset="1" stopColor={c.metalDark} />
        </LinearGradient>
        {c.gem && (
          <RadialGradient id={`${gid}-gem`} cx="0.4" cy="0.35" r="0.7">
            <Stop offset="0" stopColor={c.gemHi} />
            <Stop offset="0.5" stopColor={c.gem} />
            <Stop offset="1" stopColor={c.dark} />
          </RadialGradient>
        )}
      </Defs>
      {/* lid principal — semi-curbat sus, drept jos */}
      <Path
        d="M4 46 V22 a18 18 0 0 1 18 -18 h56 a18 18 0 0 1 18 18 v24 Z"
        fill={`url(#${gid}-lid)`}
        stroke={c.dark}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      {/* benzi metalice verticale stanga/dreapta */}
      <Path d="M6 14 a16 16 0 0 1 8 -10 H14 V46 H6 Z" fill={`url(#${gid}-metal)`} stroke={c.dark} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M94 14 a16 16 0 0 0 -8 -10 H86 V46 H94 Z" fill={`url(#${gid}-metal)`} stroke={c.dark} strokeWidth={1.4} strokeLinejoin="round" />
      {/* nituri pe lid */}
      <Circle cx="10" cy="42" r="1.4" fill={c.metalLight} stroke={c.dark} strokeWidth={0.7} />
      <Circle cx="90" cy="42" r="1.4" fill={c.metalLight} stroke={c.dark} strokeWidth={0.7} />
      <Circle cx="10" cy="20" r="1.4" fill={c.metalLight} stroke={c.dark} strokeWidth={0.7} />
      <Circle cx="90" cy="20" r="1.4" fill={c.metalLight} stroke={c.dark} strokeWidth={0.7} />
      {/* banda metalica jos (intalnirea cu corpul) */}
      <Rect x="2" y="42" width="96" height="6" fill={`url(#${gid}-metal)`} stroke={c.dark} strokeWidth={1.4} />
      {/* highlight curbat pe lid (luciu) */}
      <Path d="M18 16 a14 14 0 0 1 14 -10" stroke={c.glow} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.85}/>
      {/* gem central pe lid (doar tiere care au gem) */}
      {c.gem && (
        <G>
          <Ellipse cx="50" cy="22" rx="7" ry="9" fill={`url(#${gid}-gem)`} stroke={c.dark} strokeWidth={1.4} />
          <Ellipse cx="48" cy="19" rx="2" ry="3" fill={c.gemHi} opacity={0.85} />
        </G>
      )}
      {/* coroana mica pe top (doar CHAMPION) */}
      {c.crown && (
        <G>
          <Path d="M40 5 L44 -1 L50 4 L56 -1 L60 5 L60 9 L40 9 Z" fill={c.metal} stroke={c.dark} strokeWidth={1.4} strokeLinejoin="round" transform="translate(0 1)"/>
          <Circle cx="44" cy="1" r="1.6" fill={c.gem ?? c.glow} stroke={c.dark} strokeWidth={0.7} transform="translate(0 1)"/>
          <Circle cx="50" cy="4.5" r="1.6" fill={c.gem ?? c.glow} stroke={c.dark} strokeWidth={0.7} transform="translate(0 1)"/>
          <Circle cx="56" cy="1" r="1.6" fill={c.gem ?? c.glow} stroke={c.dark} strokeWidth={0.7} transform="translate(0 1)"/>
        </G>
      )}
    </Svg>
  );
}

// Particule care explodeaza din chest la deschidere — monede mici + sparks.
function ParticleBurst({
  progress,
  fadeOut,
  tier,
}: {
  progress: Animated.Value;
  fadeOut: Animated.Value;
  tier: ChestTier;
}) {
  const c = TIER_COLORS[tier];
  const particles = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        const radius = 70 + (i % 3) * 18;
        return {
          dx: Math.cos(angle - Math.PI / 2) * radius,
          dy: Math.sin(angle - Math.PI / 2) * radius - 20,
          size: 8 + (i % 3) * 2,
          color: i % 2 === 0 ? c.metal : c.glow,
          delay: i * 18,
        };
      }),
    [c.metal, c.glow],
  );
  return (
    <>
      {particles.map((p, i) => {
        const x = progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] });
        const y = progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] });
        const opacity = fadeOut.interpolate({
          inputRange: [0, 0.15, 0.85, 1],
          outputRange: [0, 1, 1, 0],
        });
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${(i % 2 === 0 ? 1 : -1) * 360}deg`],
        });
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: '50%',
              top: '40%',
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: p.color,
              borderWidth: 1.5,
              borderColor: c.dark,
              marginLeft: -p.size / 2,
              marginTop: -p.size / 2,
              opacity,
              transform: [{ translateX: x }, { translateY: y }, { rotate }],
              shadowColor: c.glow,
              shadowOpacity: 0.9,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
        );
      })}
    </>
  );
}

// Raze de lumina care ies din chest cand se deschide — 8 raze radiale,
// scale-up + fade. Compus din View-uri rotate (mai performant decat SVG anim).
function LightRays({ progress, tier }: { progress: Animated.Value; tier: ChestTier }) {
  const c = TIER_COLORS[tier];
  const rays = 8;
  const opacity = progress.interpolate({
    inputRange: [0, 0.3, 0.8, 1],
    outputRange: [0, 0.7, 0.5, 0],
  });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.5] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: '50%',
        top: '40%',
        width: 0,
        height: 0,
        opacity,
        transform: [{ scale }],
      }}
    >
      {Array.from({ length: rays }, (_, i) => {
        const angle = (i / rays) * 360;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: 12,
              height: 160,
              marginLeft: -6,
              marginTop: -80,
              backgroundColor: c.glow,
              opacity: 0.5,
              borderRadius: 6,
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}
    </Animated.View>
  );
}

// Tile pt un duplicate item — animatie smechera in 4 acte:
//   1. Drop-in  2. Idle  3. Flash + pulse  4. Shatter + shards spre XP counter
function DuplicateTile({
  duplicate,
  color,
  startDelay,
  onShardsLanded,
}: {
  duplicate: ChestLoot['duplicates'][number];
  color: ResolvedTier;
  startDelay: number;
  onShardsLanded: (shardsXp: number) => void;
}) {
  const drop = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const shatter = useRef(new Animated.Value(0)).current;
  const shards = useRef(new Animated.Value(0)).current;
  const [phase, setPhase] = useState<'hidden' | 'dropped' | 'shattering' | 'gone'>('hidden');

  useEffect(() => {
    const seq = Animated.sequence([
      Animated.delay(startDelay),
      Animated.parallel([
        Animated.spring(drop, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
      ]),
      Animated.delay(350),
      Animated.timing(pulse, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(shatter, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(shards, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]);
    seq.start(({ finished }) => {
      if (finished) {
        onShardsLanded(duplicate.shardsXp);
        setPhase('gone');
      }
    });
    const t1 = setTimeout(() => setPhase('dropped'), startDelay + 300);
    const t2 = setTimeout(() => setPhase('shattering'), startDelay + 350 + 300 + 220);
    return () => {
      seq.stop();
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tileScale = Animated.add(
    Animated.add(
      drop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
      pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }),
    ),
    shatter.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }),
  );
  const tileY = drop.interpolate({ inputRange: [0, 1], outputRange: [30, 0] });
  const tileOpacity = Animated.subtract(
    drop,
    shatter.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.4, 1] }),
  );
  const tileRotate = shatter.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '14deg'] });
  const bgInterp = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: ['#00000022', color.glow],
  });

  const shardsCount = 6;

  return (
    <View style={styles.lootTileWrap} pointerEvents="none">
      <Animated.View
        style={[
          styles.lootTile,
          {
            backgroundColor: bgInterp,
            borderColor: color.dark,
            opacity: tileOpacity,
            transform: [{ translateY: tileY }, { scale: tileScale }, { rotate: tileRotate }],
          },
        ]}
      >
        <View style={styles.lootTileArt}>
          {duplicate.svg ? (
            <SvgXml xml={duplicate.svg} width={64} height={64} />
          ) : (
            <Text style={[styles.lootItem, { color: color.fg }]}>?</Text>
          )}
        </View>
        <Text style={[styles.lootTileName, { color: color.fg }]} numberOfLines={1}>
          {duplicate.name}
        </Text>
        <Text style={[styles.lootTileShards, { color: color.fg }]}>+{duplicate.shardsXp} XP</Text>
      </Animated.View>

      {phase === 'shattering' &&
        Array.from({ length: shardsCount }, (_, i) => {
          const angle = (i / shardsCount) * Math.PI * 2 - Math.PI / 2;
          const radialR = 28;
          const tx = shards.interpolate({
            inputRange: [0, 0.3, 1],
            outputRange: [0, Math.cos(angle) * radialR, Math.cos(angle) * radialR * 0.3],
          });
          const ty = shards.interpolate({
            inputRange: [0, 0.3, 1],
            outputRange: [0, Math.sin(angle) * radialR, -120],
          });
          const op = shards.interpolate({
            inputRange: [0, 0.15, 0.7, 1],
            outputRange: [0, 1, 1, 0],
          });
          const sc = shards.interpolate({
            inputRange: [0, 0.3, 1],
            outputRange: [0.2, 1.1, 0.5],
          });
          return (
            <Animated.View
              key={i}
              style={[
                styles.shard,
                {
                  backgroundColor: color.glow,
                  shadowColor: color.glow,
                  opacity: op,
                  transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }],
                },
              ]}
            />
          );
        })}
    </View>
  );
}

// Reveal stil Clash Royale: chest aterizeaza cu spring → shake → flash + burst
// → lid sare in sus + roteste → loot apare cu pop sequential → XP big.
export function LootRevealInline({
  loot,
  tier,
  visual,
  onDismiss,
}: {
  loot: ChestLoot;
  tier: ChestTier;
  visual: ResolvedTier;
  onDismiss: () => void;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const lid = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const [showOk, setShowOk] = useState(false);

  const dupShardsTotal = useMemo(
    () => loot.duplicates.reduce((s, d) => s + d.shardsXp, 0),
    [loot.duplicates],
  );
  const [displayedXp, setDisplayedXp] = useState(loot.xp - dupShardsTotal);
  const handleShardsLanded = (delta: number) =>
    setDisplayedXp((prev) => Math.min(loot.xp, prev + delta));

  useEffect(() => {
    Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    Animated.sequence([
      Animated.spring(enter, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
      Animated.delay(120),
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 70, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 70, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 1, duration: 70, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 70, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(burst, { toValue: 1, duration: 500, easing: Easing.out(Easing.exp), useNativeDriver: true }),
        Animated.spring(lid, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      ]),
      Animated.spring(reveal, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
    ]).start(() => setShowOk(true));
  }, [enter, shake, burst, lid, reveal, backdrop]);

  const c = visual;

  const enterScale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const enterY = enter.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });
  const shakeRot = shake.interpolate({ inputRange: [-1, 1], outputRange: ['-7deg', '7deg'] });
  const burstScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.2, 2.6] });
  const burstOpacity = burst.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.85, 0] });
  const lidY = lid.interpolate({ inputRange: [0, 1], outputRange: [0, -36] });
  const lidRot = lid.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-22deg'] });
  const revealScale = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const revealY = reveal.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  return (
    <Animated.View style={[styles.lootBackdrop, { opacity: backdrop }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={showOk ? onDismiss : undefined} />

      {/* Burst behind chest — glow ring care explodeaza din spatele cufarului */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.burstRing,
          { transform: [{ scale: burstScale }], opacity: burstOpacity, backgroundColor: c.glow },
        ]}
      />

      {/* Raze de lumina radiale — ies din chest cand se ridica lid-ul */}
      <LightRays progress={burst} tier={tier} />

      {/* Chest container — enter scale + shake rotation */}
      <Animated.View
        style={[
          styles.chestContainer,
          { transform: [{ translateY: enterY }, { scale: enterScale }, { rotate: shakeRot }] },
        ]}
      >
        {/* Lid (animat separat — translateY si rotate) */}
        <Animated.View
          style={{ transform: [{ translateY: lidY }, { rotate: lidRot }], transformOrigin: 'bottom left' }}
        >
          {visual.lidSvg ? (
            <SvgXml xml={visual.lidSvg} width={160} height={80} />
          ) : (
            <BigChestLid tier={tier} size={160} />
          )}
        </Animated.View>
        {/* Body */}
        <View style={{ marginTop: -4 }}>
          {visual.bodySvg ? (
            <SvgXml xml={visual.bodySvg} width={160} height={112} />
          ) : (
            <BigChestBody tier={tier} size={160} />
          )}
        </View>
        {/* Monede + sparks care explodeaza din lid */}
        <ParticleBurst progress={burst} fadeOut={burst} tier={tier} />
      </Animated.View>

      {/* Loot detalii */}
      <Animated.View
        style={[
          styles.lootCard,
          {
            backgroundColor: c.bg,
            borderColor: c.dark,
            opacity: reveal,
            transform: [{ translateY: revealY }, { scale: revealScale }],
          },
        ]}
      >
        <Text style={[styles.lootTier, { color: c.fg }]}>{TIER_LABEL[tier]}</Text>
        <Text style={[styles.lootXp, { color: c.fg }]}>+{displayedXp} XP</Text>

        {loot.items.length > 0 && (
          <View style={styles.lootGrid}>
            {loot.items.map((it) => (
              <View key={it.itemId} style={[styles.lootTile, { backgroundColor: '#FFFFFF22', borderColor: c.dark }]}>
                <View style={styles.lootTileArt}>
                  {it.svg ? (
                    <SvgXml xml={it.svg} width={64} height={64} />
                  ) : (
                    <Text style={[styles.lootItem, { color: c.fg }]}>?</Text>
                  )}
                </View>
                <Text style={[styles.lootTileName, { color: c.fg }]} numberOfLines={1}>
                  {it.name}
                </Text>
                <View style={[styles.rarityDot, { backgroundColor: RARITY_COLOR[it.rarity] }]} />
              </View>
            ))}
          </View>
        )}

        {loot.duplicates.length > 0 && (
          <View style={styles.lootGrid}>
            {loot.duplicates.map((d, idx) => (
              <DuplicateTile
                key={`${d.slug}-${idx}`}
                duplicate={d}
                color={c}
                startDelay={1500 + idx * 320}
                onShardsLanded={handleShardsLanded}
              />
            ))}
          </View>
        )}
      </Animated.View>

      {showOk && (
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [
            styles.lootDismiss,
            { backgroundColor: c.dark, borderColor: c.dark },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.lootDismissText, { color: '#FFFFFF' }]}>Continua</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lootBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 16, 32, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 18,
  },
  burstRing: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: '30%',
  },
  chestContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  lootCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 22,
    borderWidth: 2,
    padding: 18,
    gap: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  lootTier: { fontSize: 16, fontWeight: '900', letterSpacing: 0.4, textTransform: 'uppercase' },
  lootXp: { fontSize: 30, fontWeight: '900' },
  lootItem: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  lootGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 8,
    width: '100%',
  },
  lootTileWrap: {
    width: 92,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  lootTile: {
    width: 92,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    backgroundColor: '#FFFFFF22',
  },
  shard: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 10,
    height: 10,
    marginLeft: -5,
    marginTop: -5,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  lootTileArt: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lootTileName: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  lootTileShards: {
    fontSize: 11,
    fontWeight: '900',
    marginTop: 2,
    opacity: 0.9,
  },
  rarityDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  lootDismiss: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  lootDismissText: { fontSize: 15, fontWeight: '900', letterSpacing: 0.4 },
});
