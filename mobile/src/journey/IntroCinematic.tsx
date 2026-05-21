// Intro cinematic — secventa vizuala care se joaca INAINTE de prima scena a
// unui capitol. Ofera un "deschidere de film": ceva se intampla grafic, apoi
// pet-ul intra in scena la pozitia lui de mers.
//
// Tipuri (modulare — un capitol alege unul prin Chapter.introCinematic):
//   'crash-pod' = o capsula cade din cer, se prabuseste (flash + praf), apoi
//                 pet-ul se ridica din epava la pozitia de mers.
//   'warp-in'   = pet-ul se materializeaza dintr-un puls de lumina.
//   'walk-in'   = pet-ul intra mergand din stanga (simplu, default).
//
// La final cheama onComplete; pozitia/scala/opacitatea pet-ului coincid EXACT
// cu starea lui din Scene, deci tranzitia e fara salt.

import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Ellipse, Polygon } from 'react-native-svg';

export type IntroCinematicType = 'crash-pod' | 'warp-in' | 'walk-in';

// Trebuie sa coincida cu constantele din Scene.tsx ca pet-ul sa termine fix in
// pozitia de mers.
const PET_LEFT_RATIO = 0.22;

type Props = {
  type: IntroCinematicType;
  petImageUrl: string | null;
  accent: string;
  onComplete: () => void;
};

export function IntroCinematic({ type, petImageUrl, accent, onComplete }: Props) {
  const { width, height } = useWindowDimensions();
  const groundY = height * 0.78;
  const petSize = Math.min(190, height * 0.42);
  const petLeft = width * PET_LEFT_RATIO;
  const petTop = groundY - petSize * 0.92;

  // Garda — onComplete o singura data chiar daca componenta re-renderuieste.
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onComplete();
  };

  if (type === 'crash-pod') {
    return (
      <CrashPod
        width={width}
        height={height}
        groundY={groundY}
        petSize={petSize}
        petLeft={petLeft}
        petTop={petTop}
        accent={accent}
        petImageUrl={petImageUrl}
        onComplete={finish}
      />
    );
  }
  if (type === 'warp-in') {
    return (
      <WarpIn
        petSize={petSize}
        petLeft={petLeft}
        petTop={petTop}
        petImageUrl={petImageUrl}
        onComplete={finish}
      />
    );
  }
  return (
    <WalkIn
      width={width}
      petSize={petSize}
      petLeft={petLeft}
      petTop={petTop}
      petImageUrl={petImageUrl}
      onComplete={finish}
    />
  );
}

function PetImg({ size, url }: { size: number; url: string | null }) {
  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size }} resizeMode="contain" />;
  }
  return (
    <View
      style={{ width: size, height: size, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: size / 2 }}
    />
  );
}

// =====================================================================
// crash-pod
// =====================================================================
function CrashPod({
  width,
  height,
  groundY,
  petSize,
  petLeft,
  petTop,
  accent,
  petImageUrl,
  onComplete,
}: {
  width: number;
  height: number;
  groundY: number;
  petSize: number;
  petLeft: number;
  petTop: number;
  accent: string;
  petImageUrl: string | null;
  onComplete: () => void;
}) {
  // 0→1 caderea capsulei.
  const fall = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const dust = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const podOpacity = useRef(new Animated.Value(1)).current;
  // Pet emerge: 0 (ascuns, jos) → 1 (in picioare).
  const emerge = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // 1. Caderea capsulei (~1.1s).
      Animated.timing(fall, {
        toValue: 1,
        duration: 1100,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      // 2. Impact — flash + shake + praf, simultan.
      Animated.parallel([
        Animated.sequence([
          Animated.timing(flash, { toValue: 0.9, duration: 70, useNativeDriver: true }),
          Animated.timing(flash, { toValue: 0, duration: 350, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(shake, { toValue: 1, duration: 50, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0.6, duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0, duration: 90, useNativeDriver: true }),
        ]),
        Animated.timing(dust, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      // 3. Pet-ul se ridica din epava + capsula se estompeaza.
      Animated.parallel([
        Animated.timing(podOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
        Animated.timing(emerge, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(200),
    ]).start(onComplete);
  }, []);

  // Capsula: de la sus-dreapta spre punctul de impact (petLeft, groundY).
  const podStartX = width * 0.92;
  const podStartY = -90;
  const podX = fall.interpolate({ inputRange: [0, 1], outputRange: [podStartX, petLeft] });
  const podY = fall.interpolate({ inputRange: [0, 1], outputRange: [podStartY, groundY - 30] });
  const podRot = fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '220deg'] });
  const podScale = fall.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  // Dara de foc — vizibila doar in timpul caderii.
  const trailOpacity = fall.interpolate({ inputRange: [0, 0.2, 0.9, 1], outputRange: [0, 0.9, 0.9, 0] });

  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-12, 12] });

  const dustScale = dust.interpolate({ inputRange: [0, 1], outputRange: [0.3, 2.2] });
  const dustOpacity = dust.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.7, 0] });

  const emergeY = emerge.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });
  const emergeScale = emerge.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  const POD = 70;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: shakeX }] }]}>
        {/* Capsula in cadere */}
        <Animated.View
          style={{
            position: 'absolute',
            left: -POD / 2,
            top: -POD / 2,
            transform: [{ translateX: podX }, { translateY: podY }, { rotate: podRot }, { scale: podScale }],
            opacity: podOpacity,
          }}
        >
          {/* Dara de foc in spate */}
          <Animated.View style={{ position: 'absolute', left: POD * 0.2, top: -POD * 0.8, opacity: trailOpacity }}>
            <Svg width={POD} height={POD}>
              <Polygon points={`${POD * 0.5},${POD} ${POD * 0.3},0 ${POD * 0.5},${POD * 0.2} ${POD * 0.7},0`} fill="#FFB347" />
              <Polygon points={`${POD * 0.5},${POD} ${POD * 0.4},${POD * 0.2} ${POD * 0.5},${POD * 0.35} ${POD * 0.6},${POD * 0.2}`} fill="#FFE08A" />
            </Svg>
          </Animated.View>
          {/* Corpul capsulei */}
          <Svg width={POD} height={POD}>
            <Ellipse cx={POD / 2} cy={POD / 2} rx={POD * 0.34} ry={POD * 0.44} fill="#3A3A44" />
            <Ellipse cx={POD / 2} cy={POD / 2} rx={POD * 0.24} ry={POD * 0.32} fill="#23232B" />
            {/* Fereastra colorata cu accentul lumii */}
            <Circle cx={POD / 2} cy={POD * 0.42} r={POD * 0.12} fill={accent} />
            <Circle cx={POD / 2} cy={POD * 0.42} r={POD * 0.06} fill="#FFFFFF" opacity={0.8} />
          </Svg>
        </Animated.View>

        {/* Praf la impact */}
        <Animated.View
          style={{
            position: 'absolute',
            left: petLeft - 60,
            top: groundY - 50,
            opacity: dustOpacity,
            transform: [{ scale: dustScale }],
          }}
        >
          <Svg width={120} height={80}>
            <Circle cx={40} cy={50} r={22} fill="rgba(180,160,140,0.8)" />
            <Circle cx={70} cy={42} r={26} fill="rgba(180,160,140,0.8)" />
            <Circle cx={95} cy={52} r={18} fill="rgba(180,160,140,0.8)" />
          </Svg>
        </Animated.View>

        {/* Pet-ul se ridica din epava — termina exact la pozitia de mers */}
        <Animated.View
          style={{
            position: 'absolute',
            left: petLeft - petSize / 2,
            top: petTop,
            width: petSize,
            height: petSize,
            opacity: emerge,
            transform: [{ translateY: emergeY }, { scale: emergeScale }],
          }}
        >
          <PetImg size={petSize} url={petImageUrl} />
        </Animated.View>
      </Animated.View>

      {/* Flash alb la impact — peste shake */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF', opacity: flash }]}
      />
    </View>
  );
}

// =====================================================================
// warp-in
// =====================================================================
function WarpIn({
  petSize,
  petLeft,
  petTop,
  petImageUrl,
  onComplete,
}: {
  petSize: number;
  petLeft: number;
  petTop: number;
  petImageUrl: string | null;
  onComplete: () => void;
}) {
  const glow = useRef(new Animated.Value(0)).current;
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(appear, { toValue: 1, duration: 600, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
      Animated.delay(200),
    ]).start(onComplete);
  }, []);

  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.2] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.6, 0.2] });
  const appearScale = appear.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={{
          position: 'absolute',
          left: petLeft - petSize / 2,
          top: petTop,
          width: petSize,
          height: petSize,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: glowOpacity,
          transform: [{ scale: glowScale }],
        }}
      >
        <View
          style={{
            width: petSize,
            height: petSize,
            borderRadius: petSize / 2,
            backgroundColor: '#FFF6C0',
          }}
        />
      </Animated.View>
      <Animated.View
        style={{
          position: 'absolute',
          left: petLeft - petSize / 2,
          top: petTop,
          width: petSize,
          height: petSize,
          opacity: appear,
          transform: [{ scale: appearScale }],
        }}
      >
        <PetImg size={petSize} url={petImageUrl} />
      </Animated.View>
    </View>
  );
}

// =====================================================================
// walk-in
// =====================================================================
function WalkIn({
  width,
  petSize,
  petLeft,
  petTop,
  petImageUrl,
  onComplete,
}: {
  width: number;
  petSize: number;
  petLeft: number;
  petTop: number;
  petImageUrl: string | null;
  onComplete: () => void;
}) {
  const slide = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
    Animated.sequence([
      Animated.timing(slide, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(150),
    ]).start(onComplete);
  }, []);

  const x = slide.interpolate({ inputRange: [0, 1], outputRange: [-petSize, 0] });
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={{
          position: 'absolute',
          left: petLeft - petSize / 2,
          top: petTop,
          width: petSize,
          height: petSize,
          transform: [{ translateX: x }, { translateY: bobY }],
        }}
      >
        <PetImg size={petSize} url={petImageUrl} />
      </Animated.View>
    </View>
  );
}
