import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getAlbum, type AlbumItem } from '../../../src/api/coCreations';
import { colors } from '../../../src/theme/colors';

export default function CoCreateAlbum() {
  const album = useQuery({ queryKey: ['co-creations', 'album'], queryFn: getAlbum });
  const [open, setOpen] = useState<AlbumItem | null>(null);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Albumul nostru</Text>
        <View style={{ width: 44 }} />
      </View>

      {album.isPending && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      {album.data?.items.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.bigIcon}>📔</Text>
          <Text style={styles.empty}>
            Inca nu aveti desene salvate. Faceti unul impreuna cu un prieten!
          </Text>
        </View>
      )}

      {album.data && album.data.items.length > 0 && (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {album.data.items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setOpen(item)}
                style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
              >
                {item.aiImageUrl ? (
                  <Image source={{ uri: item.aiImageUrl }} style={styles.tileImg} />
                ) : (
                  <View style={[styles.tileImg, styles.tilePlaceholder]} />
                )}
                <Text style={styles.tileTitle} numberOfLines={1}>
                  {item.story.title}
                </Text>
                <Text style={styles.tileMeta} numberOfLines={1}>
                  {item.participants.map((p) => p.name).join(' + ')}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      <Modal
        visible={open !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(null)} />
        <SafeAreaView edges={['top', 'bottom']} style={styles.modalWrap}>
          {open && (
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Pressable
                onPress={() => setOpen(null)}
                hitSlop={20}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>×</Text>
              </Pressable>

              <Text style={styles.modalTitle}>{open.story.title}</Text>
              <Text style={styles.modalParticipants}>
                {open.participants.map((p) => p.name).join(' + ')}
              </Text>

              <View style={styles.imagePair}>
                <View style={styles.imageBox}>
                  <Text style={styles.imageLabel}>Desenul</Text>
                  {open.originalImageUrl ? (
                    <Image source={{ uri: open.originalImageUrl }} style={styles.modalImage} />
                  ) : (
                    <View style={[styles.modalImage, styles.tilePlaceholder]} />
                  )}
                </View>
                <View style={styles.imageBox}>
                  <Text style={styles.imageLabel}>Magia AI</Text>
                  {open.aiImageUrl ? (
                    <Image source={{ uri: open.aiImageUrl }} style={styles.modalImage} />
                  ) : (
                    <View style={[styles.modalImage, styles.tilePlaceholder]} />
                  )}
                </View>
              </View>

              {open.submittedAt && (
                <Text style={styles.modalDate}>
                  {new Date(open.submittedAt).toLocaleDateString('ro-RO', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
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

  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '47.5%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 8,
    gap: 6,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  tilePressed: { transform: [{ scale: 0.97 }], opacity: 0.94 },
  tileImg: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: colors.cardAlt },
  tilePlaceholder: { backgroundColor: colors.border },
  tileTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  tileMeta: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  bigIcon: { fontSize: 60, marginBottom: 8 },
  empty: { color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' },

  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  modalWrap: { flex: 1 },
  modalScroll: { padding: 20, gap: 12 },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: colors.text, fontSize: 26, fontWeight: '700' },
  modalTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  modalParticipants: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  imagePair: { flexDirection: 'row', gap: 8, marginTop: 12 },
  imageBox: { flex: 1, gap: 6 },
  imageLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  modalImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: colors.cardAlt,
  },
  modalDate: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
});
