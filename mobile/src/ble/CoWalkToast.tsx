import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCoWalkEvents } from './usePresence';
import type { CoWalkEvent } from './presence';
import { colors } from '../theme/colors';

// Toast in-app pentru evenimente co-walk completate. Asculta engine-ul global
// si afiseaza un banner animat din top cu XP castigat. Auto-hide dupa 4.5s.
// Tap → deschide Nearby. Inlocuieste Alert.alert (care e blocant si urat).

type ToastData = {
  id: number;
  name: string;
  durationMin: number;
  totalXp: number;
  leveledUp: boolean;
};

export function CoWalkToast() {
  const [data, setData] = useState<ToastData | null>(null);
  const idRef = useRef(0);
  const translateY = useRef(new Animated.Value(-220)).current;

  const onEvent = useCallback((e: CoWalkEvent) => {
    if (e.type !== 'completed') return;
    setData({
      id: ++idRef.current,
      name: e.name,
      durationMin: Math.max(1, Math.floor(e.durationSec / 60)),
      totalXp: e.result.me.amount + (e.result.dailyAwarded ? 20 : 0),
      leveledUp: e.result.me.leveledUp,
    });
  }, []);
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

  return (
    <Animated.View
      style={[styles.wrap, { transform: [{ translateY }] }]}
      pointerEvents="box-none"
    >
      <SafeAreaView edges={['top']} pointerEvents="box-none">
        <Pressable
          onPress={() => router.push('/(app)/nearby')}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <Text style={styles.emoji}>🎉</Text>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={1}>
              Co-walk reusit cu {data.name}!
            </Text>
            <Text style={styles.sub}>
              {data.durationMin} min · +{data.totalXp} XP
              {data.leveledUp ? ' · LEVEL UP!' : ''}
            </Text>
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
    backgroundColor: colors.success,
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
