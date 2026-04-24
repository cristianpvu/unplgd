import { useEffect, useRef } from 'react';
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

// Blink: tinem ochii inchisi ~140ms, apoi reluam la interval random intre
// 2.5s si 5s. Random-ul evita sincronizarea perceputa la mai multe avataruri
// pe ecran (de ex lista prieteni).
const BLINK_HOLD = 140;
const BLINK_MIN_GAP = 2500;
const BLINK_MAX_GAP = 5000;

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

export function AvatarHead({ svg, svgBlink, height = 220, style, animate = true }: Props) {
  const width = Math.round(height * (ASPECT_W / ASPECT_H));
  const bobAmplitude = Math.max(2, Math.round(height * BOB_AMPLITUDE_RATIO));
  const bob = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate || !svg) return;
    const loop = Animated.loop(
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
    loop.start();
    return () => loop.stop();
  }, [animate, svg, bob]);

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
}
