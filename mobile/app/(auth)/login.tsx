import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { login } from '../../src/api/auth';
import { ApiError } from '../../src/api/client';
import { useAuth } from '../../src/lib/auth';
import { Button } from '../../src/ui/Button';
import { TextField } from '../../src/ui/TextField';
import { colors } from '../../src/theme/colors';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: async ({ token }) => {
      await signIn(token);
      router.replace('/(app)');
    },
    onError: (e: unknown) => {
      setError(e instanceof ApiError ? e.message : 'Ceva nu a mers. Incearca din nou.');
    },
  });

  function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Completeaza toate campurile');
      return;
    }
    mutation.mutate({ email: email.trim().toLowerCase(), password });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
              <Text style={styles.back}>←</Text>
            </Pressable>
          </View>

          <Text style={styles.title}>Bine ai revenit! 👋</Text>
          <Text style={styles.subtitle}>Continua aventura cu mascota ta</Text>

          <View style={styles.form}>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="nume@exemplu.com"
              textContentType="emailAddress"
            />
            <TextField
              label="Parola"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Minim 8 caractere"
              textContentType="password"
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Button label="Intra in cont" onPress={submit} loading={mutation.isPending} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  headerRow: { marginBottom: 24 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  back: { color: colors.text, fontSize: 22, fontWeight: '700' },
  title: { color: colors.text, fontSize: 32, fontWeight: '800' },
  subtitle: { color: colors.text, marginTop: 6, marginBottom: 32, fontSize: 15, opacity: 0.7, fontWeight: '500' },
  form: { gap: 16 },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: colors.dangerBg,
    padding: 12,
    borderRadius: 12,
    textAlign: 'center',
  },
});
