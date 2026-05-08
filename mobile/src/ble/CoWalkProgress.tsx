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

function FootstepsIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.25033 5.5C9.25033 4.72325 9.1026 3.99803 8.80501 3.49414C8.53284 3.03327 8.14 2.7501 7.50033 2.75C6.31334 2.75 5.40872 3.38188 4.764 4.38574C4.1086 5.40629 3.76415 6.76197 3.75033 8.00781C3.73675 9.13913 3.95804 9.92572 4.2054 10.7324C4.45515 11.5469 4.75033 12.4311 4.75033 13.6201V16C4.75033 16.3315 4.88212 16.6494 5.11654 16.8838C5.35094 17.1181 5.66888 17.25 6.00033 17.25C6.33173 17.2499 6.64977 17.1181 6.88411 16.8838C7.11843 16.6494 7.25033 16.3314 7.25033 16V14.1797C7.25039 12.5185 7.80123 11.0035 8.29329 9.62207C8.79926 8.20156 9.25033 6.90562 9.25033 5.5ZM10.7503 5.5C10.7503 7.20425 10.2004 8.73809 9.70638 10.125C9.19851 11.5508 8.75039 12.8212 8.75033 14.1797V16C8.75033 16.7293 8.46028 17.4286 7.94466 17.9443C7.42902 18.46 6.72955 18.7499 6.00033 18.75C5.27098 18.75 4.57074 18.4601 4.05501 17.9443C3.53949 17.4286 3.25033 16.7292 3.25033 16V13.6201C3.25033 12.6893 3.0295 12.0132 2.77181 11.1729C2.51173 10.3247 2.23393 9.35965 2.25033 7.99121C2.26667 6.51737 2.66693 4.87338 3.5013 3.57422C4.34659 2.25822 5.67745 1.25 7.50033 1.25C8.73028 1.25011 9.58677 1.86747 10.097 2.73145C10.5818 3.55251 10.7503 4.57684 10.7503 5.5Z"
        fill={colors.text}
      />
      <Path
        d="M15.25 20V18.1797C15.2499 16.8212 14.8018 15.5508 14.2939 14.125C13.7999 12.7381 13.25 11.2043 13.25 9.5C13.25 8.57679 13.4184 7.55254 13.9033 6.73145C14.4136 5.86739 15.2699 5.25 16.5 5.25C18.3229 5.25 19.6537 6.25815 20.499 7.57422C21.3334 8.87338 21.7336 10.5174 21.75 11.9912L21.7432 12.4854C21.6974 13.5987 21.4561 14.4306 21.2285 15.1729C20.9708 16.0132 20.75 16.6893 20.75 17.6201V20C20.75 20.7293 20.4601 21.4286 19.9443 21.9443C19.4286 22.4601 18.7293 22.75 18 22.75C17.2706 22.75 16.5714 22.4601 16.0557 21.9443C15.5399 21.4286 15.25 20.7293 15.25 20ZM14.75 9.5C14.75 10.9056 15.2001 12.2016 15.706 13.6221C16.1981 15.0035 16.7499 16.5185 16.75 18.1797V20C16.75 20.3315 16.8818 20.6494 17.1162 20.8838C17.3506 21.1182 17.6685 21.25 18 21.25C18.3315 21.25 18.6494 21.1182 18.8838 20.8838C19.1182 20.6494 19.25 20.3315 19.25 20V17.6201C19.25 16.4311 19.5442 15.5469 19.7939 14.7324C20.0413 13.9257 20.2636 13.1402 20.25 12.0088C20.2362 10.763 19.8917 9.40627 19.2363 8.38574C18.5916 7.38188 17.687 6.75 16.5 6.75C15.8601 6.75 15.4665 7.03319 15.1943 7.49414C14.8969 7.99802 14.75 8.72339 14.75 9.5Z"
        fill={colors.text}
      />
      <Path
        d="M20 16.25C20.4142 16.25 20.75 16.5858 20.75 17C20.75 17.4142 20.4142 17.75 20 17.75H16C15.5858 17.75 15.25 17.4142 15.25 17C15.25 16.5858 15.5858 16.25 16 16.25H20Z"
        fill={colors.text}
      />
      <Path
        d="M7.99999 12.25C8.41421 12.25 8.74999 12.5858 8.74999 13C8.74999 13.4142 8.41421 13.75 7.99999 13.75H3.99999C3.58578 13.75 3.24999 13.4142 3.24999 13C3.24999 12.5858 3.58578 12.25 3.99999 12.25H7.99999Z"
        fill={colors.text}
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
