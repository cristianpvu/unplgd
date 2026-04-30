import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getActiveCoCreation } from '../../../src/api/coCreations';
import { colors } from '../../../src/theme/colors';

// Redirect-only: cand se ajunge pe /co-create, trimite imediat fie la sesiunea
// activa (daca exista), fie la flow-ul de start. Nu mai e ecran intermediar.
export default function CoCreateGate() {
  const active = useQuery({ queryKey: ['co-creations', 'active'], queryFn: getActiveCoCreation });

  useEffect(() => {
    if (active.isPending) return;
    const session = active.data?.active;
    if (session) {
      router.replace(`/(app)/co-create/${session.id}`);
    } else {
      router.replace('/(app)/co-create/start');
    }
  }, [active.isPending, active.data]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
