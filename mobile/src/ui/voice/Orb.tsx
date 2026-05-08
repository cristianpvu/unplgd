import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  RadialGradient,
  Stop,
  G,
  Path,
} from 'react-native-svg';
import { colors } from '../../theme/colors';

// Vizual: orb 220×220 cu gradient lucios + halo + ripples cand asculta. Folosit
// pe ecranele voice-first (creare poveste, verificare poveste). Driver pe faza
// e pasat de parinte; aici e doar redarea + animatiile interne.

export type OrbPhase = 'idle' | 'listening' | 'thinking' | 'speaking';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

export function Orb({ phase }: { phase: OrbPhase }) {
  const SIZE = 220;
  const orbPulse = useRef(new Animated.Value(1)).current;
  const orbGlow = useRef(new Animated.Value(0.6)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    orbPulse.stopAnimation();
    orbGlow.stopAnimation();
    ring1.stopAnimation();
    ring2.stopAnimation();
    ring3.stopAnimation();

    if (phase === 'idle') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(orbPulse, {
            toValue: 1.04,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(orbPulse, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }

    if (phase === 'listening') {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(orbPulse, {
            toValue: 1.12,
            duration: 450,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(orbPulse, {
            toValue: 1,
            duration: 450,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      const rippleSeq = (anim: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, {
              toValue: 1,
              duration: 1600,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
          ]),
        );
      pulseLoop.start();
      const r1 = rippleSeq(ring1, 0);
      const r2 = rippleSeq(ring2, 533);
      const r3 = rippleSeq(ring3, 1066);
      r1.start();
      r2.start();
      r3.start();
      return () => {
        pulseLoop.stop();
        r1.stop();
        r2.stop();
        r3.stop();
      };
    }

    if (phase === 'thinking') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(orbGlow, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(orbGlow, {
            toValue: 0.4,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }

    if (phase === 'speaking') {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(orbPulse, {
            toValue: 1.08,
            duration: 280,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(orbPulse, {
            toValue: 0.96,
            duration: 220,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(orbPulse, {
            toValue: 1.04,
            duration: 320,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(orbPulse, {
            toValue: 1,
            duration: 200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    }
  }, [phase, orbPulse, orbGlow, ring1, ring2, ring3]);

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={SIZE}
        height={SIZE}
        viewBox="0 0 240 240"
        style={StyleSheet.absoluteFillObject}
      >
        <Defs>
          <RadialGradient id="orbGlow" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0%" stopColor={colors.accent} stopOpacity="0.5" />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <AnimatedG opacity={orbGlow}>
          <Circle cx="120" cy="120" r="115" fill="url(#orbGlow)" />
        </AnimatedG>
        {phase === 'listening' && (
          <>
            <Ripple anim={ring1} from={60} to={110} />
            <Ripple anim={ring2} from={60} to={110} />
            <Ripple anim={ring3} from={60} to={110} />
          </>
        )}
      </Svg>

      <Animated.View
        style={{
          width: SIZE,
          height: SIZE,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: orbPulse }],
        }}
      >
        <Svg width={SIZE} height={SIZE} viewBox="0 0 240 240">
          <Defs>
            <RadialGradient id="orbGradient" cx="0.5" cy="0.45" r="0.65">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="35%" stopColor="#FFD9B0" stopOpacity="0.95" />
              <Stop offset="70%" stopColor={colors.accent} stopOpacity="0.85" />
              <Stop offset="100%" stopColor="#7B3FBF" stopOpacity="0.6" />
            </RadialGradient>
          </Defs>
          <Circle cx="120" cy="120" r="78" fill="url(#orbGradient)" />
          <Circle cx="98" cy="92" r="22" fill="#FFFFFF" opacity={0.55} />
          <Circle cx="92" cy="86" r="8" fill="#FFFFFF" opacity={0.95} />
        </Svg>
      </Animated.View>
    </View>
  );
}

function Ripple({
  anim,
  from,
  to,
}: {
  anim: Animated.Value;
  from: number;
  to: number;
}) {
  const radius = anim.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  const opacity = anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.5, 0],
  });
  return (
    <AnimatedCircle
      cx="120"
      cy="120"
      r={radius}
      stroke={colors.accent}
      strokeWidth={2}
      fill="none"
      opacity={opacity}
    />
  );
}

// Mesh gradient animat care se invarte lent in fundal — da senzatia ca atmosfera
// "magica" e mereu in miscare. Doua layere: fundalul fix (bg color), si peste
// el cele 3 cercuri colorate radiale care se rotesc.
export function BackgroundMesh() {
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 60_000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [rotation]);

  const rotateZ = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
        <Path d="M0 0 H400 V800 H0 Z" fill={colors.bg} />
      </Svg>
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ rotate: rotateZ }] }]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient id="g1" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0%" stopColor={colors.accent} stopOpacity="0.45" />
              <Stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="g2" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0%" stopColor="#9B3FBF" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#9B3FBF" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="g3" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0%" stopColor="#3F8FBF" stopOpacity="0.35" />
              <Stop offset="100%" stopColor="#3F8FBF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="120" cy="180" r="280" fill="url(#g1)" />
          <Circle cx="320" cy="320" r="320" fill="url(#g2)" />
          <Circle cx="180" cy="600" r="300" fill="url(#g3)" />
        </Svg>
      </Animated.View>
    </View>
  );
}
