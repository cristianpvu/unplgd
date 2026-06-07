import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/ui/Button';
import { colors } from '../../src/theme/colors';
import { login, register } from '../../src/api/auth';
import { ApiError } from '../../src/api/client';
import { useAuth } from '../../src/lib/auth';

// Scurtaturi de DEMO/prezentare — intra instant fara formulare.
const DEMO_EMAIL = 'office@dinedroid.com';
const DEMO_PASSWORD = 'parolaparola';

const DEMO_NAMES = ['Andrei', 'Maria', 'Luca', 'Sofia', 'David', 'Ana', 'Mihai', 'Ioana'];

function randomBirthDate(): string {
  const age = 7 + Math.floor(Math.random() * 7); // 7..13, in intervalul 6-14
  const year = new Date().getFullYear() - age;
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function Welcome() {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState<null | 'login' | 'new'>(null);

  async function enter(token: string) {
    await signIn(token);
    router.replace('/(app)');
  }

  // Demo: intra cu contul fix. Daca nu exista inca, il creeaza cu aceeasi parola.
  async function demoLogin() {
    if (busy) return;
    setBusy('login');
    try {
      const { token } = await login({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
      await enter(token);
    } catch {
      try {
        const { token } = await register({
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
          name: 'Demo',
          birthDate: randomBirthDate(),
        });
        await enter(token);
      } catch (e) {
        Alert.alert(
          'Demo login esuat',
          e instanceof ApiError && e.code === 'email_taken'
            ? `Contul ${DEMO_EMAIL} exista cu alta parola. Schimba DEMO_PASSWORD in welcome.tsx.`
            : 'Nu am putut intra. Verifica conexiunea.',
        );
      }
    } finally {
      setBusy(null);
    }
  }

  // Demo: creeaza un cont nou random si intra direct.
  async function demoRegister() {
    if (busy) return;
    setBusy('new');
    try {
      const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const name = DEMO_NAMES[Math.floor(Math.random() * DEMO_NAMES.length)] ?? 'Demo';
      const { token } = await register({
        email: `demo-${tag}@unplgd.test`,
        password: DEMO_PASSWORD,
        name,
        birthDate: randomBirthDate(),
      });
      await enter(token);
    } catch {
      Alert.alert('Demo cont nou esuat', 'Nu am putut crea contul. Verifica conexiunea.');
    } finally {
      setBusy(null);
    }
  }

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

        {/* Scurtaturi discrete de demo/prezentare. */}
        <View style={styles.demoRow}>
          <Pressable onPress={demoLogin} hitSlop={8} disabled={!!busy} style={styles.demoLink}>
            {busy === 'login' ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : (
              <Text style={styles.demoText}>demo · intra</Text>
            )}
          </Pressable>
          <Text style={styles.demoDot}>·</Text>
          <Pressable onPress={demoRegister} hitSlop={8} disabled={!!busy} style={styles.demoLink}>
            {busy === 'new' ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : (
              <Text style={styles.demoText}>demo · cont nou</Text>
            )}
          </Pressable>
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

  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
    minHeight: 20,
  },
  demoLink: { paddingVertical: 4, paddingHorizontal: 6 },
  demoText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.6,
    letterSpacing: 0.3,
  },
  demoDot: { color: colors.textMuted, opacity: 0.4 },
});
