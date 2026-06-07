// Profilul user-ului — pager orizontal cu 3 pagini (swipe stanga-dreapta):
//   Page 1: continutul existent (avatar + pet + level + albume)
//   Page 2: skill-urile (talentele)
//   Page 3: constelatia
//
// Dots indicator jos, cu eticheta paginii curente. Toate paginile sunt scrollabile
// vertical independent. Folosit atat pentru profil propriu (isMe), cat si pentru
// profilul prietenilor — datele sunt publice (mai putin insight-ul mentor, care
// ramane exclusiv in heroes-book pt user-ul logat).

import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SvgXml } from 'react-native-svg';
import { BackgroundMedia } from '../../../../src/ui/BackgroundMedia';
import { getMe } from '../../../../src/api/me';
import { getBackgrounds, selectBackground } from '../../../../src/api/adventure';
import { getUserCoCreations, getUserProfile } from '../../../../src/api/users';
import {
  getUserSkills,
  getUserDomainsTop,
  type DomainScore,
} from '../../../../src/api/me-progress';
import { AvatarHead } from '../../../../src/avatar/AvatarHead';
import { Button } from '../../../../src/ui/Button';
import { colors } from '../../../../src/theme/colors';
import { IconArrowLeft, IconClose } from '../../../../src/ui/icons';
import { SkillsView } from '../../../../src/progress/SkillsView';
import { ConstellationView } from '../../../../src/progress/ConstellationView';

function xpProgress(xp: number, level: number) {
  const floor = (level - 1) ** 2 * 100;
  const ceiling = level ** 2 * 100;
  const span = ceiling - floor;
  const earned = Math.max(0, xp - floor);
  return { earned, span, ratio: span > 0 ? Math.min(1, earned / span) : 0 };
}

const PAGE_LABELS = ['Profil', 'Talente', 'Constelatie'];

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width: screenW } = useWindowDimensions();
  // Inset de jos pentru nav-bar Android (edge-to-edge enabled in app.json).
  // SafeAreaView ia in calcul inset-ul pt elementele flow, dar children
  // absolute (precum pagerIndicator) trebuie sa-l adauge manual.
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<ScrollView>(null);
  const [pageIndex, setPageIndex] = useState(0);
  // Dimensiunile efective ale paginii constelatiei — masurate via onLayout
  // ca ConstellationView sa umple TOATA suprafata disponibila, fara guesswork
  // pe inaltime (depinde de safe area + header + page indicator).
  const [constellationSize, setConstellationSize] = useState({ w: 0, h: 0 });

  const qc = useQueryClient();
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
  const skillsQ = useQuery({
    queryKey: ['users', id, 'skills'],
    queryFn: () => getUserSkills(id!),
    enabled: !!id,
  });
  const domainsQ = useQuery({
    queryKey: ['users', id, 'domains-top'],
    queryFn: () => getUserDomainsTop(id!, 10),
    enabled: !!id,
  });
  // Fundalurile deblocate — doar pe profilul propriu. Selectarea updateaza
  // backend-ul, apoi invalidam profilul + /me ca avatarul de sus (preview live)
  // sa se reincarce cu noul fundal.
  const backgroundsQ = useQuery({
    queryKey: ['adventure', 'backgrounds'],
    queryFn: getBackgrounds,
    enabled: !!id && me.data?.id === id,
  });
  const selectBgMut = useMutation({
    mutationFn: (key: string | null) => selectBackground(key),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adventure', 'backgrounds'] });
      qc.invalidateQueries({ queryKey: ['users', id] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const [selectedDomain, setSelectedDomain] = useState<DomainScore | null>(null);

  if (!id) return null;

  const isMe = me.data?.id === id;
  const u = profile.data;

  function onPagerScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const newIdx = Math.round(e.nativeEvent.contentOffset.x / screenW);
    if (newIdx !== pageIndex) setPageIndex(newIdx);
  }

  function goToPage(i: number) {
    pagerRef.current?.scrollTo({ x: i * screenW, animated: true });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <IconArrowLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isMe ? 'Profilul meu' : u?.name ?? 'Profil'}</Text>
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
        <>
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onPagerScroll}
            scrollEventThrottle={16}
            style={styles.pager}
          >
            {/* PAGE 1 — Profil original */}
            <View style={{ width: screenW }}>
              <ScrollView
                contentContainerStyle={[styles.pageScroll, { paddingBottom: insets.bottom + 60 }]}
                showsVerticalScrollIndicator={false}
              >
                {u.background ? (
                  <View style={styles.avatarStageFramed}>
                    <BackgroundMedia
                      imageUrl={u.background.imageUrl}
                      videoUrl={u.background.videoUrl}
                    />
                    <View style={styles.avatarStage}>
                      <AvatarHead svg={u.avatarSvg} svgBlink={u.avatarSvgBlink} height={280} />
                      {u.pet?.imageUrl && (
                        <View style={styles.profilePetContainer} pointerEvents="none">
                          <Image
                            source={{ uri: u.pet.imageUrl }}
                            style={styles.profilePetImage}
                            resizeMode="contain"
                          />
                        </View>
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={styles.avatarStage}>
                    <AvatarHead svg={u.avatarSvg} svgBlink={u.avatarSvgBlink} height={280} />
                    {u.pet?.imageUrl && (
                      <View style={styles.profilePetContainer} pointerEvents="none">
                        <Image
                          source={{ uri: u.pet.imageUrl }}
                          style={styles.profilePetImage}
                          resizeMode="contain"
                        />
                      </View>
                    )}
                  </View>
                )}

                <Text style={styles.name}>{u.name}</Text>

                <View style={styles.statusBlock}>
                  <View style={styles.statusLabels}>
                    <Text style={styles.statusLabel}>Lvl {u.level}</Text>
                    <Text style={styles.statusLabel}>
                      {`${xpProgress(u.xp, u.level).earned} / ${xpProgress(u.xp, u.level).span} XP`}
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${xpProgress(u.xp, u.level).ratio * 100}%` },
                      ]}
                    />
                  </View>
                </View>

                {isMe && (
                  <>
                    <Button
                      label="Personalizeaza avatar"
                      variant="secondary"
                      onPress={() => router.push('/(app)/avatar-edit')}
                    />
                    <Button
                      label="Cufere"
                      variant="secondary"
                      onPress={() => router.push('/(app)/chests')}
                    />
                  </>
                )}

                {isMe && backgroundsQ.data && backgroundsQ.data.backgrounds.length > 0 && (
                  <View style={styles.bgSection}>
                    <Text style={styles.bgSectionTitle}>Fundalul profilului</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.bgScroll}
                    >
                      {/* "Fara fundal" */}
                      <Pressable
                        onPress={() => selectBgMut.mutate(null)}
                        disabled={selectBgMut.isPending}
                        style={[
                          styles.bgOption,
                          styles.bgOptionNone,
                          backgroundsQ.data.selectedKey === null && styles.bgOptionActive,
                        ]}
                      >
                        <Text style={styles.bgNoneText}>Fara</Text>
                      </Pressable>
                      {backgroundsQ.data.backgrounds.map((b) => {
                        const active = backgroundsQ.data!.selectedKey === b.key;
                        return (
                          <Pressable
                            key={b.key}
                            onPress={() => selectBgMut.mutate(b.key)}
                            disabled={selectBgMut.isPending}
                            style={[styles.bgOption, active && styles.bgOptionActive]}
                          >
                            <Image
                              source={{ uri: b.imageUrl }}
                              style={styles.bgOptionImg}
                              resizeMode="cover"
                            />
                            {active && (
                              <View style={styles.bgActiveBadge}>
                                <Text style={styles.bgActiveBadgeText}>✓</Text>
                              </View>
                            )}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                <Text style={styles.sectionTitle}>
                  {isMe ? 'Albumele mele' : `Albumele cu ${u.name}`}
                </Text>

                {cocreations.isPending && <ActivityIndicator color={colors.accent} />}

                {cocreations.data && (cocreations.data.albums ?? []).length === 0 && (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>
                      {isMe
                        ? 'Inca n-ai desenat cu nimeni. Provoaca un prieten!'
                        : 'Inca n-a desenat cu nimeni.'}
                    </Text>
                  </View>
                )}

                <View style={styles.grid}>
                  {(cocreations.data?.albums ?? []).map((a) => (
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
            </View>

            {/* PAGE 2 — Talente (Skills) */}
            <View style={{ width: screenW }}>
              <ScrollView
                contentContainerStyle={[styles.pageScrollSimple, { paddingBottom: insets.bottom + 60 }]}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.pageHeading}>
                  {isMe ? 'Talentele mele' : `Talentele lui ${u.name}`}
                </Text>
                <Text style={styles.pageSubheading}>
                  Cresc cand te joci si vorbesti cu pet-ul.
                </Text>
                {skillsQ.isPending ? (
                  <ActivityIndicator color={colors.accent} style={{ marginVertical: 30 }} />
                ) : (
                  <View style={{ marginTop: 6 }}>
                    <SkillsView skills={skillsQ.data?.skills ?? []} />
                  </View>
                )}
              </ScrollView>
            </View>

            {/* PAGE 3 — Constelatie fullscreen. Container ia toata pagina,
                ConstellationView e dimensionat dupa masuratoarea reala via onLayout. */}
            <View
              style={[styles.constellationFullPage, { width: screenW }]}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                if (
                  width !== constellationSize.w ||
                  height !== constellationSize.h
                ) {
                  setConstellationSize({ w: width, h: height });
                }
              }}
            >
              {constellationSize.w > 0 && constellationSize.h > 0 && (
                <>
                  {domainsQ.isPending ? (
                    <ActivityIndicator color="#FFD27A" />
                  ) : (domainsQ.data?.domains ?? []).length === 0 ? (
                    <Text style={styles.constellationEmptyText}>
                      {isMe
                        ? 'Cerul tau e gol inca. Vorbeste cu pet-ul si joaca-te ca sa apara stele.'
                        : 'Cerul lui inca e gol — nu s-a jucat suficient.'}
                    </Text>
                  ) : (
                    <ConstellationView
                      domains={domainsQ.data?.domains ?? []}
                      width={constellationSize.w}
                      height={constellationSize.h}
                      onTap={(d) => setSelectedDomain(d)}
                      rounded={false}
                    />
                  )}
                </>
              )}
            </View>
          </ScrollView>

          {/* Page indicator dots + label. bottom = inset nav-bar + offset estetic. */}
          <View
            style={[styles.pagerIndicator, { bottom: insets.bottom + 12 }]}
            pointerEvents="box-none"
          >
            <Text style={styles.pageLabel}>{PAGE_LABELS[pageIndex]}</Text>
            <View style={styles.dotsRow}>
              {PAGE_LABELS.map((_, i) => (
                <Pressable
                  key={i}
                  onPress={() => goToPage(i)}
                  hitSlop={10}
                  style={[styles.dot, i === pageIndex && styles.dotActive]}
                />
              ))}
            </View>
          </View>
        </>
      )}

      <Modal
        visible={selectedDomain !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDomain(null)}
      >
        {selectedDomain && (
          <DomainDetailSheet
            domain={selectedDomain}
            onClose={() => setSelectedDomain(null)}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

function DomainDetailSheet({
  domain,
  onClose,
}: {
  domain: DomainScore;
  onClose: () => void;
}) {
  return (
    <View style={styles.modalBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.modalCard}>
        <Pressable onPress={onClose} style={styles.modalClose} hitSlop={12}>
          <IconClose size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.modalName}>{domain.name}</Text>
        <Text style={styles.modalLevelName}>{domain.levelName}</Text>
        <View style={styles.modalScoreRow}>
          <Text style={styles.modalScoreValue}>{domain.score}</Text>
          <Text style={styles.modalScoreLabel}>puncte de interes</Text>
        </View>
        <Text style={styles.modalHint}>{scoreHint(domain.score, domain.level)}</Text>
      </View>
    </View>
  );
}

function scoreHint(score: number, level: number): string {
  if (score === 0) return 'Niciun semnal inca.';
  if (level >= 4) return 'Unul dintre topicurile cele mai iubite saptamana asta.';
  if (level >= 2) return 'Un domeniu explorat des.';
  return 'Inceput de aventura intr-un domeniu nou.';
}

function PartnerThumb({ svg }: { svg: string | null }) {
  const SIZE = 32;
  if (!svg) {
    return <View style={[styles.partnerThumb, styles.partnerThumbFallback]} />;
  }
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
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },

  pager: { flex: 1 },
  // paddingBottom override-uit inline cu insets.bottom + offset pt indicator.
  pageScroll: { paddingHorizontal: 20, paddingTop: 8, gap: 14 },
  pageScrollSimple: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  pageHeading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 8,
  },
  pageHeadingDark: { color: '#FFF6D8' },
  pageSubheading: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  pageSubheadingDark: { color: '#C5C2E0' },

  // Pagina constelatie — FULL SCREEN. ConstellationView umple intregul
  // container (fundalul noapte e desenat de ConstellationView via SVG gradient),
  // dar adaugam si backgroundColor aici ca sa nu vedem niciun flash de bg
  // galben in primul frame inainte sa se masoare onLayout.
  constellationFullPage: {
    flex: 1,
    backgroundColor: '#06061A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  constellationEmptyText: {
    color: '#C5C2E0',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontStyle: 'italic',
    paddingHorizontal: 32,
  },

  // Page indicator — `bottom` se seteaza inline cu insets.bottom + offset.
  pagerIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 6,
  },
  pageLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  dotsRow: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: { backgroundColor: '#FFFFFF', width: 22 },

  // PAGE 1 styles (mostenite din versiunea anterioara)
  avatarStage: { position: 'relative', alignSelf: 'center' },
  avatarStageFramed: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  profilePetContainer: {
    position: 'absolute',
    bottom: 4,
    right: -20,
  },
  profilePetImage: { width: 80, height: 80 },
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

  bgSection: { gap: 8, marginTop: 4 },
  bgSectionTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  bgScroll: { gap: 10, paddingRight: 4 },
  bgOption: {
    width: 92,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
    backgroundColor: colors.cardAlt,
  },
  bgOptionActive: { borderColor: colors.accent },
  bgOptionImg: { width: '100%', height: '100%' },
  bgOptionNone: { alignItems: 'center', justifyContent: 'center' },
  bgNoneText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  bgActiveBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgActiveBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },

  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 8 },
  emptyBox: { alignItems: 'center', padding: 24, gap: 8 },
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

  // Modal pt detalii domain
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    gap: 6,
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalName: { color: colors.text, fontSize: 20, fontWeight: '900' },
  modalLevelName: { color: colors.accent, fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  modalScoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 12 },
  modalScoreValue: { color: colors.text, fontSize: 36, fontWeight: '900' },
  modalScoreLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  modalHint: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: colors.danger, fontWeight: '600' },
});
