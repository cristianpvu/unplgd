import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Svg, { Path } from 'react-native-svg';
import { provisionBracelet } from '../../src/api/bracelet';
import { ApiError } from '../../src/api/client';
import { cancelTagRead, isNfcAvailable, readTagUid } from '../../src/lib/nfc';
import { Button } from '../../src/ui/Button';
import { BraceletScanAnimation } from '../../src/ui/BraceletScanAnimation';
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

  const active = scanning || provision.isPending;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {!isFirstTime && (
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path d="M15 5l-7 7 7 7" stroke={colors.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          </View>
        )}

        {/* Ilustratie animata de scanare NFC */}
        <View style={styles.stage}>
          <BraceletScanAnimation active={active} enabled={!!nfcAvailable} />
        </View>

        <Text style={styles.title}>Scaneaza bratara</Text>
        <Text style={styles.subtitle}>
          {nfcAvailable
            ? active
              ? 'Apropie bratara de spatele telefonului...'
              : 'Apropie bratara de spatele telefonului.'
            : Platform.OS === 'ios'
              ? 'NFC indisponibil pe iOS acum. Sari peste si revino de pe Android.'
              : 'NFC indisponibil pe acest telefon. Verifica setarile sau sari peste.'}
        </Text>

        <View style={styles.actions}>
          <Button
            label={
              provision.isPending ? 'Se salveaza…' : scanning ? 'Anuleaza' : 'Scaneaza'
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
              label="Mai tarziu"
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
  container: { flex: 1, padding: 24, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { marginBottom: 8 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },

  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Scena orizontala: telefon stanga -> unde -> bratara dreapta.

  title: { color: colors.text, fontSize: 28, fontWeight: '900', textAlign: 'center' },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  actions: { gap: 12, marginTop: 4 },
});
