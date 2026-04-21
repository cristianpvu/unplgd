import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { colors } from '../../src/theme/colors';

export default function AppLayout() {
  const { token, ready } = useAuth();

  useEffect(() => {
    if (ready && !token) {
      router.replace('/(auth)/welcome');
    }
  }, [ready, token]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
