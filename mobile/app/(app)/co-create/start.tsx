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
import { SvgXml } from 'react-native-svg';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listFriends, type Friend } from '../../../src/api/friends';
import { listFriendStories, listMyStories, type Story } from '../../../src/api/stories';
import { startCoCreation } from '../../../src/api/coCreations';
import { ApiError } from '../../../src/api/client';
import { getMe } from '../../../src/api/me';
import { colors } from '../../../src/theme/colors';

type StoryPick = { story: Story; authorName: string; mine: boolean };

export default function CoCreateStart() {
  const qc = useQueryClient();
  const [friend, setFriend] = useState<Friend | null>(null);

  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const friends = useQuery({ queryKey: ['friends'], queryFn: listFriends });
  const myStories = useQuery({
    queryKey: ['stories', 'mine'],
    queryFn: listMyStories,
    enabled: !!friend,
  });
  const friendStories = useQuery({
    queryKey: ['stories', 'by-friend', friend?.user.id],
    queryFn: () => listFriendStories(friend!.user.id),
    enabled: !!friend,
  });

  const start = useMutation({
    mutationFn: ({ friendId, storyId }: { friendId: string; storyId: string }) =>
      startCoCreation(friendId, storyId),
    onSuccess: (session) => {
      qc.invalidateQueries({ queryKey: ['co-creations'] });
      router.replace(`/(app)/co-create/${session.id}`);
    },
    onError: (err: any) => {
      const msg =
        err instanceof ApiError && err.code === 'active_session'
          ? 'Ai deja o sesiune activa. Termin-o intai.'
          : err instanceof ApiError && err.code === 'not_friends'
            ? 'Trebuie sa fiti prieteni.'
            : err?.message ?? 'Nu am putut porni sesiunea';
      Alert.alert('Hopa', msg);
    },
  });

  const myName = me.data?.name ?? 'tu';
  const stories: StoryPick[] = friend
    ? [
        ...(myStories.data?.stories ?? []).map((s) => ({
          story: s,
          authorName: myName,
          mine: true,
        })),
        ...(friendStories.data?.stories ?? []).map((s) => ({
          story: s,
          authorName: friend.user.name,
          mine: false,
        })),
      ]
    : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {friend ? 'Alege povestea' : 'Cu cine desenezi?'}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {!friend ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.hint}>
            Trebuie sa fii fizic langa prietenul tau ca sa puteti desena impreuna.
          </Text>
          {friends.isPending && <ActivityIndicator color={colors.accent} />}
          {friends.data && friends.data.friends.length === 0 && (
            <Text style={styles.empty}>
              Inca nu ai prieteni. Scaneaza bratara unui prieten din meniul de prieteni.
            </Text>
          )}
          {friends.data?.friends.map((f) => (
            <Pressable
              key={f.friendshipId}
              onPress={() => setFriend(f)}
              style={({ pressed }) => [styles.friendCard, pressed && styles.cardPressed]}
            >
              <FriendAvatar svg={f.user.avatarSvg} />
              <View style={{ flex: 1 }}>
                <Text style={styles.friendName}>{f.user.name}</Text>
                <Text style={styles.friendMeta}>Lvl {f.user.level}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.friendBanner}>
            <FriendAvatar svg={friend.user.avatarSvg} />
            <Text style={styles.friendBannerName}>cu {friend.user.name}</Text>
            <Pressable onPress={() => setFriend(null)} style={styles.changeBtn}>
              <Text style={styles.changeBtnText}>schimba</Text>
            </Pressable>
          </View>

          {(myStories.isPending || friendStories.isPending) && (
            <ActivityIndicator color={colors.accent} />
          )}

          {stories.length === 0 && !myStories.isPending && !friendStories.isPending && (
            <View style={styles.emptyBox}>
              <Text style={styles.empty}>
                Niciunul dintre voi nu are povesti inca. Mergeti la "Spune o poveste" si
                creati una intai.
              </Text>
            </View>
          )}

          {stories.map(({ story, authorName, mine }) => (
            <Pressable
              key={story.id}
              disabled={start.isPending}
              onPress={() => start.mutate({ friendId: friend.user.id, storyId: story.id })}
              style={({ pressed }) => [
                styles.storyCard,
                mine && styles.storyCardMine,
                pressed && styles.cardPressed,
                start.isPending && styles.cardDisabled,
              ]}
            >
              <View style={styles.storyHeader}>
                <Text style={styles.storyAuthor}>{mine ? 'povestea mea' : `${authorName}`}</Text>
                {mine && <View style={styles.mineBadge}><Text style={styles.mineBadgeText}>EU</Text></View>}
              </View>
              <Text style={styles.storyTitle}>{story.title}</Text>
              <Text style={styles.storyPreview} numberOfLines={3}>
                {story.body}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function FriendAvatar({ svg }: { svg: string | null }) {
  const SIZE = 48;
  if (!svg) return <View style={[styles.avatar, styles.avatarFallback]} />;
  const fullHeight = Math.round(SIZE * (1400 / 762));
  return (
    <View style={[styles.avatar, { width: SIZE, height: SIZE }]}>
      <SvgXml xml={svg} width={SIZE} height={fullHeight} />
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

  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 12 },
  hint: { color: colors.text, fontSize: 14, opacity: 0.75, lineHeight: 20, marginBottom: 4 },
  empty: { color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyBox: { padding: 32 },

  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  friendName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  friendMeta: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  chevron: { color: colors.textMuted, fontSize: 24 },

  friendBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.cardAlt,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  friendBannerName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  changeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.card,
  },
  changeBtnText: { color: colors.text, fontSize: 12, fontWeight: '700' },

  storyCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    gap: 6,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  storyCardMine: { backgroundColor: colors.cardAlt },
  storyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  storyAuthor: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  mineBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  mineBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  storyTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  storyPreview: { color: colors.text, opacity: 0.7, fontSize: 13, lineHeight: 18 },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
  },
  avatarFallback: { backgroundColor: colors.border },

  cardPressed: { transform: [{ scale: 0.98 }], opacity: 0.94 },
  cardDisabled: { opacity: 0.55 },
});
