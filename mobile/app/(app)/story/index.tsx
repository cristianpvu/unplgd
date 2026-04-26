import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { listInbox, listMyStories } from '../../../src/api/stories';
import { colors } from '../../../src/theme/colors';

export default function StoryHub() {
  const inbox = useQuery({ queryKey: ['stories', 'inbox'], queryFn: listInbox });
  const mine = useQuery({ queryKey: ['stories', 'mine'], queryFn: listMyStories });

  // Limita 1/zi: daca am deja o poveste creata azi, butonul "Creeaza" e
  // dezactivat. Verificam pe createdAt din lista mea — ziua locala.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const createdToday = mine.data?.stories.some(
    (s) => new Date(s.createdAt).getTime() >= today.getTime(),
  );

  const inboxCount = inbox.data?.items.length ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Povesti</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.container}>
        <Pressable
          disabled={createdToday}
          onPress={() => router.push('/(app)/story/create')}
          style={({ pressed }) => [
            styles.bigCard,
            { backgroundColor: colors.accent },
            createdToday && styles.cardDisabled,
            pressed && !createdToday && styles.cardPressed,
          ]}
        >
          <Text style={styles.cardEmoji}>📖</Text>
          <Text style={styles.cardTitle}>Creeaza poveste</Text>
          <Text style={styles.cardSubtitle}>
            {createdToday
              ? 'Ai creat povestea de azi! Vino maine.'
              : 'Inventeaza o poveste cu Buddy si spune-o unui prieten.'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(app)/story/inbox')}
          style={({ pressed }) => [
            styles.bigCard,
            { backgroundColor: colors.secondary },
            pressed && styles.cardPressed,
          ]}
        >
          {inboxCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{inboxCount}</Text>
            </View>
          )}
          <Text style={styles.cardEmoji}>👂</Text>
          <Text style={styles.cardTitle}>Mi-a povestit cineva</Text>
          <Text style={styles.cardSubtitle}>
            {inbox.isPending
              ? 'Verific cine ti-a spus povesti...'
              : inboxCount === 0
                ? 'Nimeni nu ti-a spus o poveste in ultimele 3 zile.'
                : `Ai ${inboxCount} ${inboxCount === 1 ? 'poveste' : 'povesti'} de verificat!`}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(app)/story/mine')}
          style={({ pressed }) => [
            styles.smallCard,
            pressed && styles.cardPressed,
          ]}
        >
          <Text style={styles.smallCardEmoji}>📚</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallCardTitle}>Carnetelul meu</Text>
            <Text style={styles.smallCardSubtitle}>
              {mine.isPending
                ? '...'
                : `${mine.data?.stories.length ?? 0} povesti create`}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        {(inbox.isPending || mine.isPending) && (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />
        )}
      </View>
    </SafeAreaView>
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

  container: { flex: 1, paddingHorizontal: 20, paddingTop: 12, gap: 14 },

  bigCard: {
    borderRadius: 24,
    padding: 22,
    gap: 6,
    minHeight: 160,
    justifyContent: 'flex-end',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  cardEmoji: { fontSize: 44, marginBottom: 4 },
  cardTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  cardSubtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  cardDisabled: { opacity: 0.55 },
  cardPressed: { transform: [{ scale: 0.97 }], opacity: 0.92 },

  badge: {
    position: 'absolute',
    top: 16,
    right: 16,
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: { color: colors.text, fontSize: 14, fontWeight: '800' },

  smallCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  smallCardEmoji: { fontSize: 28 },
  smallCardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  smallCardSubtitle: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  chevron: { color: colors.textMuted, fontSize: 24, fontWeight: '400' },
});
