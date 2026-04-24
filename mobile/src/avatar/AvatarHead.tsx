import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, View, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors } from '../theme/colors';

const ASPECT_W = 762;
const ASPECT_H = 1400;

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
        <Animated.View style={{ width, height, transform: [{ scale: bounce }] }}>
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
