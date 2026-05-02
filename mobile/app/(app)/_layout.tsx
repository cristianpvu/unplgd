import { useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { useCoWalkEvents } from '../../src/ble/usePresence';
import type { CoWalkEvent } from '../../src/ble/presence';
import { colors } from '../../src/theme/colors';

export default function AppLayout() {
  const { token, ready } = useAuth();

  useEffect(() => {
    if (ready && !token) {
      router.replace('/(auth)/welcome');
    }
  }, [ready, token]);

  // Toast global pt evenimente co-walk: presence engine merge si in fundal
  // (foreground service) — afisam alerta indiferent pe ce ecran e user-ul.
  const onCoWalkEvent = useCallback((e: CoWalkEvent) => {
    if (e.type !== 'completed') return;
    const totalXp = e.result.me.amount + (e.result.dailyAwarded ? 20 : 0);
    const mins = Math.floor(e.durationSec / 60);
    Alert.alert(
      'Co-walk completat!',
      `Ai mers ${mins} min cu ${e.name}. +${totalXp} XP${e.result.me.leveledUp ? ' · Level up!' : ''}`,
    );
  }, []);
  useCoWalkEvents(onCoWalkEvent);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
