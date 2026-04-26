import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ensureMicPermission,
  isSttAvailable,
  startListening,
  type SttHandle,
} from '../lib/speech';
import { colors } from '../theme/colors';

type Props = {
  // Apelat pentru fiecare rezultat (intermediar + final). isFinal indica ultimul.
  onTranscript: (text: string, isFinal: boolean) => void;
  // Apelat la pornirea sesiunii — chat-ul foloseste asta sa salveze base draft-ul.
  onStart?: () => void;
  disabled?: boolean;
};

export function MicButton({ onTranscript, onStart, disabled }: Props) {
  const [listening, setListening] = useState(false);
  const handleRef = useRef<SttHandle | null>(null);
  // Sesiunea curenta — incrementam la fiecare start, callback-urile verifica
  // sa nu vina dintr-o sesiune veche (events buffered, intarziati pe Android).
  const sessionRef = useRef(0);

  useEffect(() => {
    return () => {
      handleRef.current?.stop();
    };
  }, []);

  async function start() {
    if (!isSttAvailable()) {
      Alert.alert(
        'STT indisponibil',
        'Modulul nativ nu e legat. Trebuie un prebuild + rebuild al app-ului dupa ce am adaugat plugin-ul.',
      );
      return;
    }
    const granted = await ensureMicPermission();
    if (!granted) {
      Alert.alert(
        'Microfon necesar',
        'Buddy nu te poate auzi fara permisiune. Activeaza microfonul din Setari.',
      );
      return;
    }
    sessionRef.current += 1;
    const sid = sessionRef.current;
    setListening(true);
    onStart?.();
    handleRef.current = await startListening({
      onInterim: (text) => {
        if (sid !== sessionRef.current) return;
        onTranscript(text, false);
      },
      onResult: (text) => {
        if (sid !== sessionRef.current) return;
        setListening(false);
        handleRef.current = null;
        onTranscript(text, true);
        // Marcam sesiunea inchisa ca event-uri intarziate (end, interim
        // buffered) sa fie ignorate complet.
        sessionRef.current += 1;
      },
      onError: (code, message) => {
        if (sid !== sessionRef.current) return;
        setListening(false);
        handleRef.current = null;
        sessionRef.current += 1;
        Alert.alert('Recunoasterea n-a mers', `[${code}] ${message ?? ''}`);
      },
    });
  }

  function stop() {
    handleRef.current?.stop();
    handleRef.current = null;
    setListening(false);
    // Inchide sesiunea: orice event intarziat e ignorat de gard.
    sessionRef.current += 1;
  }

  return (
    <Pressable
      onPress={listening ? stop : start}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        listening && styles.btnActive,
        disabled && styles.btnDisabled,
        pressed && styles.btnPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={listening ? 'Opreste inregistrarea' : 'Vorbeste'}
    >
      {listening ? (
        <View style={styles.pulse} />
      ) : (
        <Text style={styles.icon}>🎤</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  btnDisabled: { opacity: 0.4 },
  btnPressed: { transform: [{ scale: 0.95 }] },
  icon: { fontSize: 20 },
  pulse: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
});
