import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { presence } from '../../src/ble/presence';
import { requestBlePermissions } from '../../src/ble/permissions';
import { CoWalkToast } from '../../src/ble/CoWalkToast';
import { colors } from '../../src/theme/colors';

export default function AppLayout() {
  const { token, ready } = useAuth();

  useEffect(() => {
    if (ready && !token) {
      router.replace('/(auth)/welcome');
    }
  }, [ready, token]);

  // Auto-start presence engine cand user-ul e logat. Co-walk-ul detecteaza
  // prietenii in apropiere fara sa apese nimic — engine-ul ruleaza pe toata
  // viata sesiunii. La logout / unmount se opreste curat (advertise, scan,
  // pedometer eliberate).
  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const perm = await requestBlePermissions();
        if (cancelled) return;
        if (perm !== 'granted') {
          // eslint-disable-next-line no-console
          console.warn('[layout] BLE permission not granted:', perm);
          return;
        }
        await presence.start();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[layout] presence start failed:', e);
      }
    })();
    return () => {
      cancelled = true;
      void presence.stop();
    };
  }, [ready, token]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
      <CoWalkToast />
    </View>
  );
}
