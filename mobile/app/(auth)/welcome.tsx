import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/ui/Button';
import { colors } from '../../src/theme/colors';

export default function Welcome() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.mascotPlaceholder}>
            <Text style={styles.mascotEmoji}>🦝</Text>
          </View>
          <Text style={styles.logo}>Unplgd</Text>
          <Text style={styles.tagline}>Iesi afara. Fa-ti prieteni.{'\n'}Creste-ti mascota!</Text>
        </View>

        <View style={styles.actions}>
          <Button label="Sa incepem!" onPress={() => router.push('/(auth)/register')} />
          <Button
            label="Am deja cont"
            variant="secondary"
            onPress={() => router.push('/(auth)/login')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 48,
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mascotPlaceholder: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
  },
  mascotEmoji: { fontSize: 96 },
  logo: {
    color: colors.text,
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2,
  },
  tagline: {
    color: colors.text,
    fontSize: 18,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
    lineHeight: 26,
    opacity: 0.8,
  },
  actions: { gap: 12 },
});
