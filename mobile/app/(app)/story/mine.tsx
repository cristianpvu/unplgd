import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { listMyStories, type Story } from '../../../src/api/stories';
import { colors } from '../../../src/theme/colors';

export default function StoryMine() {
  const { data, isPending, error } = useQuery({
    queryKey: ['stories', 'mine'],
    queryFn: listMyStories,
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Carnetelul meu</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isPending && <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />}
        {error && <Text style={styles.errorText}>Nu am putut incarca povestile</Text>}
        {data && data.stories.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📖</Text>
            <Text style={styles.emptyTitle}>Carnetelul e gol</Text>
            <Text style={styles.emptySub}>
              Cand creezi povesti cu Povestitorul, raman aici.
            </Text>
          </View>
        )}
        {data?.stories.map((s) => (
          <StoryRow key={s.id} story={s} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function StoryRow({ story }: { story: Story }) {
  const date = new Date(story.createdAt);
  const dateLabel = date.toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{story.title}</Text>
        <Text style={styles.cardDate}>{dateLabel}</Text>
      </View>
      <Text style={styles.cardBody}>{story.body}</Text>
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
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },

  scroll: { paddingHorizontal: 20, paddingVertical: 12, gap: 14, paddingBottom: 32 },

  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  emptySub: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },

  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    gap: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '800', flex: 1 },
  cardDate: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  cardBody: { color: colors.text, fontSize: 14, lineHeight: 20 },

  errorText: { color: colors.danger, textAlign: 'center', marginTop: 24 },
});
