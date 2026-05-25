import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getDailyQuests, type QuestSlot } from '../../src/api/quests';
import { colors } from '../../src/theme/colors';

const DIFFICULTY_LABEL: Record<QuestSlot['difficulty'], string> = {
  easy: 'Usor',
  medium: 'Mediu',
  hard: 'Greu',
};

const DIFFICULTY_COLOR: Record<QuestSlot['difficulty'], string> = {
  easy: colors.success,
  medium: colors.secondary,
  hard: colors.accent,
};

const TIER_LABEL: Record<'BRONZE' | 'SILVER' | 'GOLD', string> = {
  BRONZE: 'Cufar de bronz',
  SILVER: 'Cufar de argint',
  GOLD: 'Cufar de aur',
};

export default function QuestsScreen() {
  const questsQ = useQuery({
    queryKey: ['quests', 'today'],
    queryFn: getDailyQuests,
    refetchInterval: 30 * 1000,
  });

  const data = questsQ.data;
  const done = data?.quests.filter((q) => q.completedAt != null).length ?? 0;
  const total = data?.quests.length ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Taskurile zilei</Text>
        <View style={{ width: 44 }} />
      </View>

      {questsQ.isPending && (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
      )}

      {questsQ.error && (
        <Text style={styles.errorText}>Nu am putut incarca taskurile</Text>
      )}

      {data && (
        <ScrollView contentContainerStyle={styles.list}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{done} din {total} terminate</Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: total > 0 ? `${(done / total) * 100}%` : '0%' },
                ]}
              />
            </View>
            <Text style={styles.summaryHint}>
              {data.allComplete
                ? 'Bravo! Ai terminat tot azi.'
                : 'Termina toate 3 ca sa primesti un cufar.'}
            </Text>
          </View>

          {data.quests.map((q) => (
            <QuestCard key={q.slot} quest={q} />
          ))}

          {/* Chest reward zone */}
          <View
            style={[styles.chestCard, data.allComplete && styles.chestCardReady]}
          >
            <Text style={styles.chestEmoji}>{data.allComplete ? '🎁' : '🔒'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.chestTitle}>
                {data.allComplete && data.chestTier
                  ? TIER_LABEL[data.chestTier]
                  : 'Cufar bonus'}
              </Text>
              <Text style={styles.chestHint}>
                {data.allComplete
                  ? data.chestOpenedAt
                    ? 'Deja deschis — bravo!'
                    : 'Te asteapta la cuferele tale!'
                  : `Termina toate ${total} taskuri ca sa-l deblochezi`}
              </Text>
            </View>
            {data.allComplete && data.chestId && !data.chestOpenedAt && (
              <Pressable
                onPress={() => router.push('/(app)/chests')}
                style={({ pressed }) => [styles.chestBtn, pressed && styles.pressed]}
              >
                <Text style={styles.chestBtnText}>Deschide</Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.footerHint}>
            Taskurile noi apar in fiecare dimineata. Cele mai multe te incurajeaza
            sa te vezi cu prietenii in realitate!
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function QuestCard({ quest }: { quest: QuestSlot }) {
  const completed = quest.completedAt != null;
  const ratio = quest.requiredCount > 0
    ? Math.min(1, quest.progress / quest.requiredCount)
    : 0;

  return (
    <View style={[styles.card, completed && styles.cardDone]}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardIcon}>{completed ? '✅' : quest.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, completed && styles.cardTitleDone]} numberOfLines={2}>
            {quest.title}
          </Text>
          <View
            style={[
              styles.diffChip,
              { backgroundColor: DIFFICULTY_COLOR[quest.difficulty] },
            ]}
          >
            <Text style={styles.diffChipText}>{DIFFICULTY_LABEL[quest.difficulty]}</Text>
          </View>
        </View>
        <Text style={styles.cardDesc}>{quest.description}</Text>

        {quest.requiredCount > 1 && !completed && (
          <View style={styles.miniTrack}>
            <View style={[styles.miniFill, { width: `${ratio * 100}%` }]} />
          </View>
        )}

        <View style={styles.cardFooter}>
          {quest.requiredCount > 1 && (
            <Text style={styles.progressText}>
              {quest.progress}/{quest.requiredCount}
            </Text>
          )}
          <Text style={styles.xpText}>+{quest.xpReward} XP</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  back: { color: colors.text, fontSize: 22, fontWeight: '700' },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center' },

  list: { padding: 16, gap: 12, paddingBottom: 40 },

  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  summaryTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.cardAlt,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.success, borderRadius: 5 },
  summaryHint: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },

  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardDone: { borderColor: colors.success, opacity: 0.85 },
  cardLeft: { width: 44, alignItems: 'center', justifyContent: 'center' },
  cardIcon: { fontSize: 30 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '800', flex: 1 },
  cardTitleDone: { textDecorationLine: 'line-through', color: colors.textMuted },
  cardDesc: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  diffChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  diffChipText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },

  miniTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.cardAlt,
    overflow: 'hidden',
    marginTop: 8,
  },
  miniFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  progressText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  xpText: { color: colors.accent, fontSize: 14, fontWeight: '900' },

  chestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.cardAlt,
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    marginTop: 4,
  },
  chestCardReady: { borderColor: '#FFB400', backgroundColor: '#FFF6D8' },
  chestEmoji: { fontSize: 34 },
  chestTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  chestHint: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  chestBtn: {
    backgroundColor: '#FFB400',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chestBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

  footerHint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    lineHeight: 18,
  },

  pressed: { transform: [{ scale: 0.96 }], opacity: 0.85 },
  errorText: { color: colors.danger, textAlign: 'center', marginTop: 24 },
});
