import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Svg, { Path, Circle } from 'react-native-svg';
import { getDailyQuests, type QuestSlot, type DailyQuestsState } from '../../src/api/quests';
import { colors } from '../../src/theme/colors';

const TIER_LABEL: Record<'BRONZE' | 'SILVER' | 'GOLD', string> = {
  BRONZE: 'Cufar de bronz',
  SILVER: 'Cufar de argint',
  GOLD: 'Cufar de aur',
};

export default function QuestsModal() {
  const questsQ = useQuery({
    queryKey: ['quests', 'today'],
    queryFn: getDailyQuests,
    refetchInterval: 30 * 1000,
  });

  const data = questsQ.data;
  const done = data?.quests.filter((q) => q.completedAt != null).length ?? 0;
  const total = data?.quests.length ?? 0;

  // Slide-up + fade pe mount pentru senzatie de panel, nu pagina.
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(slide, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [slide]);

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [Dimensions.get('window').height * 0.5, 0],
  });

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.backdrop, { opacity: slide }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} />
      </Animated.View>

      <Animated.View style={[styles.panel, { transform: [{ translateY }], opacity: slide }]}>
        <SafeAreaView edges={['bottom']}>
          <View style={styles.grip} />

          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Taskurile zilei</Text>
              <Text style={styles.subtitle}>
                {total > 0 ? `${done} din ${total} gata` : 'Se incarca...'}
              </Text>
            </View>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M6 6l12 12M18 6L6 18"
                  stroke={colors.textMuted}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
          </View>

          {questsQ.isPending && (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 40 }} />
          )}
          {questsQ.error && (
            <Text style={styles.errorText}>Nu am putut incarca taskurile</Text>
          )}

          {data && (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.card}>
                {data.quests.map((q, i) => (
                  <QuestRow key={q.slot} quest={q} last={i === data.quests.length - 1} />
                ))}
              </View>

              <ChestRow data={data} total={total} />

              <Text style={styles.footerHint}>
                Taskuri noi in fiecare dimineata. Cele mai multe te trimit sa te
                vezi cu prietenii in realitate.
              </Text>
            </ScrollView>
          )}
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

function QuestRow({ quest, last }: { quest: QuestSlot; last: boolean }) {
  const completed = quest.completedAt != null;
  const multi = quest.requiredCount > 1;

  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Check completed={completed} />
      <View style={{ flex: 1 }}>
        <Text
          style={[styles.rowTitle, completed && styles.rowTitleDone]}
          numberOfLines={2}
        >
          {quest.title}
        </Text>
        {!completed && (
          <Text style={styles.rowDesc} numberOfLines={2}>
            {quest.description}
          </Text>
        )}
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.xp, completed && styles.xpDone]}>+{quest.xpReward}</Text>
        {multi && !completed && (
          <Text style={styles.count}>
            {quest.progress}/{quest.requiredCount}
          </Text>
        )}
      </View>
    </View>
  );
}

function Check({ completed }: { completed: boolean }) {
  if (completed) {
    return (
      <View style={styles.checkDone}>
        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
          <Path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="#FFFFFF"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    );
  }
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={colors.border} strokeWidth={2.4} />
    </Svg>
  );
}

function ChestRow({ data, total }: { data: DailyQuestsState; total: number }) {
  const ready = data.allComplete;
  const tier = data.chestTier;

  return (
    <View style={[styles.chest, ready && styles.chestReady]}>
      {ready ? (
        <ChestGlyph color="#F1B23E" />
      ) : (
        <LockGlyph color={colors.textMuted} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.chestTitle}>
          {ready && tier ? TIER_LABEL[tier] : 'Cufar bonus'}
        </Text>
        <Text style={styles.chestHint}>
          {ready
            ? data.chestOpenedAt
              ? 'Deja deschis.'
              : 'Te asteapta la cufere.'
            : `Termina toate ${total} ca sa-l deblochezi.`}
        </Text>
      </View>
      {ready && data.chestId && !data.chestOpenedAt && (
        <Pressable
          onPress={() => {
            router.back();
            router.push('/(app)/chests');
          }}
          style={({ pressed }) => [styles.chestBtn, pressed && styles.pressed]}
        >
          <Text style={styles.chestBtnText}>Deschide</Text>
        </Pressable>
      )}
    </View>
  );
}

function ChestGlyph({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8Z"
        stroke={color}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <Path
        d="M4 11V8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v3"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M4 13h16" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path
        d="M11 13v3h2v-3"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function LockGlyph({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 11a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-8Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M8 10V8a4 4 0 0 1 8 0v2" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(45, 42, 74, 0.45)' },

  panel: {
    backgroundColor: colors.bgAlt,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 10,
    maxHeight: '88%',
  },
  grip: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: 12,
  },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: 0.2 },
  subtitle: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: { flexGrow: 0 },
  list: { gap: 12, paddingBottom: 20 },

  // Un singur card alb cu randuri separate de o linie subtire = look de checklist.
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.bgAlt },
  rowTitle: { color: colors.text, fontSize: 15.5, fontWeight: '800', lineHeight: 20 },
  rowTitleDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  rowDesc: { color: colors.textMuted, fontSize: 13, marginTop: 3, lineHeight: 18 },
  rowRight: { alignItems: 'flex-end' },
  xp: { color: colors.accent, fontSize: 15, fontWeight: '900' },
  xpDone: { color: colors.textMuted },
  count: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 2 },

  checkDone: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chestReady: { borderColor: '#F1B23E', backgroundColor: '#FFF6DD' },
  chestTitle: { color: colors.text, fontSize: 15.5, fontWeight: '800' },
  chestHint: { color: colors.textMuted, fontSize: 12.5, marginTop: 3, lineHeight: 17 },
  chestBtn: {
    backgroundColor: '#F1B23E',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chestBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },

  footerHint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 16,
    lineHeight: 18,
  },

  pressed: { transform: [{ scale: 0.96 }], opacity: 0.85 },
  errorText: { color: colors.danger, textAlign: 'center', marginVertical: 30 },
});
