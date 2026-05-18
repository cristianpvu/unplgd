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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listChests,
  openChest,
  type ChestDto,
  type ChestLoot,
  type ChestTier,
  type Rarity,
} from '../../src/api/chests';
import { colors } from '../../src/theme/colors';

// Cufere — lista cu neopenate primele si modal de unboxing cu reveal animat.
// XP-ul se acorda la server side la deschidere (idempotent prin sourceId).

const TIER_LABEL: Record<ChestTier, string> = {
  BRONZE: 'Bronz',
  SILVER: 'Argint',
  GOLD: 'Aur',
  PLATINUM: 'Platina',
  DIAMOND: 'Diamant',
  CHAMPION: 'Campion',
};

const TIER_COLORS: Record<ChestTier, { bg: string; fg: string; glow: string }> = {
  BRONZE:   { bg: '#C68B59', fg: '#4A2C12', glow: '#FFD7A8' },
  SILVER:   { bg: '#B8C3CC', fg: '#1F3344', glow: '#E6EDF2' },
  GOLD:     { bg: '#F2C744', fg: '#5B3F00', glow: '#FFE899' },
  PLATINUM: { bg: '#7FE0D0', fg: '#0C3F38', glow: '#C2FFF4' },
  DIAMOND:  { bg: '#9AB3FF', fg: '#1B2870', glow: '#D3DEFF' },
  CHAMPION: { bg: '#FF7A59', fg: '#FFF7E0', glow: '#FFD9C2' },
};

const RARITY_COLORS: Record<Rarity, string> = {
  COMMON: '#A6AAB8',
  RARE: '#5BCEFA',
  EPIC: '#B47EE7',
  LEGENDARY: '#FFCC66',
};

export default function ChestsScreen() {
  const qc = useQueryClient();
  const chestsQ = useQuery({ queryKey: ['chests'], queryFn: listChests });
  const [opening, setOpening] = useState<{ chest: ChestDto; loot: ChestLoot } | null>(null);

  const openMut = useMutation({
    mutationFn: (chestId: string) => openChest(chestId),
    onSuccess: (data, chestId) => {
      const chest = chestsQ.data?.chests.find((c) => c.id === chestId);
      if (chest) {
        setOpening({ chest, loot: data.loot });
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
          <Text style={styles.bigEmoji}>📦</Text>
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
        <ScrollView contentContainerStyle={styles.scrollBody}>
          {unopened.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>De deschis ({unopened.length})</Text>
              {unopened.map((c) => (
                <ChestRow
                  key={c.id}
                  chest={c}
                  opening={openMut.isPending && openMut.variables === c.id}
                  onOpen={() => openMut.mutate(c.id)}
                />
              ))}
            </>
          )}
          {opened.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: unopened.length > 0 ? 18 : 0 }]}>
                Istoric ({opened.length})
              </Text>
              {opened.map((c) => (
                <OpenedRow key={c.id} chest={c} onPeek={() => c.loot && setOpening({ chest: c, loot: c.loot })} />
              ))}
            </>
          )}
        </ScrollView>
      )}

      <UnboxingModal
        opening={opening}
        onClose={() => setOpening(null)}
      />
    </SafeAreaView>
  );
}

function ChestRow({
  chest,
  opening,
  onOpen,
}: {
  chest: ChestDto;
  opening: boolean;
  onOpen: () => void;
}) {
  const c = TIER_COLORS[chest.tier];
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
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  return (
    <Pressable
      onPress={onOpen}
      disabled={opening}
      style={({ pressed }) => [styles.chestCard, pressed && { opacity: 0.9 }]}
    >
      <Animated.View style={[styles.chestIcon, { backgroundColor: c.bg, transform: [{ scale }] }]}>
        <Text style={[styles.chestIconText, { color: c.fg }]}>🎁</Text>
      </Animated.View>
      <View style={styles.chestInfo}>
        <Text style={styles.chestTier}>Cufar {TIER_LABEL[chest.tier]}</Text>
        <Text style={styles.chestSub}>
          {chest.sourceType === 'phone_down' ? 'Last Phone Standing' : chest.sourceType}
        </Text>
      </View>
      {opening ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <View style={[styles.openBadge, { backgroundColor: c.fg }]}>
          <Text style={[styles.openBadgeText, { color: c.bg }]}>Deschide</Text>
        </View>
      )}
    </Pressable>
  );
}

function OpenedRow({ chest, onPeek }: { chest: ChestDto; onPeek: () => void }) {
  const c = TIER_COLORS[chest.tier];
  const itemCount = chest.loot?.items.length ?? 0;
  const xp = chest.loot?.xp ?? 0;
  return (
    <Pressable
      onPress={onPeek}
      style={({ pressed }) => [styles.chestCardOpened, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.chestIconSmall, { backgroundColor: c.bg }]}>
        <Text style={[styles.chestIconText, { color: c.fg, fontSize: 18 }]}>🎁</Text>
      </View>
      <View style={styles.chestInfo}>
        <Text style={styles.chestTierSm}>{TIER_LABEL[chest.tier]}</Text>
        <Text style={styles.chestSub}>
          {itemCount} {itemCount === 1 ? 'item' : 'iteme'} · +{xp} XP
        </Text>
      </View>
      <Text style={styles.peekArrow}>›</Text>
    </Pressable>
  );
}

// ---------- Unboxing modal ----------

function UnboxingModal({
  opening,
  onClose,
}: {
  opening: { chest: ChestDto; loot: ChestLoot } | null;
  onClose: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  const open = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!opening) {
      setRevealed(false);
      shake.setValue(0);
      open.setValue(0);
      burst.setValue(0);
      return;
    }
    // Secventa: shake 0.8s → open 0.4s → burst 0.5s → reveal list
    Animated.sequence([
      Animated.loop(
        Animated.sequence([
          Animated.timing(shake, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -1, duration: 80, useNativeDriver: true }),
        ]),
        { iterations: 5 },
      ),
      Animated.timing(open, { toValue: 1, duration: 380, useNativeDriver: true, easing: Easing.out(Easing.back(2)) }),
      Animated.timing(burst, { toValue: 1, duration: 500, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
    ]).start(() => setRevealed(true));
  }, [opening, shake, open, burst]);

  if (!opening) return null;
  const c = TIER_COLORS[opening.chest.tier];
  const rotate = shake.interpolate({ inputRange: [-1, 1], outputRange: ['-6deg', '6deg'] });
  const lidTranslate = open.interpolate({ inputRange: [0, 1], outputRange: [0, -40] });
  const lidRotate = open.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-30deg'] });
  const burstScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.4] });
  const burstOpacity = burst.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.7, 0] });

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={[styles.modalBg, { backgroundColor: c.fg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.modalCenter}>
          {/* Burst halo */}
          <Animated.View
            style={[
              styles.burst,
              {
                backgroundColor: c.glow,
                opacity: burstOpacity,
                transform: [{ scale: burstScale }],
              },
            ]}
          />

          {/* Chest */}
          <Animated.View style={{ transform: [{ rotate }] }}>
            <View style={[styles.chestBody, { backgroundColor: c.bg }]}>
              <Text style={[styles.chestBigIcon, { color: c.fg }]}>🎁</Text>
            </View>
            <Animated.View
              style={[
                styles.chestLid,
                { backgroundColor: c.bg },
                {
                  transform: [
                    { translateY: lidTranslate },
                    { rotate: lidRotate },
                  ],
                },
              ]}
            />
          </Animated.View>

          {/* Tier title */}
          <Text style={[styles.modalTier, { color: '#FFFFFF' }]}>
            Cufar {TIER_LABEL[opening.chest.tier]}
          </Text>
        </View>

        {revealed && (
          <View style={styles.lootPanel}>
            <LootList loot={opening.loot} />
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.closeBtnText}>Gata</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

function LootList({ loot }: { loot: ChestLoot }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeIn]);
  const allDupes = useMemo(
    () => loot.duplicates.reduce((s, d) => s + d.shardsXp, 0),
    [loot.duplicates],
  );
  return (
    <Animated.View style={{ opacity: fadeIn, gap: 12 }}>
      <View style={styles.xpRow}>
        <Text style={styles.xpAmount}>+{loot.xp} XP</Text>
        {allDupes > 0 && (
          <Text style={styles.xpHint}>(inclus {allDupes} XP din duplicate)</Text>
        )}
      </View>

      {loot.items.length > 0 && (
        <View style={styles.lootGrid}>
          {loot.items.map((it) => (
            <View
              key={it.itemId}
              style={[
                styles.lootCard,
                { borderColor: RARITY_COLORS[it.rarity] },
              ]}
            >
              <View
                style={[
                  styles.rarityBadge,
                  { backgroundColor: RARITY_COLORS[it.rarity] },
                ]}
              >
                <Text style={styles.rarityText}>{it.rarity}</Text>
              </View>
              <Text style={styles.lootName} numberOfLines={2}>
                {it.name}
              </Text>
            </View>
          ))}
        </View>
      )}

      {loot.duplicates.length > 0 && (
        <View style={styles.dupeBox}>
          <Text style={styles.dupeTitle}>Duplicate convertite in XP</Text>
          {loot.duplicates.map((d) => (
            <Text key={d.slug} style={styles.dupeItem}>
              {d.name} → +{d.shardsXp} XP
            </Text>
          ))}
        </View>
      )}

      {loot.items.length === 0 && loot.duplicates.length === 0 && (
        <Text style={styles.dupeItem}>Doar XP — fara iteme de data asta.</Text>
      )}
    </Animated.View>
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
  bigEmoji: { fontSize: 64 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  emptySub: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },

  scrollBody: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 10 },
  sectionTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingBottom: 6,
  },

  chestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  chestCardOpened: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  chestIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chestIconSmall: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chestIconText: { fontSize: 30 },
  chestInfo: { flex: 1, gap: 2 },
  chestTier: { color: colors.text, fontSize: 16, fontWeight: '800' },
  chestTierSm: { color: colors.text, fontSize: 14, fontWeight: '700' },
  chestSub: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  peekArrow: { color: colors.textMuted, fontSize: 22, fontWeight: '700' },
  openBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  openBadgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },

  primaryBtn: {
    marginTop: 16,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 999,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

  // Modal
  modalBg: { flex: 1, paddingTop: 60 },
  modalCenter: { alignItems: 'center', paddingTop: 20 },
  chestBody: {
    width: 160,
    height: 110,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chestLid: {
    position: 'absolute',
    top: -22,
    left: 0,
    right: 0,
    height: 28,
    borderRadius: 12,
  },
  chestBigIcon: { fontSize: 60 },
  burst: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    top: -40,
    alignSelf: 'center',
  },
  modalTier: {
    marginTop: 18,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  lootPanel: {
    marginTop: 16,
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    flex: 1,
    maxHeight: '60%',
    gap: 12,
  },
  xpRow: { alignItems: 'center', gap: 4 },
  xpAmount: { color: colors.accent, fontSize: 28, fontWeight: '900' },
  xpHint: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  lootGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  lootCard: {
    width: '48%',
    backgroundColor: colors.cardAlt,
    borderRadius: 14,
    padding: 12,
    borderWidth: 2,
    gap: 6,
    alignItems: 'center',
  },
  rarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  rarityText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  lootName: { color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  dupeBox: {
    backgroundColor: colors.cardAlt,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  dupeTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 },
  dupeItem: { color: colors.text, fontSize: 13, fontWeight: '600' },

  closeBtn: {
    marginTop: 'auto',
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  closeBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
