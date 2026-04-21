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
          <Text style={styles.hello}>Salut{me ? `, ${me.name}!` : '!'}</Text>
          <View style={styles.levelPill}>
            <Text style={styles.levelPillText}>Lvl {me?.level ?? '-'}</Text>
          </View>
        </View>

        <View style={styles.scene}>
          <View style={styles.mascot}>
            <Text style={styles.mascotEmoji}>🦝</Text>
          </View>
        </View>

        <View style={styles.card}>
          {isPending && <ActivityIndicator color={colors.accent} />}
          {error && <Text style={styles.errorText}>Nu am putut incarca profilul</Text>}
          {me && (
            <>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{me.xp}</Text>
                  <Text style={styles.statLabel}>XP total</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>0</Text>
                  <Text style={styles.statLabel}>Prieteni</Text>
                </View>
              </View>
              <Text style={styles.placeholder}>
                Mascota si prietenii tai apar aici cand adaugam urmatoarele feature-uri. ✨
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
  container: { flex: 1, padding: 24, gap: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hello: { color: colors.text, fontSize: 26, fontWeight: '800' },
  levelPill: {
    backgroundColor: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  levelPillText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  scene: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascot: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
  },
  mascotEmoji: { fontSize: 110 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 20,
    gap: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border },
  statValue: { color: colors.text, fontSize: 26, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  placeholder: { color: colors.textMuted, textAlign: 'center', fontSize: 13, fontWeight: '500' },
  errorText: { color: colors.danger, textAlign: 'center', fontWeight: '600' },
});
