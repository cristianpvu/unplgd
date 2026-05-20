import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { SvgXml } from 'react-native-svg';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listChestTiers,
  listChests,
  openChest,
  type ChestDto,
  type ChestLoot,
  type ChestTier,
  type ChestTierVisual,
} from '../../src/api/chests';
import {
  LootRevealInline,
  resolveTier,
  TIER_LABEL,
  type ResolvedTier,
} from '../../src/chests/reveal';
import { colors } from '../../src/theme/colors';

// Cufere — lista cu neopenate primele si reveal animat (stil Clash Royale) la
// deschidere. Vizualurile (SVG body/lid/mini + culori) vin din DB via
// /chests/tiers; reveal-ul e partajat cu homepage (src/chests/reveal.tsx).

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((now.getTime() - d.getTime()) / dayMs);
  if (diffDays <= 0) return 'azi';
  if (diffDays === 1) return 'ieri';
  if (diffDays < 7) return `acum ${diffDays} zile`;
  return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

// Glyph cufar randat din SVG-ul `mini` (cufar complet) — fallback la o pastila
// colorata daca DB nu a livrat SVG-ul. Folosit in ambele liste.
function ChestGlyph({ visual, size }: { visual: ResolvedTier; size: number }) {
  if (visual.miniSvg) {
    return <SvgXml xml={visual.miniSvg} width={size} height={Math.round(size * 0.92)} />;
  }
  return (
    <View
      style={{
        width: size * 0.8,
        height: size * 0.66,
        borderRadius: size * 0.16,
        backgroundColor: visual.bg,
        borderWidth: 2,
        borderColor: visual.dark,
      }}
    />
  );
}

export default function ChestsScreen() {
  const qc = useQueryClient();
  const chestsQ = useQuery({ queryKey: ['chests'], queryFn: listChests });
  const tiersQ = useQuery({
    queryKey: ['chestTiers'],
    queryFn: listChestTiers,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
  const tierByTier = useMemo<Partial<Record<ChestTier, ChestTierVisual>>>(() => {
    const out: Partial<Record<ChestTier, ChestTierVisual>> = {};
    for (const t of tiersQ.data?.tiers ?? []) out[t.tier] = t;
    return out;
  }, [tiersQ.data]);

  const [reveal, setReveal] = useState<{
    tier: ChestTier;
    loot: ChestLoot;
    visual: ResolvedTier;
  } | null>(null);

  const openMut = useMutation({
    mutationFn: (chestId: string) => openChest(chestId),
    onSuccess: (data, chestId) => {
      const chest = chestsQ.data?.chests.find((c) => c.id === chestId);
      if (chest) {
        setReveal({ tier: chest.tier, loot: data.loot, visual: resolveTier(chest.tier, tierByTier) });
      }
      qc.invalidateQueries({ queryKey: ['chests'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e: any) => Alert.alert('Eroare', e?.message ?? 'Nu am putut deschide cufarul'),
  });

  const chests = chestsQ.data?.chests ?? [];
  const unopened = chests.filter((c) => !c.openedAt);
  const opened = chests.filter((c) => c.openedAt);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>Cufere</Text>
        <View style={{ width: 44 }} />
      </View>

      {chestsQ.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : chests.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyGlyph}>
            <ChestGlyph visual={resolveTier('GOLD', tierByTier)} size={88} />
          </View>
          <Text style={styles.emptyTitle}>Inca nu ai cufere</Text>
          <Text style={styles.emptySub}>
            Joaca Last Phone Standing ca sa primesti cufere cu accesorii si XP.
          </Text>
          <Pressable
            onPress={() => router.replace('/(app)/phonedown')}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.primaryBtnText}>Joaca Last Phone Standing</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          {unopened.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>De deschis</Text>
                <View style={styles.countPill}>
                  <Text style={styles.countPillText}>{unopened.length}</Text>
                </View>
              </View>
              {unopened.map((c) => (
                <ChestRow
                  key={c.id}
                  chest={c}
                  visual={resolveTier(c.tier, tierByTier)}
                  opening={openMut.isPending && openMut.variables === c.id}
                  onOpen={() => openMut.mutate(c.id)}
                />
              ))}
            </View>
          )}
          {opened.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Istoric</Text>
                <View style={[styles.countPill, styles.countPillMuted]}>
                  <Text style={[styles.countPillText, { color: colors.textMuted }]}>
                    {opened.length}
                  </Text>
                </View>
              </View>
              <View style={styles.historyCard}>
                {opened.map((c, i) => (
                  <OpenedRow
                    key={c.id}
                    chest={c}
                    visual={resolveTier(c.tier, tierByTier)}
                    last={i === opened.length - 1}
                    onPeek={() =>
                      c.loot &&
                      setReveal({
                        tier: c.tier,
                        loot: c.loot,
                        visual: resolveTier(c.tier, tierByTier),
                      })
                    }
                  />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      <Modal
        visible={reveal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReveal(null)}
      >
        <Stack.Screen options={{ headerShown: false }} />
        {reveal && (
          <LootRevealInline
            loot={reveal.loot}
            tier={reveal.tier}
            visual={reveal.visual}
            onDismiss={() => setReveal(null)}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

function ChestRow({
  chest,
  visual,
  opening,
  onOpen,
}: {
  chest: ChestDto;
  visual: ResolvedTier;
  opening: boolean;
  onOpen: () => void;
}) {
  // Pulse animation pe cufere neopenate ca sa-i atraga atentia.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

  return (
    <Pressable
      onPress={onOpen}
      disabled={opening}
      style={({ pressed }) => [
        styles.chestCard,
        { borderColor: visual.glow },
        pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={[styles.chestIconWrap, { backgroundColor: visual.glow }]}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <ChestGlyph visual={visual} size={56} />
        </Animated.View>
      </View>
      <View style={styles.chestInfo}>
        <Text style={styles.chestTier}>Cufar {TIER_LABEL[chest.tier]}</Text>
        <Text style={styles.chestSub}>
          {chest.sourceType === 'phone_down' ? 'Last Phone Standing' : chest.sourceType}
        </Text>
      </View>
      {opening ? (
        <ActivityIndicator color={visual.dark} style={{ marginRight: 6 }} />
      ) : (
        <View style={[styles.openBadge, { backgroundColor: visual.dark }]}>
          <Text style={styles.openBadgeText}>Deschide</Text>
        </View>
      )}
    </Pressable>
  );
}

function OpenedRow({
  chest,
  visual,
  last,
  onPeek,
}: {
  chest: ChestDto;
  visual: ResolvedTier;
  last: boolean;
  onPeek: () => void;
}) {
  const itemCount = chest.loot?.items.length ?? 0;
  const xp = chest.loot?.xp ?? 0;
  return (
    <Pressable
      onPress={onPeek}
      style={({ pressed }) => [
        styles.openedRow,
        !last && styles.openedRowDivider,
        pressed && { backgroundColor: colors.cardAlt },
      ]}
    >
      <View style={[styles.openedIconWrap, { backgroundColor: visual.glow }]}>
        <ChestGlyph visual={visual} size={34} />
      </View>
      <View style={styles.chestInfo}>
        <Text style={styles.chestTierSm}>Cufar {TIER_LABEL[chest.tier]}</Text>
        <Text style={styles.chestSub}>
          {itemCount > 0 ? `${itemCount} ${itemCount === 1 ? 'item' : 'iteme'} · ` : ''}+{xp} XP
        </Text>
      </View>
      <Text style={styles.openedDate}>{formatDate(chest.openedAt)}</Text>
      <Text style={styles.peekArrow}>›</Text>
    </Pressable>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  back: { color: colors.accent, fontSize: 24, fontWeight: '700' },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  emptyGlyph: {
    width: 132,
    height: 132,
    borderRadius: 36,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  emptySub: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  scrollBody: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 36, gap: 22 },
  section: { gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  countPill: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillMuted: { backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  countPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },

  // De deschis — card hero
  chestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 12,
    borderWidth: 1.5,
    gap: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  chestIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chestInfo: { flex: 1, gap: 3 },
  chestTier: { color: colors.text, fontSize: 16, fontWeight: '800' },
  chestTierSm: { color: colors.text, fontSize: 14, fontWeight: '800' },
  chestSub: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  openBadge: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  openBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },

  // Istoric — card grupat cu randuri
  historyCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 1,
  },
  openedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
  },
  openedRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  openedIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openedDate: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  peekArrow: { color: colors.textMuted, fontSize: 22, fontWeight: '700', marginLeft: 2 },

  primaryBtn: {
    marginTop: 16,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 999,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
