// Constelatia — pagina vizuala interactiva cu top N domenii de interes ca stele.
//
// VIZUAL:
//   - Fundal noapte cu radial gradient (SVG defs) + ~60 puncte decor mici
//     statice ca "stelele indepartate".
//   - Fiecare star principala: 3 straturi (glow exterior, mid, core) + cross
//     sparkle, culoare aleasa determinist per slug din paleta de 6 tonuri.
//   - Marime: scor relativ (radius 16..36).
//
// ANIMATII:
//   - Twinkle: opacity loop 0.65 -> 1.0, perioada random 2.6-4.2s, faza per star.
//   - Breath: scale loop 0.95 -> 1.08, perioada random 3.4-5.0s, faza per star.
//   - Tap: secventa burst (scale 1 -> 1.55 -> 1 in 380ms) + flash overlay (white
//     ring de la 0 la 1 la 0 opacity).
//   - Toate cu useNativeDriver:true (60fps fara JS bridge).
//
// INTERACTIE: tap pe stea -> onTap(domain). Modal-ul de detalii e gestionat de
// parent (atat heroes-book cat si profil-public).
//
// LAYOUT: pozitiile sunt deterministe per slug (hash FNV-1a), deci nu se
// schimba la re-render / refetch. Container ia dimensiunea data ca prop.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle as SvgCircle,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import type { DomainScore } from '../api/me-progress';

// Paleta de stele — culori warm si cool intercalate.
const STAR_PALETTE = [
  '#FFD27A', // gold warm
  '#FFA6D8', // pink
  '#A6E0FF', // light cyan
  '#A6F0CF', // mint
  '#D0B8FF', // lavender
  '#FFE08A', // pale gold
];

// Hash FNV-1a 32-bit; folosit pentru pozitionare + alegere culoare.
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

type StarLayout = {
  domain: DomainScore;
  x: number; // centru
  y: number;
  r: number;
  color: string;
  twinkleDuration: number; // ms
  twinklePhase: number; // 0..1 (offset initial)
  breathDuration: number;
  breathPhase: number;
};

function computeLayout(domains: DomainScore[], width: number, height: number): StarLayout[] {
  if (domains.length === 0) return [];
  const padding = 32;
  const maxScore = Math.max(1, ...domains.map((d) => d.score));

  return domains.map((d) => {
    const h = hashStr(d.slug);
    const xRaw = ((h & 0xffff) / 0xffff) * (width - 2 * padding) + padding;
    const yRaw = (((h >> 16) & 0xffff) / 0xffff) * (height - 2 * padding) + padding;
    const sizeRatio = d.score / maxScore;
    // Stelele REALE sunt mici. r = raza nucleului luminos, 4-9px. Halo-ul glow
    // creste vizual perceput (3.5× radius). Marimea reflecta scorul, dar fara
    // sa para obiecte 3D.
    const r = 4 + sizeRatio * 5;
    const color = STAR_PALETTE[h % STAR_PALETTE.length] ?? STAR_PALETTE[0]!;
    const twinkleDuration = 1800 + ((h >> 8) % 1800);
    const twinklePhase = ((h >> 12) & 0xff) / 256;
    const breathDuration = 3400 + ((h >> 14) % 1600);
    const breathPhase = ((h >> 20) & 0xff) / 256;
    return { domain: d, x: xRaw, y: yRaw, r, color, twinkleDuration, twinklePhase, breathDuration, breathPhase };
  });
}

// Decor static: densitate scalata cu suprafata. ~1 stelute per 1500px².
// Pozitiile sunt deterministe pe indice si dimensiuni (acelasi canvas →
// acelasi pattern), deci nu se schimba la re-render.
function buildDecor(width: number, height: number) {
  const count = Math.min(360, Math.max(80, Math.floor((width * height) / 1500)));
  const out: Array<{ x: number; y: number; r: number; opacity: number }> = [];
  for (let i = 0; i < count; i++) {
    const h = hashStr(`decor-${i}-v3-${width}x${height}`);
    const x = ((h & 0xffff) / 0xffff) * width;
    const y = (((h >> 16) & 0xffff) / 0xffff) * height;
    const r = 0.3 + (((h >> 8) % 100) / 100) * 1.2; // 0.3..1.5
    const opacity = 0.15 + (((h >> 4) % 100) / 100) * 0.4; // 0.15..0.55
    out.push({ x, y, r, opacity });
  }
  return out;
}

// Stelute decor care licaresc — un subset mic (~20) randate ca Animated.View
// peste fundal. Tin separat de decor-ul SVG static ca animatia opacity sa
// foloseasca useNativeDriver:true (60fps fara JS bridge per frame).
function buildTwinkleDecor(width: number, height: number) {
  const count = Math.min(28, Math.max(12, Math.floor((width * height) / 9000)));
  const out: Array<{
    x: number;
    y: number;
    r: number;
    duration: number;
    phase: number;
  }> = [];
  for (let i = 0; i < count; i++) {
    const h = hashStr(`twinkle-${i}-v2-${width}x${height}`);
    out.push({
      x: ((h & 0xffff) / 0xffff) * width,
      y: (((h >> 16) & 0xffff) / 0xffff) * height,
      r: 0.7 + (((h >> 8) % 100) / 100) * 1.0, // 0.7..1.7
      duration: 2200 + ((h >> 4) % 2400), // 2.2..4.6s
      phase: ((h >> 12) & 0xff) / 256,
    });
  }
  return out;
}

function TwinkleDot({
  x,
  y,
  r,
  duration,
  phase,
}: {
  x: number;
  y: number;
  r: number;
  duration: number;
  phase: number;
}) {
  const v = useRef(new Animated.Value(phase)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: duration / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: duration / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration]);

  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.95] });
  const size = r * 2;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: size,
        height: size,
        borderRadius: r,
        backgroundColor: '#FFFFFF',
        opacity,
      }}
    />
  );
}

// Stea cazatoare — apare random la 12-30 secunde, traseaza diagonal, dispare.
// Configuratia (start/end/angle/durata) se schimba la fiecare rulare.
// Folosim Animated.ValueXY pt translatie native + un opacity separat pt
// fade in/out la capete.
function ShootingStar({ width, height }: { width: number; height: number }) {
  // progress 0->1 controleaza pozitia interpolata stanga->dreapta a streak-ului
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  // Configuratia traseului — schimbata la fiecare rulare via setState
  const [cfg, setCfg] = useState(() => makeShootConfig(width, height));

  useEffect(() => {
    let cancelled = false;
    let nextTimeout: ReturnType<typeof setTimeout> | null = null;

    function scheduleNext(delayMs: number) {
      if (cancelled) return;
      nextTimeout = setTimeout(runOnce, delayMs);
    }

    function runOnce() {
      if (cancelled) return;
      const newCfg = makeShootConfig(width, height);
      setCfg(newCfg);
      progress.setValue(0);
      opacity.setValue(0);

      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(progress, {
            toValue: 1,
            duration: newCfg.duration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(newCfg.duration - 280),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 280,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start(() => {
        // Next: 12..30s
        const delay = 12000 + Math.random() * 18000;
        scheduleNext(delay);
      });
    }

    // Prima aparitie: dupa 3..8s
    scheduleNext(3000 + Math.random() * 5000);

    return () => {
      cancelled = true;
      if (nextTimeout) clearTimeout(nextTimeout);
      progress.stopAnimation();
      opacity.stopAnimation();
    };
  }, [width, height, progress, opacity]);

  // Translate de la (startX, startY) la (endX, endY) prin interpolare pe progress.
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [cfg.startX, cfg.endX],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [cfg.startY, cfg.endY],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: cfg.tailLength,
        height: 6,
        opacity,
        transform: [
          { translateX },
          { translateY },
          { rotate: `${cfg.angleDeg}deg` },
        ],
      }}
    >
      <Svg width={cfg.tailLength} height={6}>
        <Defs>
          <LinearGradient id="streakGrad" x1="0%" y1="50%" x2="100%" y2="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="75%" stopColor="#FFFFFF" stopOpacity="0.55" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect
          x={0}
          y={2.2}
          width={cfg.tailLength - 5}
          height={1.6}
          rx={0.8}
          fill="url(#streakGrad)"
        />
        {/* Cap stralucitor la varful trail-ului */}
        <SvgCircle cx={cfg.tailLength - 4} cy={3} r={2.4} fill="#FFFFFF" opacity={0.95} />
        <SvgCircle cx={cfg.tailLength - 4} cy={3} r={1.2} fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );
}

function makeShootConfig(width: number, height: number) {
  // Plecam de undeva sus-stanga sau sus-dreapta, cu unghi spre opus (jos).
  // Distanta = 55-80% din diagonal, durata 700-1100ms.
  const fromLeft = Math.random() < 0.5;
  const startX = fromLeft
    ? -60 + Math.random() * width * 0.25
    : width * 0.55 + Math.random() * width * 0.45 + 60;
  const startY = -40 + Math.random() * height * 0.25;
  const angleDeg = fromLeft
    ? 22 + Math.random() * 18 // 22..40° spre dreapta jos
    : 140 + Math.random() * 18; // 140..158° spre stanga jos
  const angleRad = (angleDeg * Math.PI) / 180;
  const distance = Math.min(width, height) * (0.55 + Math.random() * 0.25);
  const endX = startX + Math.cos(angleRad) * distance;
  const endY = startY + Math.sin(angleRad) * distance;
  const tailLength = 60 + Math.random() * 50;
  const duration = 700 + Math.random() * 400;
  return { startX, startY, endX, endY, angleDeg, tailLength, duration };
}

export function ConstellationView({
  domains,
  width,
  height,
  onTap,
  rounded = true,
}: {
  domains: DomainScore[];
  width: number;
  height: number;
  onTap?: (d: DomainScore) => void;
  // false = colturi drepte (fullscreen page); true = colturi rotunjite (card-style)
  rounded?: boolean;
}) {
  const layout = useMemo(() => computeLayout(domains, width, height), [domains, width, height]);
  const decor = useMemo(() => buildDecor(width, height), [width, height]);
  const twinkleDecor = useMemo(() => buildTwinkleDecor(width, height), [width, height]);

  return (
    <View
      style={[
        styles.container,
        { width, height, borderRadius: rounded ? 20 : 0 },
      ]}
    >
      {/* Fundal: gradient + puncte decor statice */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="nightSky" cx="50%" cy="40%" r="80%">
            <Stop offset="0%" stopColor="#1A1B3D" stopOpacity="1" />
            <Stop offset="60%" stopColor="#0E0F26" stopOpacity="1" />
            <Stop offset="100%" stopColor="#06061A" stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#nightSky)" />
        {decor.map((d, i) => (
          <SvgCircle
            key={i}
            cx={d.x}
            cy={d.y}
            r={d.r}
            fill="#FFFFFF"
            opacity={d.opacity}
          />
        ))}
      </Svg>

      {/* Stelutele care licaresc (subset mic, native-driven opacity) */}
      {twinkleDecor.map((t, i) => (
        <TwinkleDot key={`tw-${i}`} {...t} />
      ))}

      {/* Stea cazatoare ocazionala — un singur element, isi gestioneaza loop-ul */}
      <ShootingStar width={width} height={height} />

      {/* Stelele principale (domeniile) */}
      {layout.map((star) => (
        <Star key={star.domain.slug} star={star} onTap={onTap} />
      ))}
    </View>
  );
}

function Star({
  star,
  onTap,
}: {
  star: StarLayout;
  onTap?: (d: DomainScore) => void;
}) {
  // Animated values — un singur driver native per star.
  const twinkle = useRef(new Animated.Value(star.twinklePhase)).current;
  const breath = useRef(new Animated.Value(star.breathPhase)).current;
  const tapScale = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Twinkle loop: 0 -> 1 -> 0 (opacity-like). Setam direct intre 0 si 1 ca
    // sa folosim in interpolate pentru opacity finala 0.65..1.0.
    const twinkleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, {
          toValue: 1,
          duration: star.twinkleDuration / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(twinkle, {
          toValue: 0,
          duration: star.twinkleDuration / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    // Breath loop: scale 0.95 -> 1.08
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: star.breathDuration / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: star.breathDuration / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    twinkleLoop.start();
    breathLoop.start();

    return () => {
      twinkleLoop.stop();
      breathLoop.stop();
    };
  }, [twinkle, breath, star.twinkleDuration, star.breathDuration]);

  const opacity = twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1.0] });
  const scale = Animated.multiply(
    breath.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.08] }),
    tapScale,
  );
  const flashOpacity = flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.95] });
  const flashScale = flash.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });

  function handlePress() {
    // Punch + flash. Twinkle/breath continua dedesubt (Animated.multiply le
    // combina), tapScale doar le multiplica temporar.
    Animated.sequence([
      Animated.timing(tapScale, {
        toValue: 1.55,
        duration: 140,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }),
      Animated.timing(tapScale, {
        toValue: 1,
        duration: 240,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.sequence([
      Animated.timing(flash, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(flash, {
        toValue: 0,
        duration: 360,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    onTap?.(star.domain);
  }

  // Container suficient pt halo (3.5r) + headroom pt scale anim (max 1.55 × 1.08).
  const containerSize = star.r * 9;

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={12}
      style={[
        styles.starWrap,
        {
          left: star.x - containerSize / 2,
          top: star.y - containerSize / 2,
          width: containerSize,
          height: containerSize,
        },
      ]}
    >
      <Animated.View
        style={{
          width: containerSize,
          height: containerSize,
          alignItems: 'center',
          justifyContent: 'center',
          opacity,
          transform: [{ scale }],
        }}
      >
        <StarSvg radius={star.r} color={star.color} />
      </Animated.View>

      {/* Flash la tap — punct alb mic care expandeaza si dispare */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: containerSize / 2 - star.r,
          top: containerSize / 2 - star.r,
          width: star.r * 2,
          height: star.r * 2,
          borderRadius: star.r,
          backgroundColor: '#FFFFFF',
          opacity: flashOpacity,
          transform: [{ scale: flashScale }],
        }}
      />

      <Text
        style={[styles.starLabel, { width: containerSize + 20 }]}
        numberOfLines={1}
      >
        {star.domain.name}
      </Text>
    </Pressable>
  );
}

function StarSvg({ radius, color }: { radius: number; color: string }) {
  // Stea reala = punct luminos cu halo soft. Doua cercuri:
  //   1. Halo difuz colorat (radius * 3.5) cu fade radial
  //   2. Nucleul alb stralucitor (radius solid, blur natural prin gradient)
  // Fara raze, fara cross, fara obiecte 3D. Simplu, real.
  const halo = radius * 3.5;
  const canvas = halo * 2;
  return (
    <Svg width={canvas} height={canvas} viewBox={`0 0 ${canvas} ${canvas}`}>
      <Defs>
        <RadialGradient id={`halo-${color}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <Stop offset="40%" stopColor={color} stopOpacity="0.18" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={`core-${color}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
          <Stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.5" />
        </RadialGradient>
      </Defs>

      {/* Halo soft difuz */}
      <SvgCircle cx={halo} cy={halo} r={halo} fill={`url(#halo-${color})`} />

      {/* Nucleu — alb cald cu tint catre culoarea stelei la margine */}
      <SvgCircle cx={halo} cy={halo} r={radius} fill={`url(#core-${color})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#06061A',
    overflow: 'hidden',
    alignSelf: 'center',
  },
  starWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Label sub stea — ancorat la 65% din container (jos de centru, dar nu la
  // marginea de jos a containerului de 9r care e mult). Container 9r =>
  // centru la 4.5r, halo se termina la ~7r, label la ~7.5r.
  starLabel: {
    position: 'absolute',
    top: '70%',
    textAlign: 'center',
    color: '#FFF6D8',
    fontSize: 10,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
