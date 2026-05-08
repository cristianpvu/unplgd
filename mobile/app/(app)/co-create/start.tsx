import { useEffect, useState } from 'react';
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
import { startCoCreationByTag } from '../../../src/api/coCreations';
import { ApiError } from '../../../src/api/client';
import { getMe } from '../../../src/api/me';
import { cancelTagRead, isNfcAvailable, readTagUid } from '../../../src/lib/nfc';
import { Button } from '../../../src/ui/Button';
import { colors } from '../../../src/theme/colors';

type StoryPick = { story: Story; authorName: string; mine: boolean };

// 3 pasi in flow:
//  1. selectFriend  — alegi cu cine vrei sa desenezi (din friends list)
//  2. selectStory   — alegi povestea (a ta sau a prietenului)
//  3. scan          — apropie telefonul de bratara prietenului (validare fizica)
type Step = 'selectFriend' | 'selectStory' | 'scan';

export default function CoCreateStart() {
  const qc = useQueryClient();
  const [friend, setFriend] = useState<Friend | null>(null);
  const [pickedStory, setPickedStory] = useState<Story | null>(null);
  const [scanning, setScanning] = useState(false);
  const [nfcAvailable, setNfcAvailable] = useState<boolean | null>(null);

  const step: Step = !friend ? 'selectFriend' : !pickedStory ? 'selectStory' : 'scan';

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

  useEffect(() => {
    if (step !== 'scan') return;
    isNfcAvailable().then(setNfcAvailable);
    return () => {
      cancelTagRead();
    };
  }, [step]);

  const start = useMutation({
    mutationFn: ({ tagUid, storyId }: { tagUid: string; storyId: string }) =>
      startCoCreationByTag(tagUid, storyId),
    onSuccess: (session) => {
      qc.invalidateQueries({ queryKey: ['co-creations'] });
      router.replace(`/(app)/co-create/${session.id}`);
    },
    onError: (err: any) => {
      const msg =
        err instanceof ApiError && err.code === 'active_session'
          ? 'Ai deja o sesiune activa. Termin-o intai.'
          : err instanceof ApiError && err.code === 'not_friends'
            ? 'Bratara scanata nu apartine unui prieten al tau.'
            : err instanceof ApiError && err.code === 'bracelet_not_found'
              ? 'Bratara nu e inregistrata. Cere prietenului sa o lege intai.'
              : err instanceof ApiError && err.code === 'story_not_owned'
                ? 'Povestea aleasa nu apartine prietenului scanat. Schimba povestea sau scaneaza alta bratara.'
                : err?.message ?? 'Nu am putut porni sesiunea';
      Alert.alert('Hopa', msg);
    },
  });

  async function startScan() {
    if (!pickedStory) return;
    setScanning(true);
    try {
      const uid = await readTagUid({
        alertMessage: `Apropie telefonul de bratara lui ${friend?.user.name ?? 'prietenului tau'}`,
      });
      start.mutate({ tagUid: uid, storyId: pickedStory.id });
    } catch (e: any) {
      if (e?.message && !/cancel/i.test(e.message)) {
        Alert.alert(
          'Scanare esuata',
          'Tine bratara aproape de spatele telefonului si reincearca.',
        );
      }
    } finally {
      setScanning(false);
    }
  }

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

  const headerTitle =
    step === 'selectFriend'
      ? 'Cu cine desenezi?'
      : step === 'selectStory'
        ? 'Alege povestea'
        : 'Apropie de bratara';

  function handleBack() {
    if (step === 'scan') {
      cancelTagRead();
      setPickedStory(null);
      return;
    }
    if (step === 'selectStory') {
      setFriend(null);
      return;
    }
    router.back();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <View style={{ width: 44 }} />
      </View>

      {step === 'selectFriend' && (
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
      )}

      {step === 'selectStory' && friend && (
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
              onPress={() => setPickedStory(story)}
              style={({ pressed }) => [
                styles.storyCard,
                mine && styles.storyCardMine,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.storyHeader}>
                <Text style={styles.storyAuthor}>{mine ? 'povestea mea' : authorName}</Text>
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

      {step === 'scan' && friend && pickedStory && (
        <View style={styles.scanContainer}>
          <View style={styles.scanSummary}>
            <Text style={styles.scanSummaryLabel}>POVESTE</Text>
            <Text style={styles.scanSummaryTitle}>{pickedStory.title}</Text>
            <Text style={styles.scanSummaryFriend}>cu {friend.user.name}</Text>
          </View>

          <Text style={styles.scanTitle}>Apropie telefonul de bratara</Text>
          <Text style={styles.scanSubtitle}>
            {nfcAvailable === false
              ? 'NFC-ul nu e disponibil pe acest telefon. Verifica setarile.'
              : `Pune spatele telefonului langa bratara lui ${friend.user.name} ca sa confirmi ca sunteti impreuna.`}
          </Text>

          <View style={styles.scanIllustration}>
            <Text style={styles.bigIcon}>📡</Text>
            {(scanning || start.isPending) && (
              <View style={styles.scanningRow}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.scanningText}>
                  {start.isPending ? 'Se porneste sesiunea...' : 'Caut bratara...'}
                </Text>
              </View>
            )}
          </View>

          <Button
            label={
              start.isPending
                ? 'Se porneste...'
                : scanning
                  ? 'Anuleaza scanarea'
                  : 'Scaneaza bratara'
            }
            onPress={() => {
              if (scanning) {
                cancelTagRead();
                setScanning(false);
              } else {
                startScan();
              }
            }}
            disabled={
              nfcAvailable === false ||
              start.isPending ||
              nfcAvailable === null
            }
          />
        </View>
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

  scanContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 16,
  },
  scanSummary: {
    backgroundColor: colors.cardAlt,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  scanSummaryLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  scanSummaryTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  scanSummaryFriend: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  scanTitle: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 8 },
  scanSubtitle: {
    color: colors.text,
    fontSize: 14,
    opacity: 0.7,
    fontWeight: '500',
    lineHeight: 20,
  },
  scanIllustration: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  bigIcon: { fontSize: 96 },
  scanningRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scanningText: { color: colors.text, fontWeight: '600' },
});
