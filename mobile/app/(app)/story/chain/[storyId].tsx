import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SvgXml } from 'react-native-svg';
import {
  getStoryChain,
  absoluteAudioUrl,
  type ChainChapter,
} from '../../../../src/api/stories';
import { playPetVoiceAwait, stopDevice, stopRemoteAudio } from '../../../../src/lib/speech';
import { colors } from '../../../../src/theme/colors';

export default function StoryChain() {
  const { storyId } = useLocalSearchParams<{ storyId: string }>();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // Token pentru playback secvential — cresc la fiecare start nou; daca
  // user-ul apasa Play altundeva, run-ul vechi se opreste din auto-advance.
  const playRunRef = useRef(0);

  const chainQuery = useQuery({
    queryKey: ['stories', 'chain', storyId],
    queryFn: () => getStoryChain(storyId),
    enabled: !!storyId,
  });

  useEffect(() => {
    return () => {
      stopDevice();
      void stopRemoteAudio();
    };
  }, []);

  async function playFrom(index: number) {
    const chapters = chainQuery.data?.chapters;
    if (!chapters || index >= chapters.length) {
      setActiveIndex(null);
      return;
    }
    playRunRef.current += 1;
    const myToken = playRunRef.current;
    setActiveIndex(index);
    for (let i = index; i < chapters.length; i++) {
      const ch = chapters[i];
      if (!ch) break;
      if (myToken !== playRunRef.current) return;
      setActiveIndex(i);
      // playPetVoiceAwait asteapta finish-ul (sau cancel via stopRemoteAudio).
      await playPetVoiceAwait(ch.body, absoluteAudioUrl(ch.audioUrl));
      // Re-verificam dupa await — daca user-ul a apasat stop sau alt capitol,
      // token-ul s-a schimbat si nu vrem sa avansam la urmatorul.
      if (myToken !== playRunRef.current) return;
      // Pauza scurta intre capitole pt UX (audiobook nu suna ca o concatenare brusca).
      await new Promise((r) => setTimeout(r, 600));
      if (myToken !== playRunRef.current) return;
    }
    if (myToken === playRunRef.current) setActiveIndex(null);
  }

  function stopAll() {
    playRunRef.current += 1;
    setActiveIndex(null);
    stopDevice();
    void stopRemoteAudio();
  }

  if (chainQuery.isPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (chainQuery.error || !chainQuery.data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={() => router.back()} title="Lant" />
        <Text style={styles.errorText}>Nu am putut incarca lantul povestii</Text>
      </SafeAreaView>
    );
  }

  const { chapters, chainLength } = chainQuery.data;
  const title = chapters[0]?.title ?? 'Poveste';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header onBack={() => router.back()} title={title} />
      <View style={styles.subHeader}>
        <Text style={styles.subText}>
          {chainLength} {chainLength === 1 ? 'capitol' : 'capitole'} · scrise impreuna
        </Text>
        <Pressable
          onPress={() => (activeIndex === null ? playFrom(0) : stopAll())}
          style={({ pressed }) => [styles.playAllBtn, pressed && styles.btnPressed]}
        >
          <Text style={styles.playAllText}>
            {activeIndex === null ? '▶  Asculta tot' : '■  Stop'}
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={chapters}
        keyExtractor={(c) => c.storyId}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <ChapterCard
            chapter={item}
            isActive={activeIndex === index}
            onPlay={() => (activeIndex === index ? stopAll() : playFrom(index))}
          />
        )}
      />
    </SafeAreaView>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.headerRow}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
        <Text style={styles.back}>←</Text>
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 44 }} />
    </View>
  );
}

function ChapterCard({
  chapter,
  isActive,
  onPlay,
}: {
  chapter: ChainChapter;
  isActive: boolean;
  onPlay: () => void;
}) {
  return (
    <View style={[styles.card, isActive && styles.cardActive]}>
      <View style={styles.cardHeader}>
        <View style={styles.authorRow}>
          {chapter.author.avatarSvg ? (
            <SvgXml xml={chapter.author.avatarSvg} width={36} height={36} />
          ) : (
            <View style={styles.avatarFallback} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.chapterLabel}>Capitolul {chapter.order}</Text>
            <Text style={styles.authorName}>de {chapter.author.name}</Text>
          </View>
        </View>
        <Pressable
          onPress={onPlay}
          hitSlop={8}
          style={({ pressed }) => [
            styles.playBtn,
            isActive && styles.playBtnActive,
            pressed && styles.btnPressed,
          ]}
        >
          <Text style={styles.playIcon}>{isActive ? '■' : '▶'}</Text>
        </Pressable>
      </View>
      <Text style={styles.body}>{chapter.body}</Text>
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
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  subText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  playAllBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  playAllText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 12,
  },
  cardActive: { borderColor: colors.accent },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardAlt,
  },
  chapterLabel: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  authorName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnActive: { backgroundColor: colors.accent },
  playIcon: { color: colors.text, fontSize: 18, fontWeight: '800' },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },

  btnPressed: { transform: [{ scale: 0.95 }], opacity: 0.85 },
  errorText: { color: colors.danger, textAlign: 'center', marginTop: 24 },
});
