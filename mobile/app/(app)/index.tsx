import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { getMe } from '../../src/api/me';
import { getMyAvatar } from '../../src/api/avatar';
import { ApiError } from '../../src/api/client';
import { useAuth } from '../../src/lib/auth';
import { Button } from '../../src/ui/Button';
import { AvatarHead, type AvatarHeadHandle } from '../../src/avatar/AvatarHead';
import { colors } from '../../src/theme/colors';

export default function Home() {
  const { signOut } = useAuth();
  const { data: me, isPending, error } = useQuery({ queryKey: ['me'], queryFn: getMe });
  const { data: avatar, error: avatarError } = useQuery({
    queryKey: ['avatar'],
    queryFn: getMyAvatar,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });
  const avatarRef = useRef<AvatarHeadHandle>(null);

  // Daca user-ul e logat dar n-a apucat sa-si creeze avatarul (a inchis app-ul
  // pe mijlocul onboarding-ului), il trimitem inapoi in flow-ul de creare.
  useEffect(() => {
    if (avatarError instanceof ApiError && avatarError.status === 404) {
      router.replace('/(app)/avatar-edit?firstTime=1');
    }
  }, [avatarError]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.hello}>Salut{me ? `, ${me.name}!` : '!'}</Text>
          <View style={styles.levelPill}>
            <Text style={styles.levelPillText}>Lvl {me?.level ?? '-'}</Text>
          </View>
        </View>

        <Pressable
          style={styles.scene}
          onPressIn={() => avatarRef.current?.bounce()}
          onPress={() => router.push('/(app)/avatar-edit')}
        >
          <View style={styles.mascot}>
            <AvatarHead ref={avatarRef} svg={avatar?.svg} svgBlink={avatar?.svgBlink} height={260} />
          </View>
          <Text style={styles.tapHint}>Atinge avatarul ca sa il personalizezi →</Text>
        </Pressable>

        <View style={styles.card}>
          {isPending && <ActivityIndicator color={colors.accent} />}
          {error && <Text style={styles.errorText}>Nu am putut incarca profilul</Text>}
          {me && (
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
          )}
        </View>

        <Button label="Scaneaza un prieten" onPress={() => router.push('/(app)/scan-friend')} />
        <Button label="Bratara mea" variant="secondary" onPress={() => router.push('/(app)/link-bracelet')} />
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
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 28,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
  },
  tapHint: {
    color: colors.text,
    opacity: 0.6,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 16,
  },
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
