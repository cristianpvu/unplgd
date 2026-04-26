import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { register } from '../../src/api/auth';
import { ApiError } from '../../src/api/client';
import { useAuth } from '../../src/lib/auth';
import { Button } from '../../src/ui/Button';
import { TextField } from '../../src/ui/TextField';
import { colors } from '../../src/theme/colors';

function isValidBirthDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

export default function Register() {
  const { signIn } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: register,
    onSuccess: async ({ token }) => {
      await signIn(token);
      router.replace('/(app)/pet-intro');
    },
    onError: (e: unknown) => {
      setError(e instanceof ApiError ? e.message : 'Ceva nu a mers. Incearca din nou.');
    },
  });

  function submit() {
    setError(null);
    if (!name.trim() || !email.trim() || !password || !birthDate) {
      setError('Completeaza toate campurile');
      return;
    }
    if (name.trim().length < 2) {
      setError('Numele trebuie sa aiba minim 2 caractere');
      return;
    }
    if (password.length < 8) {
      setError('Parola trebuie sa aiba minim 8 caractere');
      return;
    }
    if (!isValidBirthDate(birthDate)) {
      setError('Data de nastere: format AAAA-LL-ZZ (ex: 2015-04-21)');
      return;
    }
    mutation.mutate({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      birthDate,
    });
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

          <Text style={styles.title}>Sa facem cunostinta! 🎉</Text>
          <Text style={styles.subtitle}>Trebuie sa ai intre 6 si 14 ani ca sa te joci</Text>

          <View style={styles.form}>
            <TextField
              label="Numele tau"
              value={name}
              onChangeText={setName}
              placeholder="Cum te cheama?"
              autoCapitalize="words"
            />
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="nume@exemplu.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <TextField
              label="Parola"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Minim 8 caractere"
              textContentType="newPassword"
            />
            <TextField
              label="Data nasterii"
              value={birthDate}
              onChangeText={setBirthDate}
              placeholder="AAAA-LL-ZZ"
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
              maxLength={10}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Button label="Creeaza cont" onPress={submit} loading={mutation.isPending} />
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
