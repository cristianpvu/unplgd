import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getActiveCoCreation, getAlbum } from '../../../src/api/coCreations';
import { colors } from '../../../src/theme/colors';

export default function CoCreateHub() {
  const active = useQuery({
    queryKey: ['co-creations', 'active'],
    queryFn: getActiveCoCreation,
    // Refetch des cand ecranul e deschis (activ poate aparea/disparea repede)
    staleTime: 5_000,
  });
  const album = useQuery({
    queryKey: ['co-creations', 'album'],
    queryFn: getAlbum,
  });

  const albumCount = album.data?.items.length ?? 0;
  const activeSession = active.data?.active;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Deseneaza impreuna</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Cu un prieten alaturi, alegeti o poveste si desenati impreuna o scena. AI-ul va
          transforma desenul intr-o ilustratie magica.
        </Text>

        {active.isPending && <ActivityIndicator color={colors.accent} />}

        {activeSession ? (
          <Pressable
            onPress={() => router.push(`/(app)/co-create/${activeSession.id}`)}
            style={({ pressed }) => [styles.activeCard, pressed && styles.cardPressed]}
          >
            <Text style={styles.activeBadge}>SESIUNE ACTIVA</Text>
            <Text style={styles.activeTitle}>{activeSession.story.title}</Text>
            <Text style={styles.activeSub}>
              {activeSession.status === 'PROCESSING'
                ? 'AI-ul lucreaza...'
                : 'Continua sa desenezi'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push('/(app)/co-create/start')}
            style={({ pressed }) => [styles.startCard, pressed && styles.cardPressed]}
          >
            <Text style={styles.startEmoji}>🎨</Text>
            <Text style={styles.startTitle}>Sesiune noua</Text>
            <Text style={styles.startSub}>Alege un prieten si o poveste</Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => router.push('/(app)/co-create/album')}
          style={({ pressed }) => [styles.albumCard, pressed && styles.cardPressed]}
        >
          <Text style={styles.albumEmoji}>📔</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.albumTitle}>Albumul nostru</Text>
            <Text style={styles.albumSub}>
              {album.isPending
                ? '...'
                : albumCount === 0
                  ? 'Inca nu aveti desene'
                  : `${albumCount} ${albumCount === 1 ? 'desen' : 'desene'}`}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </ScrollView>
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

  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 14 },
  intro: { color: colors.text, fontSize: 14, opacity: 0.75, lineHeight: 20 },

  startCard: {
    backgroundColor: colors.accent,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 6,
    minHeight: 180,
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  startEmoji: { fontSize: 56, marginBottom: 4 },
  startTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  startSub: { color: 'rgba(255,255,255,0.92)', fontSize: 14, fontWeight: '500' },

  activeCard: {
    backgroundColor: colors.secondary,
    borderRadius: 24,
    padding: 22,
    gap: 4,
    minHeight: 140,
    justifyContent: 'flex-end',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  activeBadge: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 6,
  },
  activeTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  activeSub: { color: 'rgba(255,255,255,0.92)', fontSize: 14, fontWeight: '600' },

  albumCard: {
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
  albumEmoji: { fontSize: 28 },
  albumTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  albumSub: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginTop: 2 },
  chevron: { color: colors.textMuted, fontSize: 24 },

  cardPressed: { transform: [{ scale: 0.97 }], opacity: 0.92 },
});
