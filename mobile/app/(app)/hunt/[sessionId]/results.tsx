import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SvgXml } from 'react-native-svg';
import { getResults } from '../../../../src/api/hunt';
import { colors } from '../../../../src/theme/colors';

const RANK_BG: Record<number, string> = {
  1: '#F1C40F',
  2: '#BDC3C7',
  3: '#CD7F32',
};

const RANK_EMOJI: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

export default function HuntResults() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const qc = useQueryClient();

  const resultsQuery = useQuery({
    queryKey: ['hunt', 'results', sessionId],
    queryFn: () => getResults(sessionId),
    enabled: !!sessionId,
  });

  // Animatie de reveal pentru fiecare echipa, intarziata dupa rank.
  const teams = resultsQuery.data?.teams ?? [];
  const fadeAnims = useRef(teams.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!teams.length) return;
    Animated.stagger(
      300,
      teams.map((_, i) =>
        Animated.timing(fadeAnims[i] ?? new Animated.Value(0), {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ),
    ).start();
  }, [teams.length]);

  if (!sessionId || resultsQuery.isPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (resultsQuery.error || !resultsQuery.data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={styles.error}>Nu am putut incarca rezultatele</Text>
      </SafeAreaView>
    );
  }

  const data = resultsQuery.data;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Rezultate</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {data.myXp && (
          <View style={styles.myXpCard}>
            <Text style={styles.myXpLabel}>Locul {data.myXp.rank}</Text>
            <Text style={styles.myXpAmount}>+{data.myXp.amount} XP</Text>
          </View>
        )}

        {data.teams.map((team, idx) => {
          const fade = fadeAnims[idx] ?? new Animated.Value(1);
          const isPodium = team.rank <= 3;
          return (
            <Animated.View
              key={team.id}
              style={[
                styles.teamCard,
                isPodium && { borderColor: RANK_BG[team.rank], borderWidth: 3 },
                {
                  opacity: fade,
                  transform: [
                    {
                      translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.teamHeader}>
                <Text style={styles.rankEmoji}>{RANK_EMOJI[team.rank] ?? `${team.rank}.`}</Text>
                <Text style={styles.teamName}>{team.name}</Text>
                <Text style={styles.teamScore}>{team.score}</Text>
              </View>
              <Text style={styles.teamMeta}>
                {team.monstersDefeated} monstri invinsi
              </Text>
              <View style={styles.membersRow}>
                {team.members.map((m) => (
                  <View key={m.id} style={styles.memberChip}>
                    {m.avatarSvg ? (
                      <SvgXml xml={m.avatarSvg} width={28} height={28} />
                    ) : (
                      <View style={styles.avatarFallback} />
                    )}
                    <Text style={styles.memberName}>{m.name}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          );
        })}

        <Pressable
          onPress={() => {
            qc.invalidateQueries({ queryKey: ['me'] });
            router.replace('/(app)/');
          }}
          style={({ pressed }) => [styles.doneBtn, pressed && styles.btnPressed]}
        >
          <Text style={styles.doneText}>Inchide</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  headerTitle: { color: colors.text, fontSize: 24, fontWeight: '900' },
  scroll: { padding: 16, gap: 14 },
  error: { color: colors.danger, textAlign: 'center', marginTop: 24 },

  myXpCard: {
    backgroundColor: colors.success,
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  myXpLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', opacity: 0.9 },
  myXpAmount: { color: '#FFFFFF', fontSize: 32, fontWeight: '900' },

  teamCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    gap: 8,
    borderWidth: 0,
  },
  teamHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rankEmoji: { fontSize: 30 },
  teamName: { color: colors.text, fontSize: 20, fontWeight: '900', flex: 1 },
  teamScore: { color: colors.success, fontSize: 22, fontWeight: '900' },
  teamMeta: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },

  membersRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  memberName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  avatarFallback: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.border },

  doneBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  doneText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  btnPressed: { transform: [{ scale: 0.98 }], opacity: 0.85 },
});
