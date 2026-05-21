import { useEffect, useRef, useState } from 'react';
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

const RANK_COLOR: Record<number, string> = {
  1: '#F1C40F',
  2: '#BDC3C7',
  3: '#CD7F32',
};

const RANK_EMOJI: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

const RANK_LABEL: Record<number, string> = {
  1: 'CAMPIONI',
  2: 'ARGINT',
  3: 'BRONZ',
};

export default function HuntResults() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const qc = useQueryClient();

  const resultsQuery = useQuery({
    queryKey: ['hunt', 'results', sessionId],
    queryFn: () => getResults(sessionId),
    enabled: !!sessionId,
  });

  const teams = resultsQuery.data?.teams ?? [];
  const fadeAnims = useRef(teams.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!teams.length) return;
    Animated.stagger(
      250,
      teams.map((_, i) =>
        Animated.spring(fadeAnims[i] ?? new Animated.Value(0), {
          toValue: 1,
          friction: 6,
          tension: 110,
          useNativeDriver: true,
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
  const myRank = data.myXp?.rank ?? null;
  const isWinner = myRank === 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header — emoji rain ca decor */}
        <View style={styles.header}>
          <ConfettiEmoji emoji={isWinner ? '🎉' : '🏁'} style={styles.confettiTL} delay={0} />
          <ConfettiEmoji emoji="⭐" style={styles.confettiTR} delay={300} />
          <ConfettiEmoji emoji="✨" style={styles.confettiBL} delay={600} />
          <ConfettiEmoji emoji={isWinner ? '🏆' : '🎯'} style={styles.confettiBR} delay={900} />
          <Text style={styles.headerEmoji}>{isWinner ? '🏆' : '🎯'}</Text>
          <Text style={styles.headerTitle}>{isWinner ? 'Felicitari!' : 'Vanatoarea s-a terminat'}</Text>
          {myRank && (
            <Text style={styles.headerSub}>
              Ai terminat pe {myRank === 1 ? 'locul 1!' : `locul ${myRank}`}
            </Text>
          )}
        </View>

        {/* XP card cu count-up */}
        {data.myXp && <MyXpCard amount={data.myXp.amount} rank={data.myXp.rank} />}

        {/* Podium pt top 3 — vizual: argint stanga, aur centru, bronz dreapta */}
        {data.teams.length >= 1 && (
          <View style={styles.podium}>
            {([2, 1, 3] as const)
              .map((r) => data.teams.find((t) => t.rank === r))
              .filter((t): t is (typeof data.teams)[number] => !!t)
              .map((team) => (
                <PodiumColumn key={team.id} team={team} />
              ))}
          </View>
        )}

        {/* Cards detaliate pt fiecare echipa */}
        {data.teams.map((team, idx) => {
          const fade = fadeAnims[idx] ?? new Animated.Value(1);
          const isPodium = team.rank <= 3;
          const rankColor = RANK_COLOR[team.rank];
          return (
            <Animated.View
              key={team.id}
              style={[
                styles.teamCard,
                isPodium && rankColor ? { borderColor: rankColor, borderWidth: 3 } : null,
                {
                  opacity: fade,
                  transform: [
                    { translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
                    { scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                  ],
                },
              ]}
            >
              <View style={styles.teamHeader}>
                <View style={[styles.teamRankBox, isPodium && rankColor ? { backgroundColor: rankColor } : null]}>
                  <Text style={styles.teamRankText}>
                    {RANK_EMOJI[team.rank] ?? `#${team.rank}`}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.teamName} numberOfLines={1}>
                    {team.name}
                  </Text>
                  <Text style={styles.teamMeta}>
                    🐲 {team.monstersDefeated}{' '}
                    {team.monstersDefeated === 1 ? 'monstru invins' : 'monstri invinsi'}
                  </Text>
                </View>
                <View style={styles.scoreBox}>
                  <Text style={styles.scoreLabel}>scor</Text>
                  <Text style={styles.scoreValue}>{team.score}</Text>
                </View>
              </View>
              <View style={styles.membersRow}>
                {team.members.map((m) => (
                  <View key={m.id} style={styles.memberChip}>
                    <View style={styles.memberAvatar}>
                      {m.avatarSvg ? (
                        <SvgXml xml={m.avatarSvg} width={26} height={26} />
                      ) : (
                        <View style={styles.avatarFallback} />
                      )}
                    </View>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {m.name}
                    </Text>
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
          <Text style={styles.doneEmoji}>🏠</Text>
          <Text style={styles.doneText}>Inchide</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// Card mare cu XP gained — numarul se animeaza de la 0 pana la final.
function MyXpCard({ amount, rank }: { amount: number; rank: number }) {
  const enter = useRef(new Animated.Value(0)).current;
  const count = useRef(new Animated.Value(0)).current;
  const [displayed, setDisplayed] = useState(0);
  const isPodium = rank <= 3;
  const accentColor = isPodium ? RANK_COLOR[rank] ?? colors.success : colors.success;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(enter, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(count, {
        toValue: amount,
        duration: 1200,
        delay: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
    const id = count.addListener(({ value }) => setDisplayed(Math.round(value)));
    return () => count.removeListener(id);
  }, [amount, enter, count]);

  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <Animated.View
      style={[
        styles.myXpCard,
        { backgroundColor: accentColor, opacity: enter, transform: [{ scale }] },
      ]}
    >
      <Text style={styles.myXpRank}>
        {RANK_EMOJI[rank] ?? `Locul #${rank}`}
        {isPodium ? `  ${RANK_LABEL[rank]}` : ''}
      </Text>
      <View style={styles.myXpRow}>
        <Text style={styles.myXpAmount}>+{displayed}</Text>
        <Text style={styles.myXpUnit}>XP</Text>
      </View>
    </Animated.View>
  );
}

// Podium — coloane cu inaltime variabila pt top 3 (1 mai inalt, 2 mediu, 3 scurt).
function PodiumColumn({
  team,
}: {
  team: { id: string; rank: number; name: string; score: number };
}) {
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      friction: 6,
      tension: 90,
      delay: team.rank * 180,
      useNativeDriver: true,
    }).start();
  }, [enter, team.rank]);
  const heights: Record<number, number> = { 1: 120, 2: 90, 3: 70 };
  const color = RANK_COLOR[team.rank] ?? colors.cardAlt;
  const h = heights[team.rank] ?? 60;
  return (
    <Animated.View
      style={[
        styles.podiumCol,
        {
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [h + 20, 0] }),
            },
          ],
        },
      ]}
    >
      <Text style={styles.podiumName} numberOfLines={1}>
        {team.name}
      </Text>
      <Text style={styles.podiumScore}>{team.score}</Text>
      <View style={[styles.podiumBlock, { height: h, backgroundColor: color }]}>
        <Text style={styles.podiumRank}>{RANK_EMOJI[team.rank]}</Text>
      </View>
    </Animated.View>
  );
}

// Emoji care plutesc in header — confetti subtil.
function ConfettiEmoji({
  emoji,
  style,
  delay,
}: {
  emoji: string;
  style: any;
  delay: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 1800,
          delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '12deg'] });
  return (
    <Animated.Text
      style={[style, { transform: [{ translateY }, { rotate }] }]}
      pointerEvents="none"
    >
      {emoji}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 32, gap: 14 },
  error: { color: colors.danger, textAlign: 'center', marginTop: 24 },

  // Header celebratory
  header: {
    backgroundColor: colors.accent,
    borderRadius: 24,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  headerEmoji: { fontSize: 56 },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginTop: 6,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  confettiTL: { position: 'absolute', top: 12, left: 16, fontSize: 26 },
  confettiTR: { position: 'absolute', top: 16, right: 18, fontSize: 24 },
  confettiBL: { position: 'absolute', bottom: 14, left: 22, fontSize: 22 },
  confettiBR: { position: 'absolute', bottom: 10, right: 16, fontSize: 26 },

  // XP card
  myXpCard: {
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  myXpRank: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  myXpRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  myXpAmount: {
    color: '#FFFFFF',
    fontSize: 56,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 4,
  },
  myXpUnit: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // Podium — bars stacked side by side, ordered visual: 2-1-3
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 6,
  },
  podiumCol: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  podiumName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    maxWidth: '100%',
  },
  podiumScore: { color: colors.text, fontSize: 18, fontWeight: '900' },
  podiumBlock: {
    width: '100%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  podiumRank: { fontSize: 28 },

  // Team detail card
  teamCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    gap: 10,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  teamHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  teamRankBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamRankText: { fontSize: 26 },
  teamName: { color: colors.text, fontSize: 18, fontWeight: '900' },
  teamMeta: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  scoreBox: { alignItems: 'flex-end' },
  scoreLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  scoreValue: { color: colors.success, fontSize: 24, fontWeight: '900' },

  membersRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bgAlt,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: 18,
  },
  memberAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  memberName: { color: colors.text, fontSize: 12, fontWeight: '800' },
  avatarFallback: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.border },

  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    borderRadius: 18,
    paddingVertical: 18,
    marginTop: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  doneEmoji: { fontSize: 22 },
  doneText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', letterSpacing: 0.4 },
  btnPressed: { transform: [{ scale: 0.98 }], opacity: 0.88 },
});
