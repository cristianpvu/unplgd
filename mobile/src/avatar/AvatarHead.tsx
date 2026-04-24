import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, View, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors } from '../theme/colors';

const ASPECT_W = 762;
const ASPECT_H = 1400;

// Idle bob: translatie verticala subtila pe loop. Scale facea tot corpul sa
// pulseze, asa ca am inlocuit cu un bob vertical de cativa pixeli — citeste
// vizual ca o respiratie naturala fara sa "umfle" avatarul.
const BOB_AMPLITUDE_RATIO = 0.012;
const BOB_PERIOD = 3800;

// Tilt: rotatie pe alt loop, period diferit fata de bob ca sa nu fie sincron
// (ar parea robotic). Amplitudine mica — peste 2° devine clar "swinging".
const TILT_DEGREES = 1.5;
const TILT_PERIOD = 4600;

// Blink: tinem ochii inchisi ~140ms, apoi reluam la interval random intre
// 2.5s si 5s. Random-ul evita sincronizarea perceputa la mai multe avataruri
// pe ecran (de ex lista prieteni).
const BLINK_HOLD = 140;
const BLINK_MIN_GAP = 2500;
const BLINK_MAX_GAP = 5000;

// Bounce: scale punch la tap. Overshoot peste 1 ca sa para o reactie naturala
// (fara overshoot pare ca s-a incarcat ceva, nu ca avatarul s-a "speriat").
const BOUNCE_SCALE = 1.12;

export type AvatarHeadHandle = {
  bounce: () => void;
};

type Props = {
  svg: string | null | undefined;
  // Frame cu ochii inchisi pentru blink. Daca lipseste, sare animatia (ex.
  // preview live in editor unde SVG-ul vine debounced fara blink frame).
  svgBlink?: string | null;
  height?: number;
  style?: ViewStyle;
  // Permite oprirea animatiei in contexte unde nu are sens (preview editor).
  animate?: boolean;
};

export const AvatarHead = forwardRef<AvatarHeadHandle, Props>(function AvatarHead(
  { svg, svgBlink, height = 220, style, animate = true },
  ref,
) {
  const width = Math.round(height * (ASPECT_W / ASPECT_H));
  const bobAmplitude = Math.max(2, Math.round(height * BOB_AMPLITUDE_RATIO));
  const bob = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(1)).current;

  useImperativeHandle(ref, () => ({
    bounce: () => {
      bounce.stopAnimation();
      bounce.setValue(1);
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: BOUNCE_SCALE,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(bounce, {
          toValue: 1,
          friction: 4,
          tension: 140,
          useNativeDriver: true,
        }),
      ]).start();
    },
  }));

  useEffect(() => {
    if (!animate || !svg) return;
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: BOB_PERIOD / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: BOB_PERIOD / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const tiltLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(tilt, {
          toValue: 1,
          duration: TILT_PERIOD / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(tilt, {
          toValue: -1,
          duration: TILT_PERIOD,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(tilt, {
          toValue: 0,
          duration: TILT_PERIOD / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    bobLoop.start();
    tiltLoop.start();
    return () => {
      bobLoop.stop();
      tiltLoop.stop();
    };
  }, [animate, svg, bob, tilt]);

  useEffect(() => {
    if (!animate || !svg || !svgBlink) return;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const schedule = () => {
      const gap = BLINK_MIN_GAP + Math.random() * (BLINK_MAX_GAP - BLINK_MIN_GAP);
      timeout = setTimeout(() => {
        if (cancelled) return;
        Animated.sequence([
          Animated.timing(blink, { toValue: 1, duration: 60, useNativeDriver: true }),
          Animated.delay(BLINK_HOLD),
          Animated.timing(blink, { toValue: 0, duration: 80, useNativeDriver: true }),
        ]).start(() => {
          if (!cancelled) schedule();
        });
      }, gap);
    };

    schedule();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [animate, svg, svgBlink, blink]);

  return (
    <View
      style={[
        {
          width,
          height,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
        },
        style,
      ]}
    >
      {svg ? (
        <Animated.View
          style={{
            width,
            height,
            transform: [
              {
                translateY: bob.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -bobAmplitude],
                }),
              },
              {
                rotate: tilt.interpolate({
                  inputRange: [-1, 1],
                  outputRange: [`-${TILT_DEGREES}deg`, `${TILT_DEGREES}deg`],
                }),
              },
              { scale: bounce },
            ],
          }}
        >
          <SvgXml xml={svg} width={width} height={height} />
          {svgBlink ? (
            <Animated.View
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, top: 0, width, height, opacity: blink }}
            >
              <SvgXml xml={svgBlink} width={width} height={height} />
            </Animated.View>
          ) : null}
        </Animated.View>
      ) : (
        <ActivityIndicator color={colors.accent} />
      )}
    </View>
  );
});
