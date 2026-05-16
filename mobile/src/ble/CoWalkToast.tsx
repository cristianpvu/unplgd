import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCoWalkEvents } from './usePresence';
import type { CoWalkEvent } from './presence';
import { colors } from '../theme/colors';

// Toast in-app pentru co-walk events: completed (XP) sau failed (anti-cheat
// nu a trecut). Asculta din socket prin engine. Auto-hide dupa 4.5s (success)
// / 6s (failed, mesaj mai lung). Tap → deschide Nearby.

type ToastData =
  | {
      kind: 'completed';
      id: number;
      name: string;
      durationMin: number;
      squadSize: number;
      isMe: boolean;
    }
  | {
      kind: 'failed';
      id: number;
      reason: 'steps' | 'rssi_static' | 'rssi_samples';
      steps: number;
      stepsRequired: number;
    };

export function CoWalkToast() {
  const qc = useQueryClient();
  const [data, setData] = useState<ToastData | null>(null);
  const idRef = useRef(0);
  const translateY = useRef(new Animated.Value(-220)).current;

  const onEvent = useCallback(
    (e: CoWalkEvent) => {
      if (e.type === 'completed') {
        // Cand vine event pentru mine, refresh-uim cache-ul XP/level (server-ul
        // a actualizat user-ul). Altfel UI-ul ramane stale.
        if (e.isMe) qc.invalidateQueries({ queryKey: ['me'] });
        setData({
          kind: 'completed',
          id: ++idRef.current,
          name: e.name,
          durationMin: Math.max(1, Math.floor(e.durationSec / 60)),
          squadSize: e.squadSize,
          isMe: e.isMe,
        });
      } else if (e.type === 'failed') {
        setData({
          kind: 'failed',
          id: ++idRef.current,
          reason: e.reason,
          steps: e.steps,
          stepsRequired: e.stepsRequired,
        });
      } else if (e.type === 'tick') {
        // XP-ul user-ului a crescut server-side — invalidate cache 'me' ca
        // UI-ul (home, avatar, level) sa reflecte. Nu afisam toast — tick-ul
        // e per minut, ar fi spam. Progress card-ul din nearby afiseaza
        // counterul singur.
        qc.invalidateQueries({ queryKey: ['me'] });
      }
    },
    [qc],
  );
  useCoWalkEvents(onEvent);

  useEffect(() => {
    if (!data) return;
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();
    // Fail are mesaj mai lung — lasam mai mult timp.
    const dwellMs = data.kind === 'failed' ? 6000 : 4500;
    const hideId = setTimeout(() => {
      Animated.timing(translateY, {
        toValue: -220,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setData(null));
    }, dwellMs);
    return () => clearTimeout(hideId);
  }, [data, translateY]);

  if (!data) return null;

  const { bg, emoji, title, sub } = renderToast(data);

  return (
    <Animated.View
      style={[styles.wrap, { transform: [{ translateY }] }]}
      pointerEvents="box-none"
    >
      <SafeAreaView edges={['top']} pointerEvents="box-none">
        <Pressable
          onPress={() => router.push('/(app)/nearby')}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: bg },
            pressed && styles.cardPressed,
          ]}
        >
          <Text style={styles.emoji}>{emoji}</Text>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.sub} numberOfLines={2}>
              {sub}
            </Text>
          </View>
        </Pressable>
      </SafeAreaView>
    </Animated.View>
  );
}

function renderToast(data: ToastData): {
  bg: string;
  emoji: string;
  title: string;
  sub: string;
} {
  if (data.kind === 'completed') {
    return {
      bg: data.isMe ? colors.success : colors.accent,
      emoji: data.isMe ? '🎉' : '👏',
      title: data.isMe
        ? `Co-walk reusit cu ${data.name}!`
        : `${data.name} a primit XP din co-walk!`,
      sub: data.isMe
        ? `${data.durationMin} min · squad ${data.squadSize} · XP acordat`
        : `${data.durationMin} min · faceti parte din acelasi squad`,
    };
  }
  // Mesaje friendly pentru copii — explica ce a lipsit, fara cifre concrete
  // (pedometrul Android/iOS raporteaza diferit; cifrele exacte deruteaza).
  const subByReason: Record<typeof data.reason, string> = {
    steps: 'Nu ati mers destul. Plimbati-va impreuna, nu va opriti pe loc.',
    rssi_static: 'Telefoanele au stat prea aproape, fara miscare. Mergeti impreuna!',
    rssi_samples: 'Semnalul Bluetooth a fost prea slab. Tine telefoanele aproape.',
  };
  return {
    bg: colors.danger,
    emoji: '⏱️',
    title: 'Sesiune anulata',
    sub: subByReason[data.reason],
  };
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 12,
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  emoji: { fontSize: 32 },
  body: { flex: 1, gap: 2 },
  title: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  sub: { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: '700' },
});
