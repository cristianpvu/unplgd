// Efecte vizuale specifice care traverseaza scena — meteor, fulger, ploaie de
// stele, rafala de praf, puls de lumina. Declansate prin `event` (id + tip);
// cand id-ul se schimba, efectul ruleaza o data si dispare.
//
// Generic-urile (flash/shake/darken/rumble/zoom) raman in Scene (afecteaza
// camera/overlay global). Aici doar entitatile vizibile.

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Polygon, Path } from 'react-native-svg';

export type SpecificVfx =
  | 'meteor'
  | 'lightning'
  | 'shooting-stars'
  | 'dust-gust'
  | 'glow-pulse';

export type VfxOverlayEvent = { id: number; vfx: SpecificVfx } | null;

export function VfxOverlay({ event }: { event: VfxOverlayEvent }) {
  const { width, height } = useWindowDimensions();
  // Tinem id-ul activ ca sa re-montam efectul la fiecare event nou.
  const [active, setActive] = useState<{ id: number; vfx: SpecificVfx } | null>(null);

  useEffect(() => {
    if (!event) return;
    setActive(event);
    // Auto-clear dupa durata maxima a oricarui efect (~2.5s).
    const t = setTimeout(() => setActive(null), 2600);
    return () => clearTimeout(t);
  }, [event?.id]);

  if (!active) return null;

  switch (active.vfx) {
    case 'meteor':
      return <Meteor key={active.id} width={width} height={height} />;
    case 'lightning':
      return <Lightning key={active.id} width={width} height={height} />;
    case 'shooting-stars':
      return <ShootingStars key={active.id} width={width} height={height} />;
    case 'dust-gust':
      return <DustGust key={active.id} width={width} height={height} />;
    case 'glow-pulse':
      return <GlowPulse key={active.id} width={width} height={height} />;
  }
}

// Un meteorit mare traverseaza diagonal de sus-dreapta jos-stanga.
function Meteor({ width, height }: { width: number; height: number }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(p, {
      toValue: 1,
      duration: 1100,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [p]);
  const tx = p.interpolate({ inputRange: [0, 1], outputRange: [width * 0.9, width * 0.1] });
  const ty = p.interpolate({ inputRange: [0, 1], outputRange: [-60, height * 0.5] });
  const opacity = p.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] });
  return (
    <Animated.View
      style={{ position: 'absolute', transform: [{ translateX: tx }, { translateY: ty }], opacity }}
      pointerEvents="none"
    >
      <Svg width={120} height={60}>
        {/* Dara */}
        <Polygon points="0,28 90,8 120,18 90,30" fill="#FFD98A" opacity={0.55} />
        {/* Capul meteoritului */}
        <Circle cx={104} cy={20} r={12} fill="#FFE3A8" />
        <Circle cx={104} cy={20} r={6} fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );
}

// Fulger ramificat + flash scurt alb.
function Lightning({ width, height }: { width: number; height: number }) {
  const flash = useRef(new Animated.Value(0)).current;
  const bolt = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(bolt, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0.6, duration: 50, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(bolt, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start();
  }, [flash, bolt]);
  const x = width * 0.6;
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} pointerEvents="none">
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#FFFFFF',
          opacity: flash,
        }}
      />
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, opacity: bolt }}>
        <Svg width={width} height={height * 0.7}>
          <Path
            d={`M${x},0 L${x - 30},${height * 0.22} L${x + 10},${height * 0.24} L${x - 25},${height * 0.5} L${x + 5},${height * 0.46} L${x - 40},${height * 0.7}`}
            stroke="#FFF6C0"
            strokeWidth={4}
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

// Ploaie scurta de stele cazatoare — 5 dare care trec rapid.
function ShootingStars({ width, height }: { width: number; height: number }) {
  const stars = useRef(
    Array.from({ length: 5 }).map((_, i) => ({
      v: new Animated.Value(0),
      startY: height * (0.05 + Math.random() * 0.4),
      startX: width * (0.4 + Math.random() * 0.6),
      delay: i * 160,
      size: 40 + Math.random() * 40,
    })),
  ).current;
  useEffect(() => {
    stars.forEach((s) => {
      Animated.timing(s.v, {
        toValue: 1,
        duration: 900,
        delay: s.delay,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
  }, [stars]);
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {stars.map((s, i) => {
        const tx = s.v.interpolate({ inputRange: [0, 1], outputRange: [s.startX, s.startX - 200] });
        const ty = s.v.interpolate({ inputRange: [0, 1], outputRange: [s.startY, s.startY + 120] });
        const opacity = s.v.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.View
            key={i}
            style={{ position: 'absolute', transform: [{ translateX: tx }, { translateY: ty }], opacity }}
          >
            <Svg width={s.size} height={s.size * 0.25}>
              <Polygon
                points={`0,${s.size * 0.12} ${s.size * 0.85},0 ${s.size},${s.size * 0.12} ${s.size * 0.85},${s.size * 0.25}`}
                fill="#FFE3A8"
              />
              <Circle cx={s.size * 0.92} cy={s.size * 0.12} r={s.size * 0.08} fill="#FFFFFF" />
            </Svg>
          </Animated.View>
        );
      })}
    </View>
  );
}

// Rafala de praf — particule care trec rapid de la dreapta la stanga.
function DustGust({ width, height }: { width: number; height: number }) {
  const particles = useRef(
    Array.from({ length: 14 }).map(() => ({
      v: new Animated.Value(0),
      y: height * (0.3 + Math.random() * 0.55),
      size: 4 + Math.random() * 8,
      delay: Math.random() * 300,
      drift: -20 + Math.random() * 40,
    })),
  ).current;
  useEffect(() => {
    particles.forEach((p) => {
      Animated.timing(p.v, {
        toValue: 1,
        duration: 1100,
        delay: p.delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
  }, [particles]);
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {particles.map((p, i) => {
        const tx = p.v.interpolate({ inputRange: [0, 1], outputRange: [width + 30, -40] });
        const ty = p.v.interpolate({ inputRange: [0, 1], outputRange: [p.y, p.y + p.drift] });
        const opacity = p.v.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.8, 0.8, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: 'rgba(200,180,150,0.7)',
              transform: [{ translateX: tx }, { translateY: ty }],
              opacity,
            }}
          />
        );
      })}
    </View>
  );
}

// Puls de lumina din centru — pt relicve, cristale care se activeaza.
function GlowPulse({ width, height }: { width: number; height: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [v]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 2.4] });
  const opacity = v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.5, 0] });
  const size = Math.min(width, height) * 0.5;
  return (
    <View
      style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
      pointerEvents="none"
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#FFF6C0',
          opacity,
          transform: [{ scale }],
        }}
      />
    </View>
  );
}
