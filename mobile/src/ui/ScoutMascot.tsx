import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';
import { colors } from '../theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Scout — mascota Unplgd: companionul care SIMTE prietenii din apropiere.
// Antenele = senzori de proximitate cu ping radar (mecanica BLE/NFC). Clipeste
// prin swap intre 2 stari de ochi (ca avatarul de pe home), nu prin scalare.
// Self-contained: blink + ping ruleaza singure. Animatiile de plutire/intrare
// se aplica de catre parinte (vezi welcome.tsx).
export type MascotPalette = {
  body: string;
  bodyDark: string;
  belly: string;
  antenna: string;
};

// Paleta implicita = Scout (mov). Pentru un "prieten" distinct, paseaza alta.
export const FRIEND_PALETTE: MascotPalette = {
  body: '#FF9F5C',
  bodyDark: '#E07A3A',
  belly: '#FFD9BC',
  antenna: '#FF6F91',
};

export function ScoutMascot({ size = 196, palette }: { size?: number; palette?: MascotPalette }) {
  const BODY = palette?.body ?? '#7C5CFC';
  const BODY_DARK = palette?.bodyDark ?? '#5B3FD6';
  const BELLY = palette?.belly ?? '#C9BBFF';
  const MINT = palette?.antenna ?? colors.secondary;
  const DARK = colors.text;

  const [closed, setClosed] = useState(false);
  useEffect(() => {
    let blinkTimer: ReturnType<typeof setTimeout>;
    let openTimer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      blinkTimer = setTimeout(() => {
        setClosed(true);
        openTimer = setTimeout(() => {
          setClosed(false);
          schedule();
        }, 130);
      }, 2600 + Math.random() * 1800);
    };
    schedule();
    return () => {
      clearTimeout(blinkTimer);
      clearTimeout(openTimer);
    };
  }, []);

  const ping = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ping, { toValue: 1, duration: 1900, useNativeDriver: false }),
        Animated.delay(700),
        Animated.timing(ping, { toValue: 0, duration: 0, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ping]);
  const pingR = ping.interpolate({ inputRange: [0, 1], outputRange: [9, 22] });
  const pingO = ping.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <Svg width={size} height={Math.round(size * (210 / 200))} viewBox="0 0 200 210">
      {/* antene + ping radar (senzor de prieteni) */}
      <Line x1={84} y1={58} x2={78} y2={32} stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />
      <Line x1={116} y1={58} x2={122} y2={32} stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />
      <AnimatedCircle cx={78} cy={28} r={pingR} stroke={MINT} strokeWidth={2.5} fill="none" opacity={pingO} />
      <AnimatedCircle cx={122} cy={28} r={pingR} stroke={MINT} strokeWidth={2.5} fill="none" opacity={pingO} />
      <Circle cx={78} cy={28} r={8} fill={MINT} />
      <Circle cx={122} cy={28} r={8} fill={MINT} />

      {/* picioare */}
      <Ellipse cx={78} cy={184} rx={17} ry={10} fill={BODY_DARK} />
      <Ellipse cx={122} cy={184} rx={17} ry={10} fill={BODY_DARK} />

      {/* corp */}
      <Ellipse cx={100} cy={118} rx={70} ry={68} fill={BODY} />
      <Ellipse cx={100} cy={134} rx={46} ry={44} fill={BELLY} />

      {/* obraji */}
      <Circle cx={52} cy={132} r={10} fill="rgba(255,120,150,0.45)" />
      <Circle cx={148} cy={132} r={10} fill="rgba(255,120,150,0.45)" />

      {/* ochi — 2 stari: deschisi (alb + pupila) sau inchisi (arc de pleoapa) */}
      {closed ? (
        <>
          <Path d="M64 107 Q74 115 84 107" stroke={DARK} strokeWidth={4.5} strokeLinecap="round" fill="none" />
          <Path d="M116 107 Q126 115 136 107" stroke={DARK} strokeWidth={4.5} strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <Ellipse cx={74} cy={108} rx={17} ry={20} fill="#FFFFFF" />
          <Ellipse cx={126} cy={108} rx={17} ry={20} fill="#FFFFFF" />
          <Circle cx={78} cy={112} r={8} fill={DARK} />
          <Circle cx={122} cy={112} r={8} fill={DARK} />
          <Circle cx={74} cy={107} r={3} fill="#FFFFFF" />
          <Circle cx={118} cy={107} r={3} fill="#FFFFFF" />
        </>
      )}

      {/* zambet */}
      <Path d="M82 142 Q100 160 118 142" stroke={DARK} strokeWidth={4.5} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
