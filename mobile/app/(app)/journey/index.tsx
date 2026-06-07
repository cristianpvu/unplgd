// Journey — drum infinit cu povesti predefinite per pet. Conducerea o face
// `StoryEngine` care consuma `Chapter.scenes[]` din StoryPack-ul mapat pe pet.
// Mobile-ul detine 100% continutul; backend-ul doar sintetizeaza TTS.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyPet, petImageUrl } from '../../../src/api/pets';
import { colors } from '../../../src/theme/colors';
import { Scene } from '../../../src/journey/Scene';
import { IntroCinematic } from '../../../src/journey/IntroCinematic';
import { getWorldForPet } from '../../../src/journey/worlds';
import { getStoryForPet } from '../../../src/journey/stories';
import { findActiveChapter, useStoryEngine } from '../../../src/journey/StoryEngine';
import { getJourneyProgress } from '../../../src/api/journey';
import { computeBiomeTransition } from '../../../src/journey/worlds/util';

const DISTANCE_TICK_MS = 90;

const STACK_OPTIONS = {
  orientation: 'landscape' as const,
  statusBarHidden: true,
  navigationBarHidden: true,
  autoHideHomeIndicator: true,
};

export default function JourneyScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const petQuery = useQuery({ queryKey: ['my-pet'], queryFn: getMyPet });
  const pet = petQuery.data?.pet ?? null;
  const petImg = petImageUrl(pet?.species.imagePath ?? null);

  const world = useMemo(() => getWorldForPet(pet?.species.slug), [pet?.species.slug]);
  const story = useMemo(() => getStoryForPet(pet?.species.slug), [pet?.species.slug]);

  // Progresul user-ului — cheam endpoint-ul ca sa stim ce capitole sunt deja
  // completate si sa pornim de la urmatorul necompletat.
  const progressQuery = useQuery({
    queryKey: ['journey-progress', pet?.species.slug],
    queryFn: () => getJourneyProgress(pet!.species.slug),
    enabled: !!pet?.species.slug,
  });
  const completedSet = useMemo(
    () => new Set(progressQuery.data?.completedChapters ?? []),
    [progressQuery.data],
  );

  const chapter = useMemo(
    () => (story ? findActiveChapter(story.chapters, completedSet) : null),
    [story, completedSet],
  );

  // Limita: max 1 capitol/zi. Daca mai e un capitol dar user-ul a terminat deja
  // unul azi, blocam pornirea (engine ramane oprit) si aratam ecran "revino maine".
  const completedToday = progressQuery.data?.completedToday ?? false;
  const dailyLocked = !!chapter && completedToday;

  // La iesirea din ecran (inclusiv dupa ce a terminat capitolul de azi),
  // invalidam progresul ca pagina pet sa arate starea proaspata (lock/terminat).
  // Pe unmount, ca sa NU comutam ecranul peste cardul de reward in timpul jocului.
  useEffect(() => {
    return () => {
      qc.invalidateQueries({ queryKey: ['journey-progress'] });
    };
  }, [qc]);

  // Intro cinematic — daca capitolul are unul, il jucam inainte sa porneasca
  // engine-ul. introDone gateaza pornirea engine-ului (chapter=null pana atunci).
  const [introDone, setIntroDone] = useState(false);
  useEffect(() => {
    // La schimbare de capitol: daca are intro → asteapta-l; altfel sari direct.
    setIntroDone(!chapter?.introCinematic);
  }, [chapter?.id, chapter?.introCinematic]);

  const { state, answerChallenge, skipCurrent } = useStoryEngine(
    introDone && !dailyLocked ? chapter : null,
    pet?.species.slug ?? null,
  );

  // Distanta — pur cosmetica, contor metri afisat sus. Nu mai dicteaza biome.
  const [distance, setDistance] = useState(0);
  useEffect(() => {
    if (!state.petCanWalk) return;
    const id = setInterval(() => setDistance((d) => d + 1), DISTANCE_TICK_MS);
    return () => clearInterval(id);
  }, [state.petCanWalk]);

  // Biome — fix per capitol. Gasim biome obj dupa chapter.biomeKey.
  const biome = useMemo(() => {
    if (!chapter) return world.biomes[0];
    return world.biomes.find((b) => b.key === chapter.biomeKey) ?? world.biomes[0];
  }, [chapter, world]);

  // Pt tranzitia smooth Scene asteapta un BiomeTransition. Cand biome-ul e
  // fix, ii dam un "static" cu t=0.
  const transition = useMemo(
    () => ({
      effective: biome,
      from: biome,
      to: biome,
      t: 0,
    }),
    [biome],
  );

  // Vizitatorul are imageUrl direct in engine state (vine din backend cu URL
  // signed/absolut). Nu mai e nevoie de lookup separat.

  if (petQuery.isPending) {
    return (
      <>
        <Stack.Screen options={STACK_OPTIONS} />
        <StatusBar hidden />
        <View style={[styles.fullScreen, styles.center]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </>
    );
  }

  if (!pet) {
    return (
      <>
        <Stack.Screen options={STACK_OPTIONS} />
        <StatusBar hidden />
        <View style={[styles.fullScreen, styles.center, { gap: 16 }]}>
          <Text style={styles.errorText}>Nu am gasit pet-ul echipat.</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtnInline}>
            <Text style={styles.backInlineText}>Inapoi</Text>
          </Pressable>
        </View>
      </>
    );
  }

  // Toate capitolele terminate — ecran de final, nu mesajul "fara povesti".
  if (story && !chapter) {
    return (
      <>
        <Stack.Screen options={STACK_OPTIONS} />
        <StatusBar hidden />
        <View style={[styles.fullScreen, styles.center]}>
          <View style={styles.endCard}>
            {petImg && (
              <Image source={{ uri: petImg }} style={styles.endPet} resizeMode="contain" />
            )}
            <Text style={styles.endTag}>AVENTURA TERMINATA</Text>
            <Text style={styles.endTitle}>{story.title}</Text>
            <Text style={styles.endSub}>
              Ai parcurs toate cele {story.chapters.length} capitole alaturi de {pet.name}. Felicitari!
            </Text>
            <Pressable onPress={() => router.back()} style={styles.endBtn}>
              <Text style={styles.endBtnText}>Inapoi la pet</Text>
            </Pressable>
          </View>
        </View>
      </>
    );
  }

  // Limita zilnica: mai e un capitol, dar user-ul a terminat deja unul azi.
  if (story && chapter && dailyLocked) {
    return (
      <>
        <Stack.Screen options={STACK_OPTIONS} />
        <StatusBar hidden />
        <View style={[styles.fullScreen, styles.center]}>
          <View style={styles.endCard}>
            {petImg && (
              <Image source={{ uri: petImg }} style={styles.endPet} resizeMode="contain" />
            )}
            <Text style={styles.endTag}>PE MAINE</Text>
            <Text style={styles.endTitle}>Capitolul de azi e gata</Text>
            <Text style={styles.endSub}>
              {pet.name} continua povestea cu un capitol nou in fiecare zi. Revino maine pentru
              urmatorul!
            </Text>
            <Pressable onPress={() => router.back()} style={styles.endBtn}>
              <Text style={styles.endBtnText}>Inapoi la pet</Text>
            </Pressable>
          </View>
        </View>
      </>
    );
  }

  if (!story || !chapter) {
    return (
      <>
        <Stack.Screen options={STACK_OPTIONS} />
        <StatusBar hidden />
        <View style={[styles.fullScreen, styles.center, { gap: 16 }]}>
          <Text style={styles.errorText}>
            {pet.name} inca nu are povesti scrise. Vin in curand!
          </Text>
          <Pressable onPress={() => router.back()} style={styles.backBtnInline}>
            <Text style={styles.backInlineText}>Inapoi</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={STACK_OPTIONS} />
      <StatusBar hidden />
      <View style={styles.fullScreen}>
        <Scene
          world={world}
          transition={transition}
          petImageUrl={petImg}
          obstacle={state.obstacle}
          visitor={state.visitor}
          companion={state.companion}
          walking={state.petCanWalk}
          vfxEvent={state.vfxEvent}
          hidePet={!introDone}
        />

        {/* Intro cinematic — peste scena, inainte de prima replica */}
        {!introDone && chapter.introCinematic && (
          <IntroCinematic
            type={chapter.introCinematic}
            petImageUrl={petImg}
            accent={biome.accent}
            onComplete={() => setIntroDone(true)}
          />
        )}

        {/* Top bar */}
        <View style={styles.topBar} pointerEvents="box-none">
          <Pressable onPress={() => router.back()} hitSlop={16} style={styles.pauseBtn}>
            <PauseIcon />
          </Pressable>
          <View style={styles.topPill}>
            <Text style={styles.biomeText}>{chapter.title}</Text>
            <Text style={styles.distanceText}>
              {state.sceneIdx + 1} / {state.totalScenes}
            </Text>
          </View>
          <Pressable onPress={skipCurrent} hitSlop={16} style={styles.skipBtn}>
            <Text style={styles.skipText}>›</Text>
          </Pressable>
        </View>

        {/* Caption — subtitle stil film. Cand obstacolul e activ, captionul se
            ridica deasupra optiunilor ca sa nu se suprapuna pe text lung. */}
        {state.caption && (
          <CaptionBar
            text={state.caption}
            speaker={state.speakerLabel}
            raised={!!state.obstacle}
          />
        )}

        {/* Panel optiuni cand engine cere raspuns la challenge */}
        {state.obstacle && (
          <ChallengeOptions
            options={state.obstacle.options}
            accentColor={biome.accent}
            onAnswer={answerChallenge}
          />
        )}

        {/* Card final cand chapterul s-a terminat — arata reward-ul */}
        {state.chapterDone && (
          <View style={styles.doneOverlay} pointerEvents="box-none">
            <View style={styles.doneCard}>
              <Text style={styles.doneTag}>CAPITOL INCHEIAT</Text>
              <Text style={styles.doneTitle}>{chapter.title}</Text>
              {state.lastReward?.bondAwarded ? (
                <Text style={styles.rewardLine}>
                  +{state.lastReward.bondAwarded} legatura cu {pet.name}
                </Text>
              ) : null}
              {state.lastReward?.unlockedBackground && (
                <View style={styles.bgUnlock}>
                  <Image
                    source={{ uri: state.lastReward.unlockedBackground.imageUrl }}
                    style={styles.bgUnlockImg}
                    resizeMode="cover"
                  />
                  <Text style={styles.bgUnlockTag}>FUNDAL NOU DEBLOCAT</Text>
                  <Text style={styles.bgUnlockName}>
                    {state.lastReward.unlockedBackground.name}
                  </Text>
                  <Text style={styles.bgUnlockHint}>
                    Il poti pune pe profil din pagina pet-ului
                  </Text>
                </View>
              )}
              <Pressable onPress={() => router.back()} style={styles.doneBtn}>
                <Text style={styles.doneBtnText}>Inapoi la pet</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Distance counter discret bottom-right — adaug insets.bottom pt nav-bar */}
        <View
          style={[styles.distanceCorner, { bottom: insets.bottom + 8, right: insets.right + 12 }]}
          pointerEvents="none"
        >
          <Text style={styles.distanceCornerText}>{distance}m</Text>
        </View>
      </View>
    </>
  );
}

// =====================================================================

function CaptionBar({
  text,
  speaker,
  raised,
}: {
  text: string;
  speaker: string | null;
  raised: boolean;
}) {
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [text, fade]);
  return (
    <Animated.View
      style={[
        styles.captionWrap,
        // bottom default 14, raised devine 60. Adaug insets.bottom in ambele
        // cazuri ca sa nu treaca peste nav-bar Android (edge-to-edge).
        { bottom: insets.bottom + (raised ? 60 : 14) },
        {
          opacity: fade,
          transform: [
            { translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          ],
        },
      ]}
      pointerEvents="none"
    >
      <View style={styles.captionCard}>
        {speaker && <Text style={styles.captionSpeaker}>{speaker}</Text>}
        <Text style={styles.captionText}>{text}</Text>
      </View>
    </Animated.View>
  );
}

function ChallengeOptions({
  options,
  accentColor,
  onAnswer,
}: {
  options: string[];
  accentColor: string;
  onAnswer: (idx: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fade]);
  return (
    <Animated.View
      style={[
        styles.optionsArea,
        { bottom: insets.bottom + 14 },
        {
          opacity: fade,
          transform: [
            { translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        },
      ]}
    >
      <View style={styles.optionsRow}>
        {options.map((opt, idx) => (
          <Pressable
            key={idx}
            onPress={() => onAnswer(idx)}
            style={({ pressed }) => [
              styles.optionBtn,
              pressed && styles.optionPressed,
              { borderColor: accentColor },
            ]}
          >
            <Text style={styles.optionText}>{opt}</Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

function PauseIcon() {
  return (
    <Svg width={14} height={16}>
      <Rect x={1} y={1} width={4} height={14} rx={1.5} fill="rgba(45, 42, 74, 0.95)" />
      <Rect x={9} y={1} width={4} height={14} rx={1.5} fill="rgba(45, 42, 74, 0.95)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  errorText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 40,
    textAlign: 'center',
  },

  topBar: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  pauseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    fontSize: 22,
    fontWeight: '900',
    color: 'rgba(45,42,74,0.95)',
    marginTop: -2,
  },
  backBtnInline: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  backInlineText: { color: colors.text, fontWeight: '700' },

  // Ecran final / blocat azi — card centrat pe fundalul aplicatiei.
  endCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 28,
    paddingHorizontal: 26,
    paddingVertical: 28,
    marginHorizontal: 28,
    gap: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
  },
  endPet: { width: 120, height: 120, marginBottom: 4 },
  endTag: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  endTitle: { color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  endSub: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 2,
  },
  endBtn: {
    marginTop: 14,
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  endBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  topPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  biomeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  distanceText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },

  // Caption — bara joasa subtitle stil film.
  captionWrap: {
    position: 'absolute',
    bottom: 14,
    left: 40,
    right: 40,
    alignItems: 'center',
  },
  // Cand exista intrebare cu optiuni, captionul se ridica deasupra randului de
  // optiuni ca sa nu se suprapuna pe text de pe 2 randuri. ~50px peste optiuni.
  captionWrapRaised: {
    bottom: 60,
  },
  captionCard: {
    backgroundColor: 'rgba(15, 15, 25, 0.78)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    maxWidth: 640,
  },
  captionText: {
    color: '#F5F2E8',
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 17,
    letterSpacing: 0.15,
  },
  captionSpeaker: {
    color: 'rgba(255, 232, 118, 0.95)',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 3,
  },

  // Optiuni — jos de tot. Captionul se ridica deasupra lor (captionWrapRaised)
  // ca sa nu mai existe suprapunere indiferent cat de lung e textul intrebarii.
  optionsArea: {
    position: 'absolute',
    bottom: 14,
    left: 40,
    right: 40,
    alignItems: 'center',
  },
  optionsRow: { flexDirection: 'row', gap: 6, maxWidth: 540 },
  optionBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    minWidth: 80,
  },
  optionPressed: { backgroundColor: colors.cardAlt, transform: [{ scale: 0.96 }] },
  optionText: { color: colors.text, fontSize: 12, fontWeight: '700', textAlign: 'center' },

  // Card final capitol.
  doneOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingHorizontal: 28,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
    minWidth: 260,
  },
  doneTag: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: 1.5,
  },
  doneTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  doneBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.accent,
    borderRadius: 12,
  },
  doneBtnText: { color: '#FFFFFF', fontWeight: '800' },
  rewardLine: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  bgUnlock: {
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
    marginBottom: 2,
  },
  bgUnlockImg: {
    width: 180,
    height: 90,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: colors.cardAlt,
  },
  bgUnlockTag: {
    fontSize: 10,
    fontWeight: '900',
    color: '#27AE60',
    letterSpacing: 1.2,
  },
  bgUnlockName: { fontSize: 14, fontWeight: '800', color: colors.text },
  bgUnlockHint: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },

  distanceCorner: {
    position: 'absolute',
    bottom: 8,
    right: 12,
  },
  distanceCornerText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
  },
});
