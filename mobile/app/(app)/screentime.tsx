import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Svg, { Path } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';
import { screenTime } from 'screen-time';
import { getScreenTimeLeaderboard, type ScreenTimeEntry } from '../../src/api/screentime';
import { syncScreenTime } from '../../src/lib/screenTimeSync';
import { colors } from '../../src/theme/colors';

type Perm = 'checking' | 'granted' | 'denied' | 'unavailable';

function fmt(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const MEDAL = ['#FFC94D', '#C9CFDA', '#E0915A']; // aur, argint, bronz

export default function ScreenTimeLeaderboard() {
  const qc = useQueryClient();
  const [perm, setPerm] = useState<Perm>('checking');

  const lbQ = useQuery({
    queryKey: ['screentime', 'leaderboard'],
    queryFn: getScreenTimeLeaderboard,
    refetchInterval: 60 * 1000,
  });

  // La focus: verifica permisiunea, sincronizeaza (daca Android + acces) si
  // reimprospata clasamentul. Re-verifica si cand app revine activ (user-ul
  // tocmai a activat accesul in Settings si s-a intors).
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
          <Text style={styles.subtitle}>Saptamana asta · castiga cine sta mai putin</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Reward saptamana trecuta */}
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

        {/* Permisiune */}
        {perm === 'unavailable' && (
          <View style={styles.permCard}>
            <Text style={styles.permTitle}>Disponibil pe Android</Text>
            <Text style={styles.permBody}>
              iOS nu permite citirea timpului pe ecran din aplicatie. Poti vedea clasamentul
              prietenilor, dar nu poti participa de pe acest telefon.
            </Text>
          </View>
        )}
        {perm === 'denied' && (
          <View style={styles.permCard}>
            <Text style={styles.permTitle}>Activeaza accesul la timpul pe ecran</Text>
            <Text style={styles.permBody}>
              Ca sa intri in clasament avem nevoie sa citim cat stai pe telefon. Datele raman
              private — afisam doar minutele tale, nu ce aplicatii folosesti.
            </Text>
            <Pressable style={styles.permBtn} onPress={() => screenTime.openSettings()}>
              <Text style={styles.permBtnText}>Deschide setarile</Text>
            </Pressable>
          </View>
        )}

        {lbQ.isPending && <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}
        {lbQ.error && <Text style={styles.errorText}>Nu am putut incarca clasamentul</Text>}

        {data && data.entries.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Inca nimeni in clasament</Text>
            <Text style={styles.emptyBody}>
              Cand tu si prietenii tai aveti timpul pe ecran inregistrat, apareti aici. Mai putine
              minute = loc mai bun.
            </Text>
          </View>
        )}

        {data?.entries.map((e) => (
          <Row key={e.userId} entry={e} />
        ))}

        {data && data.entries.length > 0 && (
          <Text style={styles.footer}>
            La finalul saptamanii, primii din clasament primesc cel mai mult XP. Mai putin timp pe
            telefon = mai mult timp afara. 🌳
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ entry }: { entry: ScreenTimeEntry }) {
  const medal = entry.rank <= 3 ? MEDAL[entry.rank - 1] : null;
  return (
    <View style={[styles.row, entry.isMe && styles.rowMe]}>
      <View style={[styles.rankBadge, medal ? { backgroundColor: medal } : null]}>
        <Text style={[styles.rankText, medal ? { color: '#fff' } : null]}>{entry.rank}</Text>
      </View>
      <View style={styles.avatar}>
        {entry.avatarSvg ? (
          <SvgXml xml={entry.avatarSvg} width={40} height={40} />
        ) : (
          <Text style={styles.avatarFallback}>{entry.name.charAt(0).toUpperCase()}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.name}
          {entry.isMe ? ' (tu)' : ''}
        </Text>
        <Text style={styles.meta}>
          azi {fmt(entry.todayMinutes)} · {entry.daysReported} zile
        </Text>
      </View>
      <Text style={styles.avg}>{fmt(entry.avgMinutes)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  scroll: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },

  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.success,
    borderRadius: 18,
    padding: 14,
    marginTop: 4,
  },
  rewardEmoji: { fontSize: 28 },
  rewardTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  rewardSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12.5, marginTop: 2 },

  permCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
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
  permBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  emptyCard: { backgroundColor: colors.card, borderRadius: 18, padding: 18, gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  emptyBody: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 10,
  },
  rowMe: { borderWidth: 2, borderColor: colors.accent },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarFallback: { fontSize: 17, fontWeight: '800', color: colors.textMuted },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  avg: { fontSize: 16, fontWeight: '800', color: colors.text },

  footer: {
    fontSize: 12.5,
    color: colors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
  },
  errorText: { color: colors.danger, textAlign: 'center', marginTop: 24 },
});
