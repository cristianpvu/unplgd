import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getMe } from '../../src/api/me';
import { useAuth } from '../../src/lib/auth';
import { Button } from '../../src/ui/Button';
import { colors } from '../../src/theme/colors';

export default function Home() {
  const { signOut } = useAuth();
  const { data: me, isPending, error } = useQuery({ queryKey: ['me'], queryFn: getMe });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.hello}>Salut{me ? `, ${me.name}` : ''}</Text>
          <Text style={styles.subtitle}>Bine ai venit in Unplgd</Text>
        </View>

        <View style={styles.card}>
          {isPending && <ActivityIndicator color={colors.accent} />}
          {error && <Text style={styles.errorText}>Nu am putut incarca profilul</Text>}
          {me && (
            <>
              <View style={styles.row}>
                <Text style={styles.stat}>Level {me.level}</Text>
                <Text style={styles.xp}>{me.xp} XP</Text>
              </View>
              <Text style={styles.placeholder}>
                Aici va aparea mascota ta si prietenii. Vine in curand.
              </Text>
            </>
          )}
        </View>

        <Button label="Iesi din cont" variant="secondary" onPress={signOut} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: 24, gap: 24 },
  header: { gap: 4 },
  hello: { color: colors.text, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: 14 },
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  stat: { color: colors.text, fontSize: 32, fontWeight: '700' },
  xp: { color: colors.accent, fontSize: 18, fontWeight: '600' },
  placeholder: { color: colors.textMuted, textAlign: 'center' },
  errorText: { color: colors.danger },
});
