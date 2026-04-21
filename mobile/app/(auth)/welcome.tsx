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
          <Text style={styles.logo}>Unplgd</Text>
          <Text style={styles.tagline}>Jocul prieteniilor reale</Text>
        </View>

        <View style={styles.actions}>
          <Button label="Creeaza cont" onPress={() => router.push('/(auth)/register')} />
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
  logo: { color: colors.text, fontSize: 56, fontWeight: '800', letterSpacing: -2 },
  tagline: { color: colors.textMuted, fontSize: 16, marginTop: 12 },
  actions: { gap: 12 },
});
