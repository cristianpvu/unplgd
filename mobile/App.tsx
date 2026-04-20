import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import NfcManager, { Ndef, NfcTech, TagEvent } from 'react-native-nfc-manager';

type NfcSupport = 'checking' | 'unsupported' | 'disabled' | 'ready';

export default function App() {
  const [support, setSupport] = useState<NfcSupport>('checking');
  const [scanning, setScanning] = useState(false);
  const [tag, setTag] = useState<TagEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const supported = await NfcManager.isSupported();
        if (!supported) {
          setSupport('unsupported');
          return;
        }
        await NfcManager.start();
        if (Platform.OS === 'android') {
          const enabled = await NfcManager.isEnabled();
          setSupport(enabled ? 'ready' : 'disabled');
        } else {
          setSupport('ready');
        }
      } catch (e) {
        setSupport('unsupported');
        setError(String(e));
      }
    })();

    return () => {
      NfcManager.cancelTechnologyRequest().catch(() => {});
    };
  }, []);

  async function scan() {
    setError(null);
    setTag(null);
    setScanning(true);
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: 'Apropie cardul NFC de telefon',
      });
      const detected = await NfcManager.getTag();
      setTag(detected);
    } catch (e: any) {
      if (e?.message && !/cancelled/i.test(e.message)) {
        setError(e.message);
      }
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => {});
      setScanning(false);
    }
  }

  function decodeNdefText(tag: TagEvent | null): string | null {
    const records = tag?.ndefMessage;
    if (!records || records.length === 0) return null;
    try {
      const bytes = records[0].payload;
      return Ndef.text.decodePayload(Uint8Array.from(bytes));
    } catch {
      return null;
    }
  }

  const ndefText = decodeNdefText(tag);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>Unplgd · Test NFC</Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Status NFC</Text>
        <Text style={styles.statusValue}>
          {support === 'checking' && 'Verific...'}
          {support === 'unsupported' && 'Dispozitivul NU suporta NFC'}
          {support === 'disabled' && 'NFC e dezactivat din setari'}
          {support === 'ready' && 'Pregatit'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.button, (support !== 'ready' || scanning) && styles.buttonDisabled]}
        disabled={support !== 'ready' || scanning}
        onPress={scan}
      >
        {scanning ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Scaneaza tag NFC</Text>
        )}
      </TouchableOpacity>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {tag && (
        <ScrollView style={styles.resultBox} contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.resultLabel}>UID</Text>
          <Text style={styles.resultValue}>{tag.id ?? '(necunoscut)'}</Text>

          <Text style={styles.resultLabel}>Tehnologii</Text>
          <Text style={styles.resultValue}>{tag.techTypes?.join(', ') ?? '-'}</Text>

          {ndefText && (
            <>
              <Text style={styles.resultLabel}>Continut NDEF (text)</Text>
              <Text style={styles.resultValue}>{ndefText}</Text>
            </>
          )}

          <Text style={styles.resultLabel}>Raw</Text>
          <Text style={styles.resultMono}>{JSON.stringify(tag, null, 2)}</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1117',
    paddingTop: 80,
    paddingHorizontal: 20,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
  statusCard: {
    backgroundColor: '#1B1F2A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  statusLabel: { color: '#8A93A6', fontSize: 12, marginBottom: 4 },
  statusValue: { color: '#fff', fontSize: 16, fontWeight: '600' },
  button: {
    backgroundColor: '#5B8DEF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: { backgroundColor: '#2A3142' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorBox: {
    backgroundColor: '#3A1A1F',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: { color: '#FF8A8A' },
  resultBox: {
    backgroundColor: '#1B1F2A',
    borderRadius: 12,
    flex: 1,
  },
  resultLabel: { color: '#8A93A6', fontSize: 12, marginTop: 12, marginBottom: 4 },
  resultValue: { color: '#fff', fontSize: 14 },
  resultMono: {
    color: '#A0E0A0',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 11,
    marginTop: 4,
  },
});
