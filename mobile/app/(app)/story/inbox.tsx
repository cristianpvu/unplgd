import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SvgXml } from 'react-native-svg';
import { listInbox, startClaim, type InboxItem } from '../../../src/api/stories';
import { ApiError } from '../../../src/api/client';
import { colors } from '../../../src/theme/colors';

export default function StoryInbox() {
  const qc = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: ['stories', 'inbox'],
    queryFn: listInbox,
  });

  const [startingId, setStartingId] = useState<string | null>(null);

  const claim = useMutation({
    mutationFn: (storyId: string) => startClaim(storyId),
    onSuccess: ({ claimId }) => {
      qc.invalidateQueries({ queryKey: ['stories', 'inbox'] });
      router.push({ pathname: '/(app)/story/verify/[claimId]', params: { claimId } });
    },
    onError: (err: any) => {
      const msg =
        err instanceof ApiError && err.code === 'already_attempted'
          ? 'Ai incercat deja la povestea asta.'
          : err instanceof ApiError && err.code === 'story_expired'
            ? 'Povestea e prea veche, a expirat.'
            : err?.message ?? 'Nu am putut porni verificarea';
      Alert.alert('Hopa', msg);
    },
    onSettled: () => setStartingId(null),
  });

  function onTap(item: InboxItem) {
    setStartingId(item.storyId);
    claim.mutate(item.storyId);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Cine ti-a povestit?</Text>
        <View style={{ width: 44 }} />
      </View>

      <Text style={styles.intro}>
        Apasa pe prieten daca ti-a spus o poveste in viata reala.
      </Text>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isPending && <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />}
        {error && <Text style={styles.errorText}>Nu am putut incarca lista</Text>}
        {data && data.items.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>👂</Text>
            <Text style={styles.emptyTitle}>Nimic momentan</Text>
            <Text style={styles.emptySub}>
              Cand un prieten creeaza o poveste, il vezi aici 3 zile.
            </Text>
          </View>
        )}
        {data?.items.map((item) => (
          <Pressable
            key={item.storyId}
            disabled={startingId !== null}
            onPress={() => onTap(item)}
            style={({ pressed }) => [
              styles.row,
              pressed && styles.rowPressed,
              startingId === item.storyId && styles.rowLoading,
            ]}
          >
            <FriendAvatar svg={item.author.avatarSvg} />
            <View style={styles.rowInfo}>
              <Text style={styles.rowName}>{item.author.name}</Text>
              <Text style={styles.rowMeta}>
                {item.claimStatus === 'ATTEMPTING' ? 'continua verificarea' : timeAgo(item.createdAt)}
              </Text>
            </View>
            {startingId === item.storyId ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={styles.chevron}>›</Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function FriendAvatar({ svg }: { svg: string | null }) {
  const SIZE = 56;
  if (!svg) return <View style={[styles.avatar, styles.avatarFallback]} />;
  const fullHeight = Math.round(SIZE * (1400 / 762));
  return (
    <View style={[styles.avatar, { width: SIZE, height: SIZE }]}>
      <SvgXml xml={svg} width={SIZE} height={fullHeight} />
    </View>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return 'acum cateva minute';
  if (hours < 24) return `acum ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ieri';
  return `acum ${days} zile`;
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

  intro: {
    color: colors.textMuted,
    fontSize: 14,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  scroll: { paddingHorizontal: 20, paddingVertical: 8, gap: 10, paddingBottom: 32 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  emptySub: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  rowPressed: { transform: [{ scale: 0.98 }], opacity: 0.85 },
  rowLoading: { opacity: 0.7 },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { color: colors.text, fontSize: 17, fontWeight: '800' },
  rowMeta: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  chevron: { color: colors.textMuted, fontSize: 24, fontWeight: '400' },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
  },
  avatarFallback: { backgroundColor: colors.border },

  errorText: { color: colors.danger, textAlign: 'center', marginTop: 24 },
});
