import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../../theme/colors';

// 3 puncte care urca-coboara secvential (offset 0/150/300ms). Folosit cand AI-ul
// "se gandeste" — semnalizeaza ca raspunsul vine, fara sa-l opreasca pe copil
// din interactiune. Animatie folosind Animated nativ (useNativeDriver true) ca
// sa nu blocheze JS thread.

export type TypingDotsProps = {
  size?: number;
  color?: string;
  // Cat "saltam" un punct pe verticala. Default scalat dupa size.
  rise?: number;
};

export function TypingDots({
  size = 8,
  color = colors.text,
  rise,
}: TypingDotsProps) {
  const translate = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    const amp = -(rise ?? size * 0.9);
    const duration = 460;
    const animations = translate.map((val, idx) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(idx * 150),
          Animated.timing(val, {
            toValue: amp,
            duration,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          // Pauza scurta sa nu fie lipita de bounce-ul urmator.
          Animated.delay(360 - idx * 150),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => {
      animations.forEach((a) => a.stop());
    };
  }, [rise, size, translate]);

  return (
    <View style={[styles.row, { gap: size * 0.55 }]}>
      {translate.map((val, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: color,
              transform: [{ translateY: val }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {},
});
