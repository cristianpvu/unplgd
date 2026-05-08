import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCoWalkEvents } from './usePresence';
import type { CoWalkEvent } from './presence';
import { colors } from '../theme/colors';

// Toast in-app pentru co-walk completate. Asculta event-uri din socket prin
// engine — fie XP-ul a venit la mine, fie la alt membru din sesiune. Auto-hide
// dupa 4.5s. Tap → deschide Nearby.

type ToastData = {
  id: number;
  name: string;
  durationMin: number;
  squadSize: number;
  isMe: boolean;
};

export function CoWalkToast() {
  const qc = useQueryClient();
  const [data, setData] = useState<ToastData | null>(null);
  const idRef = useRef(0);
  const translateY = useRef(new Animated.Value(-220)).current;

  const onEvent = useCallback(
    (e: CoWalkEvent) => {
      if (e.type !== 'completed') return;
      // Cand vine event pentru mine, refresh-uim cache-ul XP/level (server-ul
      // a actualizat user-ul). Altfel UI-ul ramane stale.
      if (e.isMe) qc.invalidateQueries({ queryKey: ['me'] });
      setData({
        id: ++idRef.current,
        name: e.name,
        durationMin: Math.max(1, Math.floor(e.durationSec / 60)),
        squadSize: e.squadSize,
        isMe: e.isMe,
      });
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
    const hideId = setTimeout(() => {
      Animated.timing(translateY, {
        toValue: -220,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setData(null));
    }, 4500);
    return () => clearTimeout(hideId);
  }, [data, translateY]);

  if (!data) return null;

  const title = data.isMe
    ? `Co-walk reusit cu ${data.name}!`
    : `${data.name} a primit XP din co-walk!`;
  const sub = data.isMe
    ? `${data.durationMin} min · squad ${data.squadSize} · XP acordat`
    : `${data.durationMin} min · faceti parte din acelasi squad`;

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
            { backgroundColor: data.isMe ? colors.success : colors.accent },
            pressed && styles.cardPressed,
          ]}
        >
          <Text style={styles.emoji}>{data.isMe ? '🎉' : '👏'}</Text>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.sub}>{sub}</Text>
          </View>
        </Pressable>
      </SafeAreaView>
    </Animated.View>
  );
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
