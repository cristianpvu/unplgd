import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Svg, { Path, SvgXml } from 'react-native-svg';
import { screenTime } from 'screen-time';
import { getScreenTimeLeaderboard, type ScreenTimeEntry } from '../../src/api/screentime';
import { syncScreenTime } from '../../src/lib/screenTimeSync';
import { colors } from '../../src/theme/colors';

type Perm = 'checking' | 'granted' | 'denied' | 'unavailable';

const GOLD = '#FFC94D';
const SILVER = '#CBD2DE';
const BRONZE = '#E5975A';
const MEDAL = [GOLD, SILVER, BRONZE];

function fmt(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function ScreenTimeLeaderboard() {
  const qc = useQueryClient();
  const [perm, setPerm] = useState<Perm>('checking');

  const lbQ = useQuery({
    queryKey: ['screentime', 'leaderboard'],
    queryFn: getScreenTimeLeaderboard,
    refetchInterval: 60 * 1000,
  });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      async function check() {
        if (!screenTime.isAvailable) {
          if (!cancelled) setPerm('unavailable');
          return;
        }
        const ok = await screenTime.hasPermission();
        if (cancelled) return;
        setPerm(ok ? 'granted' : 'denied');
        if (ok) {
          await syncScreenTime();
          if (!cancelled) qc.invalidateQueries({ queryKey: ['screentime', 'leaderboard'] });
        }
      }
      void check();
      const sub = AppState.addEventListener('change', (s) => {
        if (s === 'active') void check();
      });
      return () => {
        cancelled = true;
        sub.remove();
      };
    }, [qc]),
  );

  const data = lbQ.data;
  const lastWeek = data?.lastWeek ?? null;
  const entries = data?.entries ?? [];
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const me = data?.me ?? null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 6l-6 6 6 6"
              stroke={colors.text}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Cel mai putin pe ecran</Text>
          <Text style={styles.subtitle}>Castiga cine sta mai putin pe telefon</Text>
        </View>
        {me && (
          <View style={styles.myRankChip}>
            <Text style={styles.myRankChipText}>#{me.rank}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {lastWeek && (
          <View style={styles.rewardCard}>
            <Text style={styles.rewardEmoji}>🏆</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rewardTitle}>
                Saptamana trecuta: locul {lastWeek.rank} din {lastWeek.groupSize}
              </Text>
              <Text style={styles.rewardSub}>
                +{lastWeek.xpAwarded} XP · media {fmt(lastWeek.avgMinutes)}/zi
              </Text>
            </View>
          </View>
        )}

        {perm === 'unavailable' && (
          <PermCard
            title="Disponibil pe Android"
            body="iOS nu permite citirea timpului pe ecran. Poti urmari clasamentul prietenilor, dar nu poti participa de pe acest telefon."
          />
        )}
        {perm === 'denied' && (
          <PermCard
            title="Activeaza accesul"
            body="Ca sa intri in clasament citim cat stai pe telefon. Afisam doar minutele, nu ce aplicatii folosesti."
            cta="Deschide setarile"
            onPress={() => screenTime.openSettings()}
          />
        )}

        {lbQ.isPending && <ActivityIndicator color={colors.accent} style={{ marginTop: 50 }} />}
        {lbQ.error && <Text style={styles.errorText}>Nu am putut incarca clasamentul</Text>}

        {data && entries.length === 0 && perm !== 'denied' && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Inca nimeni in clasament</Text>
            <Text style={styles.emptyBody}>
              Cand tu si prietenii aveti timpul pe ecran inregistrat, apareti aici. Mai putine
              minute = loc mai bun.
            </Text>
          </View>
        )}

        {top3.length > 0 && (
          <View style={styles.podiumCard}>
            <View style={styles.podiumHalo} pointerEvents="none" />
            <Podium top3={top3} />
          </View>
        )}

        {rest.length > 0 && (
          <View style={styles.list}>
            {rest.map((e) => (
              <Row key={e.userId} entry={e} />
            ))}
          </View>
        )}

        {entries.length > 0 && (
          <Text style={styles.footer}>
            La finalul saptamanii, primii din clasament primesc cel mai mult XP.{'\n'}Mai putin
            ecran = mai mult timp afara. 🌳
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Podium top 3: ordinea vizuala 2 - 1 - 3.
function Podium({ top3 }: { top3: ScreenTimeEntry[] }) {
  const first = top3[0];
  const second = top3[1];
  const third = top3[2];
  return (
    <View style={styles.podium}>
      {second ? <Spot entry={second} place={2} /> : <View style={styles.spot} />}
      {first ? <Spot entry={first} place={1} /> : <View style={styles.spot} />}
      {third ? <Spot entry={third} place={3} /> : <View style={styles.spot} />}
    </View>
  );
}

function Spot({ entry, place }: { entry: ScreenTimeEntry; place: 1 | 2 | 3 }) {
  const ring = MEDAL[place - 1];
  const avatarSize = place === 1 ? 74 : 58;
  const pedestalH = place === 1 ? 70 : place === 2 ? 50 : 36;
  return (
    <View style={styles.spot}>
      {place === 1 && <Text style={styles.crown}>👑</Text>}
      <PodiumAvatar svg={entry.avatarSvg} name={entry.name} size={avatarSize} ring={ring} />
      <Text style={[styles.spotName, entry.isMe && { color: colors.accent }]} numberOfLines={1}>
        {entry.isMe ? 'Tu' : entry.name}
      </Text>
      <Text style={styles.spotTime}>{fmt(entry.avgMinutes)}</Text>
      <View style={[styles.pedestal, { height: pedestalH, backgroundColor: ring }]}>
        <Text style={styles.pedestalRank}>{place}</Text>
      </View>
    </View>
  );
}

function PodiumAvatar({
  svg,
  name,
  size,
  ring,
}: {
  svg: string | null;
  name: string;
  size: number;
  ring: string;
}) {
  const fullHeight = Math.round(size * (1400 / 762));
  return (
    <View
      style={[
        styles.podiumAvatar,
        { width: size, height: size, borderRadius: size / 2, borderColor: ring },
      ]}
    >
      {svg ? (
        <SvgXml xml={svg} width={size} height={fullHeight} />
      ) : (
        <Text style={styles.avatarFallback}>{name.charAt(0).toUpperCase()}</Text>
      )}
    </View>
  );
}

function Row({ entry }: { entry: ScreenTimeEntry }) {
  const size = 38;
  const fullHeight = Math.round(size * (1400 / 762));
  return (
    <View style={[styles.row, entry.isMe && styles.rowMe]}>
      <Text style={styles.rowRank}>{entry.rank}</Text>
      <View style={styles.rowAvatar}>
        {entry.avatarSvg ? (
          <SvgXml xml={entry.avatarSvg} width={size} height={fullHeight} />
        ) : (
          <Text style={styles.avatarFallback}>{entry.name.charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName} numberOfLines={1}>
          {entry.name}
          {entry.isMe ? ' · tu' : ''}
        </Text>
        <Text style={styles.rowMeta}>
          azi {fmt(entry.todayMinutes)} · {entry.daysReported} zile
        </Text>
      </View>
      <Text style={styles.rowAvg}>{fmt(entry.avgMinutes)}</Text>
    </View>
  );
}

function PermCard({
  title,
  body,
  cta,
  onPress,
}: {
  title: string;
  body: string;
  cta?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.permCard}>
      <Text style={styles.permTitle}>{title}</Text>
      <Text style={styles.permBody}>{body}</Text>
      {cta && onPress && (
        <Pressable style={styles.permBtn} onPress={onPress}>
          <Text style={styles.permBtnText}>{cta}</Text>
        </Pressable>
      )}
    </View>
  );
}

const SHADOW = {
  shadowColor: colors.shadow,
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 1,
  shadowRadius: 8,
  elevation: 2,
} as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW,
  },
  title: { fontSize: 19, fontWeight: '900', color: colors.text },
  subtitle: { fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  myRankChip: {
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW,
  },
  myRankChipText: { color: '#fff', fontWeight: '900', fontSize: 14 },

  scroll: { paddingHorizontal: 16, paddingBottom: 36, gap: 14 },

  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.success,
    borderRadius: 18,
    padding: 14,
    marginTop: 2,
    ...SHADOW,
  },
  rewardEmoji: { fontSize: 26 },
  rewardTitle: { color: '#fff', fontWeight: '800', fontSize: 14.5 },
  rewardSub: { color: 'rgba(255,255,255,0.92)', fontSize: 12.5, marginTop: 2 },

  permCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    ...SHADOW,
  },
  permTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  permBody: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  permBtn: {
    marginTop: 4,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  permBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },

  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 18,
    gap: 6,
    ...SHADOW,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  emptyBody: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },

  // Podium intr-un card alb, ca sa fie in tema cu restul app-ului.
  podiumCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    paddingTop: 16,
    paddingHorizontal: 8,
    overflow: 'hidden',
    ...SHADOW,
  },
  podiumHalo: {
    position: 'absolute',
    top: -70,
    alignSelf: 'center',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.bgAlt,
  },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 10,
  },
  spot: { flex: 1, alignItems: 'center', maxWidth: 120 },
  crown: { fontSize: 20, marginBottom: 2 },
  podiumAvatar: {
    overflow: 'hidden',
    borderWidth: 3,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  spotName: { color: colors.text, fontWeight: '800', fontSize: 13, marginTop: 8, maxWidth: 104 },
  spotTime: { color: colors.textMuted, fontWeight: '700', fontSize: 12, marginTop: 1, marginBottom: 8 },
  pedestal: {
    width: '88%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    alignItems: 'center',
    paddingTop: 8,
  },
  pedestalRank: { color: 'rgba(45,42,74,0.55)', fontWeight: '900', fontSize: 20 },

  // Lista rank 4+
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 9,
    ...SHADOW,
  },
  rowMe: { borderWidth: 2, borderColor: colors.accent },
  rowRank: {
    width: 22,
    textAlign: 'center',
    color: colors.textMuted,
    fontWeight: '900',
    fontSize: 14,
  },
  rowAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  avatarFallback: { fontSize: 16, fontWeight: '800', color: colors.textMuted, marginTop: 8 },
  rowName: { color: colors.text, fontWeight: '700', fontSize: 14.5 },
  rowMeta: { color: colors.textMuted, fontSize: 11.5, marginTop: 1 },
  rowAvg: { color: colors.text, fontWeight: '900', fontSize: 15 },

  footer: {
    fontSize: 12.5,
    color: colors.textMuted,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 8,
  },
  errorText: { color: colors.danger, textAlign: 'center', marginTop: 24 },
});
