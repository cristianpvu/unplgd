import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

// Container pentru chips care apar dupa ce naratorul termina de vorbit —
// fade-in si slide up subtil, ca optiunile sa para parte din conversatie.
export function ChipGroup({
  visible,
  children,
}: {
  visible: boolean;
  children: React.ReactNode;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      opacity.setValue(0);
      translateY.setValue(20);
    }
  }, [visible, opacity, translateY]);
  return (
    <Animated.View style={[styles.group, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

// Chip mare pentru optiuni primare (ex. "Cream o poveste"). Variant accent =
// portocaliu plin; secondary = alb glassy. Optional badge cu numar pe partea
// dreapta.
export function BigChip({
  label,
  sub,
  variant,
  badge,
  disabled,
  onPress,
}: {
  label: string;
  sub?: string;
  variant: 'accent' | 'secondary';
  badge?: string | null;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.bigChip,
        variant === 'accent' ? styles.bigChipAccent : styles.bigChipSecondary,
        disabled && styles.bigChipDisabled,
        pressed && !disabled && styles.btnPressed,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.bigChipLabel,
            variant === 'accent' ? styles.lightText : styles.darkText,
          ]}
        >
          {label}
        </Text>
        {sub && (
          <Text
            style={[
              styles.bigChipSub,
              variant === 'accent' ? styles.lightSub : styles.darkSub,
            ]}
          >
            {sub}
          </Text>
        )}
      </View>
      {badge && (
        <View
          style={[
            styles.badge,
            variant === 'accent' ? styles.badgeOnAccent : styles.badgeOnSecondary,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              variant === 'accent' ? styles.darkText : styles.lightText,
            ]}
          >
            {badge}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// Chip mic discret tipic pentru "← Inapoi" / actiuni secundare.
export function PillButton({
  label,
  onPress,
  variant = 'subtle',
}: {
  label: string;
  onPress: () => void;
  variant?: 'subtle' | 'accent';
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [
        styles.pill,
        variant === 'accent' ? styles.pillAccent : styles.pillSubtle,
        pressed && styles.btnPressed,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          variant === 'accent' ? styles.lightText : styles.darkText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { gap: 12 },
  bigChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
    minHeight: 80,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  bigChipAccent: { backgroundColor: colors.accent },
  bigChipSecondary: { backgroundColor: 'rgba(255,255,255,0.92)' },
  bigChipDisabled: { opacity: 0.55 },
  bigChipLabel: { fontSize: 18, fontWeight: '800' },
  bigChipSub: { fontSize: 13, fontWeight: '600', marginTop: 2 },

  badge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  badgeOnAccent: { backgroundColor: '#FFFFFF' },
  badgeOnSecondary: { backgroundColor: colors.accent },
  badgeText: { fontSize: 14, fontWeight: '800' },

  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillSubtle: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderColor: colors.border,
  },
  pillAccent: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pillText: { fontSize: 13, fontWeight: '700' },

  lightText: { color: '#FFFFFF' },
  darkText: { color: colors.text },
  lightSub: { color: 'rgba(255,255,255,0.92)' },
  darkSub: { color: colors.textMuted },
  btnPressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
});
