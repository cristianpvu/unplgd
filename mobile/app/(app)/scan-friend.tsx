import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { scanFriend, type ScanFriendResponse } from '../../src/api/bracelet';
import { ApiError } from '../../src/api/client';
import { cancelTagRead, isNfcAvailable, readTagUid } from '../../src/lib/nfc';
import { Button } from '../../src/ui/Button';
import { colors } from '../../src/theme/colors';

export default function ScanFriend() {
  const qc = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [nfcAvailable, setNfcAvailable] = useState<boolean | null>(null);
  const [result, setResult] = useState<ScanFriendResponse | null>(null);

  useEffect(() => {
    isNfcAvailable().then(setNfcAvailable);
    return () => {
      cancelTagRead();
    };
  }, []);

  const scan = useMutation({
    mutationFn: (uid: string) => scanFriend(uid),
    onSuccess: (r) => {
      setResult(r);
      // Refresh me + friends — user-ul a primit XP, posibil level up.
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['friends'] });
    },
    onError: (err: any) => {
      const msg =
        err instanceof ApiError && err.code === 'bracelet_not_found'
          ? 'Bratara aceasta nu e inregistrata. Cere prietenului tau sa o lege intai.'
          : err instanceof ApiError && err.code === 'self_scan'
            ? 'Asta e bratara ta!'
            : err instanceof ApiError && err.code === 'rate_limited'
              ? 'Prea multe scanari. Asteapta un minut.'
              : err?.message ?? 'Scanare esuata';
      Alert.alert('Hopa', msg);
    },
  });

  async function startScan() {
    setResult(null);
    setScanning(true);
    try {
      const uid = await readTagUid({ alertMessage: 'Apropie bratara prietenului de iPhone' });
      scan.mutate(uid);
    } catch (e: any) {
      if (e?.message && !/cancel/i.test(e.message)) {
        Alert.alert('Scanare esuata', 'Tine bratara aproape de spatele telefonului si reincearca.');
      }
    } finally {
      setScanning(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Scaneaza prieten</Text>
          <View style={{ width: 44 }} />
        </View>

        {result ? (
          <View style={styles.resultBox}>
            <Text style={styles.bigIcon}>{result.friendshipCreated ? '🎉' : '👋'}</Text>
            <Text style={styles.resultTitle}>
              {result.friendshipCreated
                ? `${result.friend.name} e prieten nou!`
                : `Salut, ${result.friend.name}!`}
            </Text>
            <Text style={styles.resultSubtitle}>
              {result.friendshipCreated
                ? 'Ati primit amandoi 100 XP pentru prima intalnire.'
                : result.interactionCreated
                  ? 'V-ati intalnit azi — 20 XP pentru fiecare!'
                  : 'V-ati intalnit deja azi. Reveniti maine pentru XP nou.'}
            </Text>
            <View style={styles.actionsRow}>
              <Button label="Mai scaneaza unul" onPress={() => setResult(null)} />
              <Button label="Inapoi acasa" variant="secondary" onPress={() => router.back()} />
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.title}>Apropie telefonul de bratara</Text>
            <Text style={styles.subtitle}>
              {nfcAvailable === false
                ? 'NFC-ul nu e disponibil pe acest telefon. Verifica setarile.'
                : 'Pune spatele telefonului langa bratara prietenului tau ca sa va legati conturile.'}
            </Text>

            <View style={styles.illustration}>
              <Text style={styles.bigIcon}>📡</Text>
              {scanning && (
                <View style={styles.scanningRow}>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={styles.scanningText}>Caut bratara...</Text>
                </View>
              )}
            </View>

            <Button
              label={
                scan.isPending
                  ? 'Se trimite…'
                  : scanning
                    ? 'Anuleaza'
                    : 'Scaneaza'
              }
              onPress={() => {
                if (scanning) {
                  cancelTagRead();
                  setScanning(false);
                } else {
                  startScan();
                }
              }}
              disabled={nfcAvailable === false || scan.isPending || nfcAvailable === null}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: 24, gap: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { color: colors.text, fontSize: 22, fontWeight: '700' },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.text, fontSize: 15, opacity: 0.7, fontWeight: '500', lineHeight: 22 },
  illustration: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  bigIcon: { fontSize: 96 },
  scanningRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scanningText: { color: colors.text, fontWeight: '600' },
  resultBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16 },
  resultTitle: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  resultSubtitle: {
    color: colors.text,
    fontSize: 15,
    opacity: 0.7,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 24,
  },
  actionsRow: { width: '100%', gap: 12 },
});
