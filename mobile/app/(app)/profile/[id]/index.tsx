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
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SvgXml } from 'react-native-svg';
import { getMe } from '../../../../src/api/me';
import { getUserCoCreations, getUserProfile } from '../../../../src/api/users';
import { AvatarHead } from '../../../../src/avatar/AvatarHead';
import { Button } from '../../../../src/ui/Button';
import { colors } from '../../../../src/theme/colors';

// Mirror al curbei din backend (lib/level.ts).
function xpProgress(xp: number, level: number) {
  const floor = (level - 1) ** 2 * 100;
  const ceiling = level ** 2 * 100;
  const span = ceiling - floor;
  const earned = Math.max(0, xp - floor);
  return { earned, span, ratio: span > 0 ? Math.min(1, earned / span) : 0 };
}

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const profile = useQuery({
    queryKey: ['users', id],
    queryFn: () => getUserProfile(id!),
    enabled: !!id,
  });
  const cocreations = useQuery({
    queryKey: ['users', id, 'co-creations'],
    queryFn: () => getUserCoCreations(id!),
    enabled: !!id,
  });

  if (!id) return null;

  const isMe = me.data?.id === id;
  const u = profile.data;
  const progress = u ? xpProgress(u.xp, u.level) : null;
  const albums = cocreations.data?.albums ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{isMe ? 'Profilul meu' : 'Profil'}</Text>
        <View style={{ width: 44 }} />
      </View>

      {profile.isPending && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      {profile.error && (
        <View style={styles.center}>
          <Text style={styles.errorText}>Nu am putut incarca profilul.</Text>
        </View>
      )}

      {u && (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.avatarWrap}>
            <AvatarHead svg={u.avatarSvg} svgBlink={u.avatarSvgBlink} height={280} />
          </View>

          <Text style={styles.name}>{u.name}</Text>

          <View style={styles.statusBlock}>
            <View style={styles.statusLabels}>
              <Text style={styles.statusLabel}>Lvl {u.level}</Text>
              <Text style={styles.statusLabel}>
                {progress ? `${progress.earned} / ${progress.span} XP` : ''}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(progress?.ratio ?? 0) * 100}%` }]} />
            </View>
          </View>

          {isMe && (
            <Button
              label="Personalizeaza avatar"
              variant="secondary"
              onPress={() => router.push('/(app)/avatar-edit')}
            />
          )}

          <Text style={styles.sectionTitle}>
            {isMe ? 'Albumele mele' : `Albumele cu ${u.name}`}
          </Text>

          {cocreations.isPending && <ActivityIndicator color={colors.accent} />}

          {cocreations.data && albums.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📔</Text>
              <Text style={styles.emptyText}>
                {isMe
                  ? 'Inca n-ai desenat cu nimeni. Provoaca un prieten!'
                  : 'Inca n-a desenat cu nimeni.'}
              </Text>
            </View>
          )}

          <View style={styles.grid}>
            {albums.map((a) => (
              <Pressable
                key={a.partner.id}
                onPress={() =>
                  router.push(`/(app)/profile/${id}/album/${a.partner.id}`)
                }
                style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
              >
                <View style={styles.tileImgWrap}>
                  {a.coverImageUrl ? (
                    <Image source={{ uri: a.coverImageUrl }} style={styles.tileImg} />
                  ) : (
                    <View style={[styles.tileImg, styles.tilePlaceholder]} />
                  )}
                  <View style={styles.partnerBadge}>
                    <PartnerThumb svg={a.partner.avatarSvg} />
                  </View>
                </View>
                <Text style={styles.tileTitle} numberOfLines={1}>
                  cu {a.partner.name}
                </Text>
                <Text style={styles.tileMeta}>
                  {a.count} {a.count === 1 ? 'desen' : 'desene'}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function PartnerThumb({ svg }: { svg: string | null }) {
  const SIZE = 32;
  if (!svg) {
    return <View style={[styles.partnerThumb, styles.partnerThumbFallback]} />;
  }
  // SVG e 762:1400 — pastram doar capul (overflow hidden).
  const fullHeight = Math.round(SIZE * (1400 / 762));
  return (
    <View style={styles.partnerThumb}>
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

  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 14 },

  avatarWrap: { alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 26, fontWeight: '900', textAlign: 'center' },

  statusBlock: { gap: 4 },
  statusLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  statusLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.cardAlt,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 999 },

  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 8 },

  emptyBox: { alignItems: 'center', padding: 24, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },

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
  tileImgWrap: { position: 'relative' },
  tileImg: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: colors.cardAlt },
  tilePlaceholder: { backgroundColor: colors.border },
  tileTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  tileMeta: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },

  partnerBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  partnerThumb: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
  },
  partnerThumbFallback: { backgroundColor: colors.border },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
});
