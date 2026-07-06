import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

// Peisaj parallax pentru scena de co-walk: 4 layere care se deruleaza orizontal
// cu viteze diferite (cerul → static, muntii → lent, copacii → mediu, iarba →
// rapid). Senzatia: grupul merge inainte; fundalul indepartat se misca putin,
// pamantul de sub picioare se misca repede. Toate layerele sunt 2 copii ale
// aceluiasi pattern self-tileable, anim translateX 0 → -PATTERN_W → 0
// (instant reset). Pe `useNativeDriver: true` — JS nu e niciodata atins.
//
// Svg-urile au `preserveAspectRatio="none"` si height "100%" → peisajul se
// intinde la inaltimea reala a scenei, fara sa lase o banda goala dedesubt.
// Scaling-ul vertical e blajin (~1.2x) deci copacii/muntii nu arata distorsionati.

const PATTERN_W = 360;
const VB_H = 192;

export type LandscapeProps = {
  paused?: boolean;
  // Dimensiunile exacte ale cardului, masurate de PARINTE cu onLayout pe un
  // view cu continut real. NU folosim absoluteFill (left/right/top/bottom) si
  // nici onLayout intern pe un view gol: pe RN new arch ambele s-au dovedit
  // nesigure aici (view-ul intra in flux si impinge continutul, onLayout nu
  // se emite). Pozitie + marime numerice = deterministic.
  w: number;
  h: number;
};

export function Landscape({ paused = false, w, h }: LandscapeProps) {
  // Overlay IN-FLUX, nu position:absolute: randat ca ULTIMUL copil al scenei,
  // cu marginTop egal cu -inaltimea cardului → se suprapune exact peste card
  // (net zero inaltime adaugata), iar zIndex -1 il tine sub continut. Nu
  // depinde de semantica absolute (care s-a dovedit nesigura aici pe new arch).
  return (
    <View
      style={[styles.wrap, { width: w, height: h, marginTop: -h }]}
      pointerEvents="none"
      collapsable={false}
    >
      <LandscapeLayers paused={paused} w={w} h={h} />
    </View>
  );
}

function LandscapeLayers({ paused, w, h }: { paused: boolean; w: number; h: number }) {
  return (
    <>
      {/* Cer — static, gradient apus blajin. */}
      <View style={styles.skyLayer}>
        <Svg
          width={w}
          height={h}
          viewBox={`0 0 ${PATTERN_W} ${VB_H}`}
          preserveAspectRatio="none"
        >
          <Defs>
            <LinearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0%" stopColor="#FFCFA6" stopOpacity="1" />
              <Stop offset="60%" stopColor="#FFE7B8" stopOpacity="1" />
              <Stop offset="100%" stopColor="#FFF1C7" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={PATTERN_W} height={VB_H} fill="url(#sky)" />
          {/* Soare — fix sus-dreapta. */}
          <Circle cx={PATTERN_W - 60} cy={36} r={22} fill="#FFD13E" opacity={0.85} />
          <Circle cx={PATTERN_W - 60} cy={36} r={32} fill="#FFD13E" opacity={0.18} />
        </Svg>
      </View>

      {/* Nori — translateX foarte lent, pluteste sus. */}
      <ParallaxLayer durationMs={42000} paused={paused} h={h}>
        {(idx) => <CloudsPattern key={idx} h={h} />}
      </ParallaxLayer>

      {/* Munti distanti — purpur pal, lent. */}
      <ParallaxLayer durationMs={26000} paused={paused} h={h}>
        {(idx) => <MountainsPattern key={idx} h={h} />}
      </ParallaxLayer>

      {/* Copaci — verzi, mediu. */}
      <ParallaxLayer durationMs={13000} paused={paused} h={h}>
        {(idx) => <TreesPattern key={idx} h={h} />}
      </ParallaxLayer>

      {/* Iarba foreground — viteza maxima, sugereaza pas. */}
      <ParallaxLayer durationMs={6500} paused={paused} h={h}>
        {(idx) => <GrassPattern key={idx} h={h} />}
      </ParallaxLayer>
    </>
  );
}

// =====================================================================
// ParallaxLayer — wrapper generic care anima 2 copii ale unui pattern
// =====================================================================

function ParallaxLayer({
  children,
  durationMs,
  paused,
  h,
}: {
  children: (idx: number) => React.ReactNode;
  durationMs: number;
  paused: boolean;
  h: number;
}) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (paused) {
      x.stopAnimation();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, {
          toValue: 1,
          duration: durationMs,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [durationMs, paused, x]);

  const translate = x.interpolate({ inputRange: [0, 1], outputRange: [0, -PATTERN_W] });

  return (
    <Animated.View
      style={[styles.layer, { height: h, transform: [{ translateX: translate }] }]}
    >
      <View style={{ width: PATTERN_W, height: h }}>{children(0)}</View>
      <View style={{ width: PATTERN_W, height: h }}>{children(1)}</View>
    </Animated.View>
  );
}

// =====================================================================
// Patterns SVG — fiecare 360×192 self-tileable (Y(0) === Y(360))
// =====================================================================

function StretchSvg({ children, h }: { children: React.ReactNode; h: number }) {
  return (
    <Svg
      width={PATTERN_W}
      height={h}
      viewBox={`0 0 ${PATTERN_W} ${VB_H}`}
      preserveAspectRatio="none"
    >
      {children}
    </Svg>
  );
}

function CloudsPattern({ h }: { h: number }) {
  return (
    <StretchSvg h={h}>
      <Cloud cx={50} cy={28} scale={0.9} />
      <Cloud cx={180} cy={20} scale={1.1} />
      <Cloud cx={290} cy={42} scale={0.75} />
    </StretchSvg>
  );
}

function Cloud({ cx, cy, scale }: { cx: number; cy: number; scale: number }) {
  const c = '#FFFFFF';
  const op = 0.85;
  return (
    <>
      <Ellipse cx={cx} cy={cy} rx={18 * scale} ry={9 * scale} fill={c} opacity={op} />
      <Ellipse
        cx={cx + 14 * scale}
        cy={cy + 2 * scale}
        rx={14 * scale}
        ry={8 * scale}
        fill={c}
        opacity={op}
      />
      <Ellipse
        cx={cx - 12 * scale}
        cy={cy + 3 * scale}
        rx={12 * scale}
        ry={7 * scale}
        fill={c}
        opacity={op}
      />
    </>
  );
}

function MountainsPattern({ h }: { h: number }) {
  // Y la x=0 si x=PATTERN_W identice → pattern self-tileable.
  const baseY = VB_H - 38;
  const back = `M0 ${baseY - 10} L60 ${baseY - 50} L130 ${baseY - 25} L200 ${baseY - 55} L260 ${baseY - 30} L330 ${baseY - 48} L${PATTERN_W} ${baseY - 10} L${PATTERN_W} ${VB_H} L0 ${VB_H} Z`;
  const front = `M0 ${baseY} L40 ${baseY - 30} L100 ${baseY - 5} L170 ${baseY - 38} L230 ${baseY - 15} L290 ${baseY - 32} L${PATTERN_W} ${baseY} L${PATTERN_W} ${VB_H} L0 ${VB_H} Z`;
  return (
    <StretchSvg h={h}>
      <Path d={back} fill="#C7B5E5" opacity={0.85} />
      <Path d={front} fill="#9E83CB" opacity={0.95} />
    </StretchSvg>
  );
}

function TreesPattern({ h }: { h: number }) {
  // Copaci la pozitii departate de margini (>=20 de la 0/PATTERN_W) ca sa nu
  // se taie la junctiunea celor 2 copii. groundY ales astfel incat radacina
  // trunchiului sa intre 2px in iarba (iarba e VB_H-12..VB_H), suficient sa
  // nu para ca plutesc, dar sa ramana suficient deasupra ca sa nu fie ingropati.
  const ground = VB_H - 10;
  const trees = [
    { x: 30, h: 0.9 },
    { x: 75, h: 1.05 },
    { x: 115, h: 0.8 },
    { x: 165, h: 1.0 },
    { x: 215, h: 0.95 },
    { x: 255, h: 0.85 },
    { x: 305, h: 1.1 },
    { x: 340, h: 0.78 },
  ];
  return (
    <StretchSvg h={h}>
      {trees.map((t, i) => (
        <Tree key={i} x={t.x} groundY={ground} scale={t.h} />
      ))}
    </StretchSvg>
  );
}

function Tree({ x, groundY, scale }: { x: number; groundY: number; scale: number }) {
  const trunkH = 16 * scale;
  const trunkW = 4;
  const crownR = 14 * scale;
  return (
    <>
      <Rect
        x={x - trunkW / 2}
        y={groundY - trunkH}
        width={trunkW}
        height={trunkH}
        fill="#7A4A2B"
        rx={1}
      />
      <Circle cx={x} cy={groundY - trunkH - crownR * 0.6} r={crownR} fill="#3F8C4F" />
      <Circle
        cx={x - crownR * 0.55}
        cy={groundY - trunkH - crownR * 0.3}
        r={crownR * 0.7}
        fill="#46A35B"
      />
      <Circle
        cx={x + crownR * 0.55}
        cy={groundY - trunkH - crownR * 0.3}
        r={crownR * 0.7}
        fill="#46A35B"
      />
    </>
  );
}

function GrassPattern({ h }: { h: number }) {
  const baseY = VB_H - 4;
  const tufts = [10, 45, 92, 130, 170, 215, 250, 295, 335];
  return (
    <StretchSvg h={h}>
      <Rect x={0} y={baseY - 8} width={PATTERN_W} height={12} fill="#4DA85E" />
      {tufts.map((tx, i) => (
        <Path
          key={i}
          d={`M${tx - 5} ${baseY - 8} Q${tx} ${baseY - 16} ${tx + 5} ${baseY - 8}`}
          fill="#5DBE6F"
        />
      ))}
    </StretchSvg>
  );
}

const styles = StyleSheet.create({
  // In-flux cu marginTop negativ (vezi Landscape) — fara position absolute.
  wrap: {
    overflow: 'hidden',
    zIndex: -1,
  },
  skyLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  // Wrapper pentru cele 2 copii ale unui pattern. top/bottom 0 → ocupa toata
  // inaltimea wrap-ului → Svg-urile cu height "100%" se intind corect.
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PATTERN_W * 2,
    flexDirection: 'row',
  },
});
