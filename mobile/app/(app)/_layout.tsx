import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { presence } from '../../src/ble/presence';
import { requestBlePermissions } from '../../src/ble/permissions';
import { CoWalkToast } from '../../src/ble/CoWalkToast';
import { useCowalkEnabled, loadCowalkEnabled } from '../../src/ble/cowalkPref';
import { colors } from '../../src/theme/colors';

export default function AppLayout() {
  const { token, ready } = useAuth();
  const cowalkEnabled = useCowalkEnabled();

  useEffect(() => {
    if (ready && !token) {
      router.replace('/(auth)/welcome');
    }
  }, [ready, token]);

  // Auto-start presence engine cand user-ul e logat SI a optat in (default
  // true). Dezactivarea manuala se face in nearby.tsx (toggle Switch) — acolo
  // chemam si /presence/cowalk/leave inainte sa setam preferinta, ca peer-ii
  // sa primeasca cowalk:left instant. Cleanup-ul de aici doar opreste local.
  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const enabled = await loadCowalkEnabled();
        if (cancelled || !enabled) return;
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
  }, [ready, token, cowalkEnabled]);

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
