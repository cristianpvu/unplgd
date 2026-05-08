import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { usePresence } from './usePresence';
import { useCowalkEnabled } from './cowalkPref';
import { colors } from '../theme/colors';

// Buton rotund mic (44×44) cu icoana de pasi. Cand exista co-walk-uri active,
// arata un dot accent in coltul drept-sus, pulsand subtil. Cand feature-ul
// e dezactivat din toggle, arata un dot gri (fara pulse) ca user-ul sa
// observe la prima ochire. Tap → deschide Nearby unde poate (re)activa.

export function CoWalkButton() {
  const { sessions } = usePresence();
  const cowalkEnabled = useCowalkEnabled();
  const hasActive = sessions.length > 0;

  // Pulse pe badge cand sunt sesiuni active. Animatie infinita usoara,
  // se opreste cand nu mai ai nimic activ (Animated.loop cu condition).
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!hasActive) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hasActive, pulse]);

  const badgeScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });

  const accessibilityLabel = !cowalkEnabled
    ? 'Co-walk dezactivat — apasa ca sa activezi'
    : hasActive
      ? `Co-walk activ (${sessions.length})`
      : 'Co-walk';

  return (
    <Pressable
      onPress={() => router.push('/(app)/nearby')}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
    >
      <FootstepsIcon />
      {!cowalkEnabled ? (
        <View style={[styles.badge, styles.badgeOff]} />
      ) : hasActive ? (
        <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]} />
      ) : null}
    </Pressable>
  );
}

// Doua urme de pas (font-style outline) — stilul matcheaza FriendsIcon /
// GearIcon din Home (stroke 2, viewBox 24).
function FootstepsIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      {/* Pas stang (sus) */}
      <Path
        d="M8 3.5c1.5 0 2.5 1.4 2.5 3.2 0 2.2-1.7 3.6-1.7 5.1 0 0.7 0.3 1.2 1 1.2 0.6 0 1-0.4 1-1 0-0.4-0.2-0.7-0.5-0.9"
        stroke={colors.text}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5.5 6.7c-0.4 0-0.7 0.4-0.7 0.9s0.4 0.9 0.9 0.9 0.8-0.4 0.8-0.9"
        stroke={colors.text}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      {/* Pas drept (jos) */}
      <Path
        d="M16 11.5c1.5 0 2.5 1.4 2.5 3.2 0 2.2-1.7 3.6-1.7 5.1 0 0.7 0.3 1.2 1 1.2"
        stroke={colors.text}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.5 14.7c-0.4 0-0.7 0.4-0.7 0.9s0.4 0.9 0.9 0.9 0.8-0.4 0.8-0.9"
        stroke={colors.text}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const BADGE_SIZE = 10;
const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnPressed: { opacity: 0.7 },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeOff: { backgroundColor: colors.textMuted },
});
