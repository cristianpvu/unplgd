import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  // Catchphrases-urile speciei (din DB). Daca e gol, folosim FALLBACK.
  phrases: string[];
  petName: string;
  onPress?: () => void;
  // Frecventa aparitiei in milisecunde (random uniform [min, max]).
  minIntervalMs?: number;
  maxIntervalMs?: number;
  // Cat ramane pe ecran fiecare bula.
  visibleMs?: number;
};

const FALLBACK_PHRASES = [
  'Hai sa stam de vorba!',
  'Ti-e dor de mine?',
  'Spune-mi cum a fost azi!',
  'Hei, suntem aici impreuna!',
];

// Bula de mesaj plutitoare deasupra pet-ului. Apare random la fiecare 25-40s
// cu o replica predefinita (catchphrase din DB sau fallback). Dispare singura
// dupa visibleMs. Tap = onPress (de regula deschide chat-ul).
//
// NU foloseste Claude — toate replicile sunt locale, deci e free + offline-ok.
export function PetSpeechBubble({
  phrases,
  petName,
  onPress,
  minIntervalMs = 25_000,
  maxIntervalMs = 40_000,
  visibleMs = 4_000,
}: Props) {
  const [text, setText] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const pool = phrases.length > 0 ? phrases : FALLBACK_PHRASES;

    function scheduleNext(initial = false) {
      const delay = initial
        ? 2_000 // primul mesaj apare repede dupa intrarea pe home
        : minIntervalMs + Math.random() * (maxIntervalMs - minIntervalMs);
      showTimer = setTimeout(() => {
        if (cancelled) return;
        const next = pool[Math.floor(Math.random() * pool.length)] ?? petName;
        setText(next);
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();

        hideTimer = setTimeout(() => {
          if (cancelled) return;
          Animated.timing(opacity, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            if (cancelled) return;
            setText(null);
            scheduleNext(false);
          });
        }, visibleMs);
      }, delay);
    }

    scheduleNext(true);
    return () => {
      cancelled = true;
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [phrases, petName, minIntervalMs, maxIntervalMs, visibleMs, opacity]);

  if (!text) return null;

  return (
    <Animated.View style={[styles.wrap, { opacity }]} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.bubble, pressed && styles.bubblePressed]}
      >
        <Text style={styles.text} numberOfLines={2}>
          {text}
        </Text>
      </Pressable>
      <View style={styles.tail} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  bubble: {
    maxWidth: 180,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  bubblePressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  text: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  tail: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.card,
  },
});
