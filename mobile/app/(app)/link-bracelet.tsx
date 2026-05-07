import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { provisionBracelet } from '../../src/api/bracelet';
import { ApiError } from '../../src/api/client';
import { cancelTagRead, isNfcAvailable, readTagUid } from '../../src/lib/nfc';
import { Button } from '../../src/ui/Button';
import { colors } from '../../src/theme/colors';

export default function LinkBracelet() {
  const qc = useQueryClient();
  const { firstTime } = useLocalSearchParams<{ firstTime?: string }>();
  const isFirstTime = firstTime === '1';
  const [scanning, setScanning] = useState(false);
  const [nfcAvailable, setNfcAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    isNfcAvailable().then(setNfcAvailable);
    return () => {
      cancelTagRead();
    };
  }, []);

  const provision = useMutation({
    mutationFn: (uid: string) => provisionBracelet(uid),
    onSuccess: (b) => {
      qc.setQueryData(['bracelet'], b);
      if (isFirstTime) router.replace('/(app)');
      else router.back();
    },
    onError: (err: any) => {
      const msg =
        err instanceof ApiError && err.code === 'bracelet_taken'
          ? 'Bratara aceasta e deja legata de alt cont'
          : err?.message ?? 'Nu am putut salva bratara';
      Alert.alert('Eroare', msg);
    },
  });

  async function startScan() {
    setScanning(true);
    try {
      const uid = await readTagUid({ alertMessage: 'Apropie bratara de iPhone' });
      provision.mutate(uid);
    } catch (e: any) {
      // Cancel-ul user-ului si erorile native NFC ajung tot aici — diferentiem
      // doar in mesaj, nu in flow.
      if (e?.message && !/cancel/i.test(e.message)) {
        Alert.alert('Scanare esuata', 'Tine bratara aproape de spatele telefonului si reincearca.');
      }
    } finally {
      setScanning(false);
    }
  }

  function skip() {
    router.replace('/(app)');
  }

  if (nfcAvailable === null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {!isFirstTime && (
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
              <Text style={styles.back}>←</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.title}>Leaga bratara ta</Text>
        <Text style={styles.subtitle}>
          {nfcAvailable
            ? 'Tine bratara NFC aproape de spatele telefonului ca sa o conectam la contul tau. Apoi prietenii tai te pot scana ca sa devina amici.'
            : Platform.OS === 'ios'
              ? 'NFC-ul nu e activ pe iOS in versiunea curenta. Sari peste si revino mai tarziu de pe Android.'
              : 'NFC-ul nu e disponibil pe acest telefon. Verifica setarile sau sari peste.'}
        </Text>

        <View style={styles.illustration}>
          <Text style={styles.bigIcon}>📿</Text>
          {scanning && (
            <View style={styles.scanningRow}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.scanningText}>Apropie bratara...</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Button
            label={
              provision.isPending ? 'Se salveaza…' : scanning ? 'Anuleaza scanarea' : 'Scaneaza bratara'
            }
            onPress={() => {
              if (scanning) {
                cancelTagRead();
                setScanning(false);
              } else {
                startScan();
              }
            }}
            disabled={!nfcAvailable || provision.isPending}
          />
          {isFirstTime && (
            <Button
              label="Sari peste, fac mai tarziu"
              variant="secondary"
              onPress={skip}
              disabled={provision.isPending}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: 24, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { marginBottom: 8 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { color: colors.text, fontSize: 22, fontWeight: '700' },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  subtitle: { color: colors.text, fontSize: 15, opacity: 0.7, fontWeight: '500', lineHeight: 22 },
  illustration: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  bigIcon: { fontSize: 96 },
  scanningRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scanningText: { color: colors.text, fontWeight: '600' },
  actions: { gap: 12 },
});
