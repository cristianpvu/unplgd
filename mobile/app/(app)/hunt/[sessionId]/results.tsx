import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
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
      80,
      teams.map((_, i) =>
        Animated.timing(fadeAnims[i] ?? new Animated.Value(0), {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
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
        {/* Tag mic + titlu mare in stanga */}
        <View style={styles.header}>
          <Text style={[styles.tag, isWinner && { color: RANK_COLOR[1] }]}>
            {isWinner ? 'CAMPION' : 'TERMINAT'}
          </Text>
          <Text style={styles.title}>
            {isWinner ? 'Felicitari!' : 'Vanatoarea s-a terminat'}
          </Text>
          {myRank && (
            <Text style={styles.sub}>
              Ai terminat pe locul {myRank}
              {isWinner ? '!' : ''}
            </Text>
          )}
        </View>

        {/* Podium fizic — 3 trepte cu avatarele echipelor pe ele */}
        {data.teams.length > 0 && (
          <Podium teams={data.teams} myTeamRank={myRank} />
        )}

        {/* XP card cu count-up */}
        {data.myXp && <MyXpCard amount={data.myXp.amount} rank={data.myXp.rank} />}

        {/* Lista echipe — minimalist, rank colorat pe podium */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Clasament</Text>
          {data.teams.map((team, idx) => {
            const fade = fadeAnims[idx] ?? new Animated.Value(1);
            const rankColor = RANK_COLOR[team.rank];
            return (
              <Animated.View
                key={team.id}
                style={[
                  styles.teamRow,
                  {
                    opacity: fade,
                    transform: [
                      {
                        translateY: fade.interpolate({
                          inputRange: [0, 1],
                          outputRange: [10, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View
                  style={[
                    styles.rankBadge,
                    rankColor ? { backgroundColor: rankColor } : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.rankBadgeText,
                      rankColor ? { color: '#FFFFFF' } : null,
                    ]}
                  >
                    {team.rank}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.teamName} numberOfLines={1}>
                    {team.name}
                  </Text>
                  <View style={styles.membersStack}>
                    {team.members.slice(0, 6).map((m, i) => (
                      <View
                        key={m.id}
                        style={[styles.memberAvatar, { marginLeft: i === 0 ? 0 : -8 }]}
                      >
                        {m.avatarSvg ? (
                          <SvgXml xml={m.avatarSvg} width={22} height={22} />
                        ) : (
                          <View style={styles.avatarFallback} />
                        )}
                      </View>
                    ))}
                    <Text style={styles.teamMeta}>
                      {team.monstersDefeated}{' '}
                      {team.monstersDefeated === 1 ? 'monstru' : 'monstri'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.teamScore}>{team.score}</Text>
              </Animated.View>
            );
          })}
        </View>

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

// Podium fizic — 3 trepte cu inaltimi diferite, in ordinea vizuala 2-1-3.
// Pe fiecare treapta randam un cluster de avatare ale membrilor echipei + numele
// echipei + scorul. Treptele intra in scena cu spring stagger de jos in sus
// (3 → 2 → 1), apoi avatarele pop-in dupa.
type PodiumTeam = {
  id: string;
  rank: number;
  name: string;
  score: number;
  members: { id: string; name: string; avatarSvg: string | null; petImageUrl: string | null }[];
};

function Podium({ teams, myTeamRank }: { teams: PodiumTeam[]; myTeamRank: number | null }) {
  // Ordoneaza vizual: 2nd stanga, 1st centru, 3rd dreapta. Daca lipseste o
  // pozitie (mai putin de 3 echipe), o sarim.
  const podiumOrder = ([2, 1, 3] as const)
    .map((r) => teams.find((t) => t.rank === r))
    .filter((t): t is PodiumTeam => !!t);

  return (
    <View style={styles.podiumWrap}>
      {podiumOrder.map((team) => (
        <PodiumStep key={team.id} team={team} mine={myTeamRank === team.rank} />
      ))}
    </View>
  );
}

function PodiumStep({ team, mine }: { team: PodiumTeam; mine: boolean }) {
  // Spring entrance: treptele se urca 3 → 2 → 1. Caracterele intra dupa step.
  const step = useRef(new Animated.Value(0)).current;
  const chars = useRef(new Animated.Value(0)).current;

  const stepDelay = (4 - team.rank) * 200;
  const charsDelay = stepDelay + 350;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(stepDelay),
      Animated.spring(step, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.delay(charsDelay),
      Animated.spring(chars, { toValue: 1, friction: 6, tension: 110, useNativeDriver: true }),
    ]).start();
  }, [step, chars, stepDelay, charsDelay]);

  // Inaltimi trepte clasice + dimensiuni caracter + coronita scalate cu rank-ul.
  const heights: Record<number, number> = { 1: 110, 2: 78, 3: 52 };
  const charSizes: Record<number, { char: number; pet: number; crown: number }> = {
    1: { char: 92, pet: 40, crown: 28 },
    2: { char: 78, pet: 34, crown: 22 },
    3: { char: 70, pet: 30, crown: 20 },
  };
  const stepH = heights[team.rank] ?? 40;
  const sz = charSizes[team.rank] ?? { char: 64, pet: 28, crown: 18 };
  const color = RANK_COLOR[team.rank] ?? colors.cardAlt;

  // Coronita SVG colorata per rank — fiecare caracter de pe podium poarta una.
  const crownSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 28">
    <path d="M4 22 L4 10 L12 16 L20 4 L28 16 L36 10 L36 22 Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.5"/>
    <circle cx="4" cy="8" r="2.5" fill="${color}"/>
    <circle cx="20" cy="2" r="2.5" fill="${color}"/>
    <circle cx="36" cy="8" r="2.5" fill="${color}"/>
  </svg>`;

  const stepTranslateY = step.interpolate({
    inputRange: [0, 1],
    outputRange: [stepH + 30, 0],
  });
  const charsTranslateY = chars.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const charsScale = chars.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  // DiceBear-style avatare au viewBox patrat (head only la 762x762 sau full body
  // compus la 762x1400). Render in container portrait (1:1.4) — daca SVG-ul e
  // full body apare integral, daca e head only apare centrat sus.
  const charW = sz.char;
  const charH = Math.round(sz.char * 1.45);

  // Cu cat sunt mai multi membri intr-o echipa, cu atat caracterele se
  // imbratiseaza mai dens ca sa intre in latimea coloanei (overlap inteligent).
  // 1-2 membri: gap mic; 3+: caracterele se suprapun partial.
  const memberCount = team.members.length;
  const memberOverlap =
    memberCount <= 1 ? 0 : memberCount === 2 ? -Math.round(charW * 0.18) : -Math.round(charW * 0.32);

  return (
    <View style={styles.podiumCol}>
      {/* Caractere full body langa langa pe treapta */}
      <Animated.View
        style={[
          styles.podiumChars,
          {
            opacity: chars,
            transform: [{ translateY: charsTranslateY }, { scale: charsScale }],
          },
        ]}
      >
        <View style={styles.podiumLineup}>
          {team.members.map((m, idx) => (
            <View
              key={m.id}
              style={[
                styles.podiumMember,
                {
                  width: charW,
                  height: charH,
                  marginLeft: idx === 0 ? 0 : memberOverlap,
                  zIndex: team.members.length - idx,
                },
              ]}
            >
              {/* Coronita pe cap, colorata cu rank-ul echipei. */}
              <View style={styles.podiumCrownOnHead}>
                <SvgXml
                  xml={crownSvg}
                  width={sz.crown}
                  height={Math.round(sz.crown * 0.7)}
                />
              </View>
              {m.avatarSvg ? (
                <SvgXml xml={m.avatarSvg} width={charW} height={charH} />
              ) : (
                <View style={[styles.charFallback, { width: charW, height: charH }]} />
              )}
              {/* Pet stand IN FATA caracterului in coltul jos-dreapta — peek
                  out partial ca un sidekick. Absolute pozitionat ca sa nu
                  largeasca containerul caracterului. */}
              {m.petImageUrl && (
                <View
                  style={[
                    styles.podiumPet,
                    {
                      width: sz.pet,
                      height: sz.pet,
                      right: -Math.round(sz.pet * 0.25),
                    },
                  ]}
                >
                  <Image
                    source={{ uri: m.petImageUrl }}
                    style={{ width: sz.pet, height: sz.pet }}
                    resizeMode="contain"
                  />
                </View>
              )}
            </View>
          ))}
        </View>

        <Text style={[styles.podiumTeamName, mine && styles.podiumTeamNameMine]} numberOfLines={1}>
          {team.name}
        </Text>
        <Text style={styles.podiumScore}>{team.score}</Text>
      </Animated.View>

      {/* Treapta */}
      <Animated.View
        style={[
          styles.podiumBlock,
          {
            height: stepH,
            backgroundColor: color,
            transform: [{ translateY: stepTranslateY }],
          },
        ]}
      >
        <Text style={styles.podiumRank}>{team.rank}</Text>
      </Animated.View>
    </View>
  );
}

// Card mare cu XP gained — numarul se animeaza de la 0 pana la final.
function MyXpCard({ amount, rank }: { amount: number; rank: number }) {
  const count = useRef(new Animated.Value(0)).current;
  const [displayed, setDisplayed] = useState(0);
  const isPodium = rank <= 3;
  const accentColor = isPodium ? RANK_COLOR[rank] ?? colors.success : colors.text;

  useEffect(() => {
    Animated.timing(count, {
      toValue: amount,
      duration: 1200,
      delay: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    const id = count.addListener(({ value }) => setDisplayed(Math.round(value)));
    return () => count.removeListener(id);
  }, [amount, count]);

  return (
    <View style={styles.xpCard}>
      <Text style={styles.xpLabel}>XP CASTIGATI</Text>
      <View style={styles.xpRow}>
        <Text style={[styles.xpAmount, { color: accentColor }]}>+{displayed}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 32, gap: 20 },
  error: { color: colors.danger, textAlign: 'center', marginTop: 24 },

  header: { gap: 6, marginTop: 8 },
  tag: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4 },
  sub: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },

  // Podium fizic — 3 trepte cu inaltimi diferite + avatare deasupra
  podiumWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    overflow: 'hidden',
  },
  podiumCol: {
    flex: 1,
    alignItems: 'center',
  },
  podiumChars: {
    alignItems: 'center',
    gap: 2,
    paddingBottom: 4,
  },
  // Crown overlap-uieste varful avatarului — absolute pozitionata in interiorul
  // podiumMember ca sa nu mute layout-ul caracterului in jos.
  podiumCrownOnHead: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    zIndex: 6,
  },
  // Caracterele stau langa-langa, fara crop circular — full body se vede
  // ca pe podium real. Pet-ul sta IN FATA caracterului (absolute), nu langa,
  // ca sa para realmente lipit. Cand sunt multi membri intr-o echipa,
  // caracterele se imbratiseaza cu overlap dinamic per memberCount.
  podiumLineup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  podiumMember: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  charFallback: {
    backgroundColor: colors.cardAlt,
    borderRadius: 8,
  },
  podiumPet: {
    position: 'absolute',
    bottom: 0,
    zIndex: 5,
  },
  podiumTeamName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    maxWidth: 100,
    textAlign: 'center',
    marginTop: 2,
  },
  podiumTeamNameMine: { color: colors.accent },
  podiumScore: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  podiumBlock: {
    width: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  podiumRank: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // XP card minimalist — fundal alb, fara culoare puternica
  xpCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 6,
  },
  xpLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  xpRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  xpAmount: {
    fontSize: 52,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },

  section: { gap: 6 },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  // Team row — compact, fara card-uri masive
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  teamName: { color: colors.text, fontSize: 15, fontWeight: '800' },
  membersStack: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  avatarFallback: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.border },
  teamMeta: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginLeft: 4 },
  teamScore: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },

  doneBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  doneText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  btnPressed: { transform: [{ scale: 0.99 }], opacity: 0.88 },
});
