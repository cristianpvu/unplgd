import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AvatarHead } from '../../src/avatar/AvatarHead';
import { CATALOG, DEFAULT_PICKS, type AvatarPicks, type Slot } from '../../src/avatar/catalog';
import { colors } from '../../src/theme/colors';

const FACE_SLOTS: Slot[] = ['skin', 'hair', 'hairColor', 'eyes', 'mouth', 'eyebrows', 'glasses', 'earrings'];

const SLOT_LABEL: Record<Slot, string> = {
  skin: 'Ten',
  hair: 'Coafura',
  hairColor: 'Culoare par',
  eyes: 'Ochi',
  mouth: 'Gura',
  eyebrows: 'Sprancene',
  glasses: 'Ochelari',
  earrings: 'Cercei',
  bodyShape: 'Corp',
  top: 'Tricou',
  outerwear: 'Jacheta',
  bottom: 'Pantaloni',
  footwear: 'Incaltaminte',
  holding: 'In mana',
};

const USER_LEVEL = 30;

export default function AvatarTest() {
  const [picks, setPicks] = useState<AvatarPicks>(DEFAULT_PICKS);
  const [activeSlot, setActiveSlot] = useState<Slot>('skin');

  function setSlot(slot: Slot, id: string) {
    setPicks((p) => ({ ...p, [slot]: id }));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.title}>Personalizeaza</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.previewBox}>
        <AvatarHead picks={picks} size={220} />
      </View>

      <View style={styles.tabsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {FACE_SLOTS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setActiveSlot(s)}
              style={[styles.tab, activeSlot === s && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeSlot === s && styles.tabTextActive]}>
                {SLOT_LABEL[s]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.optionsScroll}>
        <View style={styles.options}>
          {CATALOG[activeSlot].map((item) => {
            const selected = picks[activeSlot] === item.id;
            const locked = item.level > USER_LEVEL;
            const isColor = activeSlot === 'skin' || activeSlot === 'hairColor';
            return (
              <Pressable
                key={item.id}
                onPress={() => !locked && setSlot(activeSlot, item.id)}
                style={[
                  styles.optionCard,
                  selected && styles.optionSelected,
                  locked && styles.optionLocked,
                ]}
              >
                {isColor && item.feature ? (
                  <View style={[styles.swatch, { backgroundColor: `#${item.feature}` }]} />
                ) : (
                  <Text style={styles.optionEmoji}>
                    {item.feature ? '✦' : '∅'}
                  </Text>
                )}
                <Text style={styles.optionName} numberOfLines={1}>
                  {item.name}
                </Text>
                {locked && (
                  <View style={styles.lockBadge}>
                    <Text style={styles.lockText}>Lvl {item.level}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  back: { color: colors.text, fontSize: 22, fontWeight: '700' },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  previewBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  tabsWrap: { borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 8 },
  tabs: { paddingHorizontal: 16, gap: 8, paddingVertical: 8 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.card,
  },
  tabActive: { backgroundColor: colors.text },
  tabText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#FFFFFF' },
  optionsScroll: { padding: 16, paddingBottom: 48 },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionCard: {
    width: '30%',
    aspectRatio: 0.95,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    gap: 6,
  },
  optionSelected: { borderColor: colors.accent },
  optionLocked: { opacity: 0.4 },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.text,
  },
  optionEmoji: { fontSize: 24, color: colors.text },
  optionName: { color: colors.text, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  lockBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: colors.text,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  lockText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
});
