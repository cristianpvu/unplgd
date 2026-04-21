import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/lib/auth';
import { colors } from '../src/theme/colors';

export default function Index() {
  const { token, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (token) {
      router.replace('/(app)');
    } else {
      router.replace('/(auth)/welcome');
    }
  }, [ready, token]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
