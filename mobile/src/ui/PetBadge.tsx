import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

// Mic chip rotund cu pet-ul echipat al user-ului. Plasat overlay in coltul
// avatarului sau standalone langa nume. Ringul alb separa pet-ul de avatar
// si-i da look-ul de "badge". Daca user-ul nu are pet (rar — ensureDefaultPet
// face seed la register), randam fallback un emoji 🐾.

export type PetBadgeProps = {
  imageUrl: string | null;
  size?: number;
  // Cand true, ataseaza umbra subtila — folosit pe overlay deasupra avatarelor.
  withShadow?: boolean;
};

export function PetBadge({ imageUrl, size = 28, withShadow }: PetBadgeProps) {
  const ringWidth = Math.max(2, Math.round(size * 0.08));
  const inner = size - ringWidth * 2;
  return (
    <View
      style={[
        styles.ring,
        withShadow && styles.shadow,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ringWidth,
        },
      ]}
    >
      <View
        style={[
          styles.inner,
          {
            width: inner,
            height: inner,
            borderRadius: inner / 2,
          },
        ]}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: inner, height: inner }}
            resizeMode="contain"
          />
        ) : (
          <Text style={[styles.fallback, { fontSize: inner * 0.6 }]}>🐾</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inner: {
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  shadow: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
  },
  fallback: {
    color: colors.textMuted,
  },
});
