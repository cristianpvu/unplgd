import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AvatarHead } from '../../src/avatar/AvatarHead';
import type { AvatarPicks, Slot } from '../../src/avatar/catalog';
import { thumbnailUri } from '../../src/avatar/thumbnails';
import {
  getAvatarCatalog,
  getMyAvatar,
  previewAvatar,
  updateMyAvatar,
  type AvatarResponse,
  type CatalogType,
} from '../../src/api/avatar';
import { Button } from '../../src/ui/Button';
import { colors } from '../../src/theme/colors';

export default function AvatarEdit() {
  const qc = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ['avatar'], queryFn: getMyAvatar });
  // Catalogul vine separat ca sa cache-uim aspectele pe termen lung — se
  // schimba doar la deploy nou (seed), nu la fiecare salvare.
  const { data: catalog } = useQuery({
    queryKey: ['avatar', 'catalog'],
    queryFn: getAvatarCatalog,
    staleTime: 1000 * 60 * 60, // 1h
  });

  const [picks, setPicks] = useState<AvatarPicks | null>(null);
  // Slot-ul activ — initializat cu primul tip din catalog dupa ce vine.
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const previewSeq = useRef(0);

  useEffect(() => {
    if (data && !picks) {
      setPicks(data.picks);
      setPreviewSvg(data.svg);
    }
  }, [data, picks]);

  useEffect(() => {
    if (catalog && !activeSlot && catalog.types.length > 0) {
      setActiveSlot(catalog.types[0].slug);
    }
  }, [catalog, activeSlot]);

  const dirty = useMemo(() => {
    if (!data || !picks) return false;
    return JSON.stringify(picks) !== JSON.stringify(data.picks);
  }, [data, picks]);

  // Debounced live preview: every change schedules a render call ~250ms later;
  // a sequence number drops out-of-order responses (older PATCH-back races).
  useEffect(() => {
    if (!picks || !data) return;
    if (JSON.stringify(picks) === JSON.stringify(data.picks)) {
      setPreviewSvg(data.svg);
      return;
    }
    const mySeq = ++previewSeq.current;
    const t = setTimeout(() => {
      previewAvatar(picks)
        .then((r) => {
          if (mySeq === previewSeq.current) setPreviewSvg(r.svg);
        })
        .catch(() => {});
    }, 80);
    return () => clearTimeout(t);
  }, [picks, data]);

  const save = useMutation({
    mutationFn: (next: AvatarPicks) => updateMyAvatar(next),
    onSuccess: (resp: AvatarResponse) => {
      qc.setQueryData(['avatar'], resp);
      router.back();
    },
    onError: (err: any) => {
      Alert.alert('Salvare esuata', err?.message ?? 'Incearca din nou');
    },
  });

  function setSlot(slot: Slot, id: string) {
    setPicks((p) => (p ? { ...p, [slot]: id } : p));
  }

  const activeType: CatalogType | undefined = catalog?.types.find((t) => t.slug === activeSlot);

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
        {isPending || !picks ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <AvatarHead svg={previewSvg} height={240} />
        )}
      </View>

      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {catalog?.types.map((t) => (
            <Pressable
              key={t.slug}
              onPress={() => setActiveSlot(t.slug)}
              style={[styles.tab, activeSlot === t.slug && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeSlot === t.slug && styles.tabTextActive]}>
                {t.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.optionsScroll}>
        <View style={styles.options}>
          {picks && activeType &&
            activeType.items.map((item) => {
              const selected = picks[activeType.slug] === item.slug;
              const isColor = activeType.slug === 'skin' || activeType.slug === 'hairColor';
              const isFaceSlot = activeType.group === 'face';
              // Body item features encode colors as 'type:fill:shadow:...';
              // pull the fill hex for a quick swatch.
              const bodyColor = !isFaceSlot && item.feature ? item.feature.split(':')[1] : null;
              return (
                <Pressable
                  key={item.slug}
                  onPress={() => !item.locked && setSlot(activeType.slug, item.slug)}
                  style={[
                    styles.optionCard,
                    selected && styles.optionSelected,
                    item.locked && styles.optionLocked,
                  ]}
                >
                  {isColor && item.feature ? (
                    <View style={[styles.swatch, { backgroundColor: `#${item.feature}` }]} />
                  ) : isFaceSlot && item.feature ? (
                    <Image
                      source={{ uri: thumbnailUri(activeType.slug, item, 96) }}
                      style={styles.thumb}
                      resizeMode="contain"
                    />
                  ) : bodyColor ? (
                    <View style={[styles.swatch, { backgroundColor: `#${bodyColor}` }]} />
                  ) : (
                    <View style={styles.thumbEmpty}>
                      <Text style={styles.optionEmoji}>∅</Text>
                    </View>
                  )}
                  <Text style={styles.optionName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.locked && (
                    <View style={styles.lockBadge}>
                      <Text style={styles.lockText}>Lvl {item.level}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={save.isPending ? 'Se salveaza…' : 'Salveaza'}
          onPress={() => picks && dirty && save.mutate(picks)}
          disabled={!dirty || save.isPending}
        />
      </View>
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
    marginVertical: 8,
    minHeight: 250,
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
  optionsScroll: { padding: 16, paddingBottom: 16 },
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
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  thumbEmpty: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
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
  footer: {
    padding: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});
