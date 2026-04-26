import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ensureMicPermission,
  startListening,
  type SttHandle,
} from '../lib/speech';
import { colors } from '../theme/colors';

type Props = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
};

export function MicButton({ onTranscript, disabled }: Props) {
  const [listening, setListening] = useState(false);
  const handleRef = useRef<SttHandle | null>(null);

  useEffect(() => {
    return () => {
      handleRef.current?.stop();
    };
  }, []);

  async function start() {
    const granted = await ensureMicPermission();
    if (!granted) {
      Alert.alert(
        'Microfon necesar',
        'Buddy nu te poate auzi fara permisiune. Activeaza microfonul din Setari.',
      );
      return;
    }
    setListening(true);
    handleRef.current = await startListening({
      onResult: (text) => {
        setListening(false);
        handleRef.current?.stop();
        handleRef.current = null;
        onTranscript(text);
      },
      onError: () => {
        setListening(false);
        handleRef.current?.stop();
        handleRef.current = null;
      },
    });
  }

  function stop() {
    handleRef.current?.stop();
    handleRef.current = null;
    setListening(false);
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
