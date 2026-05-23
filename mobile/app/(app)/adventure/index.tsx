import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getAdventureWorlds, type AdventureWorld } from '../../../src/api/adventure';
import { colors } from '../../../src/theme/colors';

export default function AdventureHome() {
  const worldsQuery = useQuery({
    queryKey: ['adventure', 'worlds'],
    queryFn: getAdventureWorlds,
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Aventuri</Text>
        <View style={{ width: 40 }} />
      </View>

      {worldsQuery.isPending ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
      ) : worldsQuery.error || !worldsQuery.data ? (
        <Text style={styles.error}>Nu am putut incarca aventurile</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.intro}>
            {worldsQuery.data.pet.name} te asteapta sa explorati impreuna lumile lui.
          </Text>
          {worldsQuery.data.worlds.length === 0 ? (
            <Text style={styles.muted}>
              {worldsQuery.data.pet.name} inca nu are lumi de explorat.
            </Text>
          ) : (
            worldsQuery.data.worlds.map((w) => <WorldCard key={w.slug} world={w} />)
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function WorldCard({ world }: { world: AdventureWorld }) {
  const unlockedCount = world.backgrounds.filter((b) => b.unlocked).length;
  return (
    <Pressable
      onPress={() => router.push(`/(app)/adventure/${world.slug}`)}
      style={({ pressed }) => [
        styles.worldCard,
        { backgroundColor: world.bgColor },
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.worldHeader}>
        <Text style={styles.worldName}>{world.name}</Text>
        {world.completions > 0 && (
          <View style={[styles.completionBadge, { backgroundColor: world.accentColor }]}>
            <Text style={styles.completionBadgeText}>{world.completions}x</Text>
          </View>
        )}
      </View>
      <Text style={styles.worldLore}>{world.lore}</Text>

      <View style={styles.worldFooter}>
        <Text style={[styles.worldCta, { color: world.accentColor }]}>
          {world.activeRunId ? 'Continua aventura →' : 'Incepe aventura →'}
        </Text>
        {world.backgrounds.length > 0 && (
          <Text style={styles.worldRewards}>
            {unlockedCount}/{world.backgrounds.length} fundaluri
          </Text>
        )}
      </View>

      {/* Mini-preview fundaluri deblocabile */}
      {world.backgrounds.length > 0 && (
        <View style={styles.bgPreviewRow}>
          {world.backgrounds.slice(0, 4).map((b) => (
            <View key={b.key} style={styles.bgPreview}>
              {b.imageUrl ? (
                <Image
                  source={{ uri: b.imageUrl }}
                  style={[styles.bgPreviewImg, !b.unlocked && styles.bgPreviewLocked]}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.bgPreviewImg, styles.bgPreviewEmpty]} />
              )}
              {!b.unlocked && (
                <View style={styles.bgLockOverlay}>
                  <Text style={styles.bgLockIcon}>🔒</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { color: colors.text, fontSize: 22, fontWeight: '900' },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  scroll: { padding: 16, gap: 14, paddingBottom: 32 },
  intro: { color: colors.textMuted, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  muted: { color: colors.textMuted, fontSize: 14 },
  error: { color: colors.danger, textAlign: 'center', marginTop: 40 },

  worldCard: {
    borderRadius: 18,
    padding: 16,
    gap: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardPressed: { transform: [{ scale: 0.99 }], opacity: 0.92 },
  worldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  worldName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  completionBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  completionBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  worldLore: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  worldFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  worldCta: { fontSize: 15, fontWeight: '900' },
  worldRewards: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '700' },

  bgPreviewRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  bgPreview: { position: 'relative' },
  bgPreviewImg: {
    width: 56,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  bgPreviewLocked: { opacity: 0.35 },
  bgPreviewEmpty: { backgroundColor: 'rgba(255,255,255,0.12)' },
  bgLockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgLockIcon: { fontSize: 14 },
});
