import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  SvgXml,
} from 'react-native-svg';
import { getMe } from '../../src/api/me';
import { getMyAvatar } from '../../src/api/avatar';
import {
  listChests,
  openChest,
  type ChestDto,
  type ChestLoot,
  type ChestTier,
  type Rarity,
} from '../../src/api/chests';
import { listFriends } from '../../src/api/friends';
import { getMyPet, petImageUrl } from '../../src/api/pets';
import { ApiError } from '../../src/api/client';
import { useAuth } from '../../src/lib/auth';
import { AvatarHead, type AvatarHeadHandle } from '../../src/avatar/AvatarHead';
import { PetSpeechBubble } from '../../src/ui/PetSpeechBubble';
import { PetBadge } from '../../src/ui/PetBadge';
import { CoWalkButton } from '../../src/ble/CoWalkProgress';
import { colors } from '../../src/theme/colors';

type SheetKind = 'friends' | 'settings' | 'notifications' | null;

// Mirror al curbei din backend (lib/level.ts): level = 1 + floor(sqrt(xp/100)).
// Tinem calculul aici ca sa nu mai facem un round-trip pt afisaj.
function xpProgress(xp: number, level: number) {
  const floor = (level - 1) ** 2 * 100;
  const ceiling = level ** 2 * 100;
  const span = ceiling - floor;
  const earned = Math.max(0, xp - floor);
  return { earned, span, ratio: span > 0 ? Math.min(1, earned / span) : 0 };
}

export default function Home() {
  const { signOut } = useAuth();
  const { data: me, isPending, error } = useQuery({ queryKey: ['me'], queryFn: getMe });
  const { data: avatar, error: avatarError } = useQuery({
    queryKey: ['avatar'],
    queryFn: getMyAvatar,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });
  const avatarRef = useRef<AvatarHeadHandle>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const friendsQuery = useQuery({
    queryKey: ['friends'],
    queryFn: listFriends,
    enabled: sheet === 'friends',
  });
  const petQuery = useQuery({ queryKey: ['pet'], queryFn: getMyPet });
  const petImage = petImageUrl(petQuery.data?.pet.species.imagePath ?? null);
  const petName = petQuery.data?.pet.name ?? null;
  const petCatchphrases = petQuery.data?.pet.species.catchphrases ?? [];

  // Daca user-ul e logat dar n-a apucat sa-si creeze avatarul (a inchis app-ul
  // pe mijlocul onboarding-ului), il trimitem inapoi in flow-ul de creare.
  useEffect(() => {
    if (avatarError instanceof ApiError && avatarError.status === 404) {
      router.replace('/(app)/avatar-edit?firstTime=1');
    }
  }, [avatarError]);

  const progress = me ? xpProgress(me.xp, me.level) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <IconButton
            onPress={() => setSheet('notifications')}
            accessibilityLabel="Notificari"
          >
            <BellIcon />
          </IconButton>
          <View style={styles.statusBlock}>
            <View style={styles.statusLabels}>
              <Text style={styles.statusLabel}>Lvl {me?.level ?? '-'}</Text>
              <Text style={styles.statusLabel}>
                {progress ? `${progress.earned} / ${progress.span} XP` : ''}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(progress?.ratio ?? 0) * 100}%` }]} />
            </View>
          </View>
          <IconButton onPress={() => setSheet('settings')} accessibilityLabel="Setari">
            <GearIcon />
          </IconButton>
        </View>

        <View style={styles.sideMenu} pointerEvents="box-none">
          <IconButton onPress={() => setSheet('friends')} accessibilityLabel="Prieteni">
            <FriendsIcon />
          </IconButton>
          <CoWalkButton />
          <ChestsSideButton />
        </View>

        <Text style={styles.hello} numberOfLines={1}>
          Salut{me ? `, ${me.name}` : ''}!
        </Text>

        <View style={styles.scene}>
          <View style={styles.avatarStage}>
            <Pressable
              onPressIn={() => avatarRef.current?.bounce()}
              onPress={() => router.push('/(app)/avatar-edit')}
            >
              <AvatarHead ref={avatarRef} svg={avatar?.svg} svgBlink={avatar?.svgBlink} height={420} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.petContainer, pressed && styles.petContainerPressed]}
              onPress={() => router.push('/(app)/chat')}
              onLongPress={() => router.push('/(app)/pets')}
              hitSlop={8}
            >
              {petImage ? (
                <Image source={{ uri: petImage }} style={styles.petImage} resizeMode="contain" />
              ) : (
                <View style={[styles.petImage, styles.petPlaceholder]}>
                  <Text style={styles.petPlaceholderEmoji}>🐾</Text>
                </View>
              )}
            </Pressable>
            {petQuery.data && (
              <View style={styles.bubbleAnchor} pointerEvents="box-none">
                <PetSpeechBubble
                  phrases={petCatchphrases}
                  petName={petName ?? 'Buddy'}
                  onPress={() => router.push('/(app)/chat')}
                />
              </View>
            )}
          </View>
        </View>

        {isPending && <ActivityIndicator color={colors.accent} />}
        {error && (
          <Text style={styles.errorText}>
            {error instanceof ApiError
              ? `[${error.status}] ${error.code ?? ''} — ${error.message}`
              : (error as Error).message}
          </Text>
        )}

        <Pressable
          onPress={() => router.push('/(app)/play')}
          style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}
        >
          <Text style={styles.playButtonText}>Hai la joaca!</Text>
        </Pressable>
      </View>

      <BottomSheet
        visible={sheet !== null}
        title={
          sheet === 'friends'
            ? 'Prietenii mei'
            : sheet === 'notifications'
              ? 'Notificari'
              : 'Setari'
        }
        onClose={() => setSheet(null)}
      >
        {sheet === 'friends' && (
          <View style={styles.sheetList}>
            {friendsQuery.isPending && <ActivityIndicator color={colors.accent} />}
            {friendsQuery.error && (
              <Text style={styles.errorText}>Nu am putut incarca prietenii</Text>
            )}
            {friendsQuery.data && friendsQuery.data.friends.length === 0 && (
              <Text style={styles.sheetEmpty}>Inca nu ai prieteni adaugati.</Text>
            )}
            {friendsQuery.data?.friends.map((f) => (
              <Pressable
                key={f.friendshipId}
                onPress={() => {
                  setSheet(null);
                  router.push(`/(app)/profile/${f.user.id}`);
                }}
                style={({ pressed }) => [styles.friendRow, pressed && styles.friendRowPressed]}
              >
                <FriendAvatar svg={f.user.avatarSvg} petImageUrl={f.user.pet?.imageUrl ?? null} />
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName} numberOfLines={1}>
                    {f.user.name}
                  </Text>
                  <Text style={styles.friendLevel}>Lvl {f.user.level} · {f.user.xp} XP</Text>
                </View>
                <Text style={styles.friendChevron}>›</Text>
              </Pressable>
            ))}
            <SheetItem
              label="Adauga prieten"
              onPress={() => {
                setSheet(null);
                router.push('/(app)/add-friend');
              }}
            />
          </View>
        )}
        {sheet === 'notifications' && (
          <View style={styles.sheetList}>
            <Text style={styles.sheetEmpty}>Inca nu ai notificari.</Text>
          </View>
        )}
        {sheet === 'settings' && (
          <View style={styles.sheetList}>
            <SheetItem
              label="Profilul meu"
              onPress={() => {
                setSheet(null);
                if (me?.id) router.push(`/(app)/profile/${me.id}`);
              }}
            />
            <SheetItem
              label="Bratara mea"
              onPress={() => {
                setSheet(null);
                router.push('/(app)/link-bracelet');
              }}
            />
            <SheetItem
              label="Iesi din cont"
              danger
              onPress={() => {
                setSheet(null);
                signOut();
              }}
            />
          </View>
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}

function IconButton({
  onPress,
  children,
  accessibilityLabel,
}: {
  onPress: () => void;
  children: ReactNode;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
    >
      {children}
    </Pressable>
  );
}

function FriendsIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8} r={3.2} stroke={colors.text} strokeWidth={2} />
      <Path
        d="M3 19c0-3 2.7-5 6-5s6 2 6 5"
        stroke={colors.text}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 11.2a3 3 0 1 0 0-6"
        stroke={colors.text}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17 19c0-2.5 1.6-4.3 4-5"
        stroke={colors.text}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function BellIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 9a6 6 0 1 1 12 0c0 3.5 1 5 2 6H4c1-1 2-2.5 2-6Z"
        stroke={colors.text}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 19a2 2 0 0 0 4 0"
        stroke={colors.text}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Buton de cufere in side rail — expand-uri inline cu lista de stacks pe tier.
// Tap pe stack → openChest pe primul cufar de acel tier, loot apare in panel.
// Nu navigare la pagina noua — totul aici.
const TIER_LABEL: Record<ChestTier, string> = {
  BRONZE: 'Bronz',
  SILVER: 'Argint',
  GOLD: 'Aur',
  PLATINUM: 'Platina',
  DIAMOND: 'Diamant',
  CHAMPION: 'Campion',
};

// Culori per raritate pentru pastila/border-ul tile-ului de item in loot reveal.
// Mai rar = mai cald.
const RARITY_COLOR: Record<Rarity, string> = {
  COMMON: '#A8B4BD',
  RARE: '#5DA9FF',
  EPIC: '#B86AE0',
  LEGENDARY: '#FFB347',
};

type TierStyle = {
  bg: string;
  dark: string;
  fg: string;
  glow: string;
  // shading suplimentar pt body
  bodyTop: string;
  bodyBot: string;
  // benzi metalice
  metal: string;
  metalDark: string;
  metalLight: string;
  // gem pe lid (null = fara gem)
  gem: string | null;
  gemHi: string;
  // coroana pe top (doar CHAMPION)
  crown: boolean;
};

const TIER_COLORS: Record<ChestTier, TierStyle> = {
  BRONZE: {
    bg: '#C68B59', dark: '#6B3F1A', fg: '#FFF6E8', glow: '#FFD7A8',
    bodyTop: '#E4A974', bodyBot: '#8E5A2E',
    metal: '#A86C3A', metalDark: '#6B3F1A', metalLight: '#D9A37A',
    gem: null, gemHi: '#FFFFFF', crown: false,
  },
  SILVER: {
    bg: '#C0CBD4', dark: '#5F6F7B', fg: '#1F3344', glow: '#F0F5F9',
    bodyTop: '#DCE4EB', bodyBot: '#8A98A4',
    metal: '#8E9CA8', metalDark: '#5F6F7B', metalLight: '#C8D2DA',
    gem: '#E8F4FF', gemHi: '#FFFFFF', crown: false,
  },
  GOLD: {
    bg: '#F2C744', dark: '#7A5A0E', fg: '#5B3F00', glow: '#FFEFA8',
    bodyTop: '#FFE070', bodyBot: '#B58A14',
    metal: '#D6A012', metalDark: '#7A5A0E', metalLight: '#FFD968',
    gem: '#FF6A6A', gemHi: '#FFD0D0', crown: false,
  },
  PLATINUM: {
    bg: '#7FE0D0', dark: '#1F6358', fg: '#0C3F38', glow: '#C2FFF4',
    bodyTop: '#B4EFE3', bodyBot: '#3FA597',
    metal: '#3FA597', metalDark: '#1F6358', metalLight: '#7CD5C6',
    gem: '#3FE0FF', gemHi: '#E6FAFF', crown: false,
  },
  DIAMOND: {
    bg: '#9AB3FF', dark: '#2B3F8E', fg: '#1B2870', glow: '#E2EAFF',
    bodyTop: '#C7D5FF', bodyBot: '#5A77D4',
    metal: '#5A77D4', metalDark: '#2B3F8E', metalLight: '#A8BAFF',
    gem: '#9DF5FF', gemHi: '#FFFFFF', crown: false,
  },
  CHAMPION: {
    bg: '#FF7A59', dark: '#7A2812', fg: '#FFFFFF', glow: '#FFD9C2',
    bodyTop: '#FFA888', bodyBot: '#C04A2D',
    metal: '#D6A012', metalDark: '#7A5A0E', metalLight: '#FFD968',
    gem: '#FF3A3A', gemHi: '#FFC8C8', crown: true,
  },
};

const TIER_ORDER: ChestTier[] = ['CHAMPION', 'DIAMOND', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE'];

// Inaltimi precalculate pt animatia smooth de expand. Tinem 4 mini-stacks
// vizibile (peste 4 → scroll), apoi capsule trebuie sa stie inaltimea exacta
// ca sa animeze cu useNativeDriver:false (height anim NU suporta native).
const STACK_H = 36;
const STACK_GAP = 8;
const PAD_TOP = 6;
const PAD_BOTTOM = 8;
const MAX_VISIBLE = 4;

function stacksHeight(n: number) {
  const visible = Math.min(Math.max(n, 1), MAX_VISIBLE);
  return PAD_TOP + visible * STACK_H + (visible - 1) * STACK_GAP + PAD_BOTTOM;
}

function ChestsSideButton() {
  const qc = useQueryClient();
  const chestsQ = useQuery({ queryKey: ['chests'], queryFn: listChests });
  const [open, setOpen] = useState(false);
  const [loot, setLoot] = useState<{ tier: ChestTier; loot: ChestLoot } | null>(null);
  const expand = useRef(new Animated.Value(0)).current;

  const chests = chestsQ.data?.chests ?? [];
  const unopened = useMemo(() => chests.filter((c) => !c.openedAt), [chests]);
  const stacks = useMemo(() => {
    const map = new Map<ChestTier, ChestDto[]>();
    for (const c of unopened) {
      const arr = map.get(c.tier) ?? [];
      arr.push(c);
      map.set(c.tier, arr);
    }
    return TIER_ORDER.filter((t) => map.has(t)).map((t) => ({
      tier: t,
      chests: map.get(t)!,
    }));
  }, [unopened]);

  const openMut = useMutation({
    mutationFn: (chestId: string) => openChest(chestId),
    onSuccess: (data, chestId) => {
      const chest = chests.find((c) => c.id === chestId);
      if (chest) setLoot({ tier: chest.tier, loot: data.loot });
      qc.invalidateQueries({ queryKey: ['chests'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e: any) => Alert.alert('Eroare', e?.message ?? 'Nu am putut deschide cufarul'),
  });

  function handleOpen(tier: ChestTier) {
    if (openMut.isPending) return;
    const stack = stacks.find((s) => s.tier === tier);
    if (!stack || stack.chests.length === 0) return;
    openMut.mutate(stack.chests[0].id);
  }

  // Smooth expand/collapse: animam inaltimea sectiunii de stacks de la 0 la
  // valoarea calculata pe baza de stacks (cu cap la MAX_VISIBLE × stack_h).
  // useNativeDriver:false pentru ca animatia de height nu poate fi native.
  useEffect(() => {
    Animated.timing(expand, {
      toValue: open ? 1 : 0,
      duration: 260,
      easing: Easing.bezier(0.22, 1, 0.36, 1), // out-quint, smooth modern
      useNativeDriver: false,
    }).start();
  }, [open, expand]);

  const targetHeight = stacksHeight(stacks.length);
  const animHeight = expand.interpolate({ inputRange: [0, 1], outputRange: [0, targetHeight] });
  const animOpacity = expand.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.4, 1] });

  return (
    <View style={styles.chestsWrap}>
      <View style={styles.chestsCapsule}>
        <Pressable
          onPress={() => {
            if (loot) setLoot(null);
            setOpen((v) => !v);
          }}
          accessibilityLabel="Cufere"
          hitSlop={8}
          style={({ pressed }) => [
            styles.chestsTrigger,
            pressed && styles.chestsTriggerPressed,
          ]}
        >
          <ChestIcon />
        </Pressable>
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[styles.stacksClip, { height: animHeight, opacity: animOpacity }]}
      >
        <ScrollView
          contentContainerStyle={styles.stacksInside}
          showsVerticalScrollIndicator={false}
          bounces={false}
          nestedScrollEnabled
        >
          {stacks.length === 0 ? (
            <Text style={styles.chestsEmptyText}>0</Text>
          ) : (
            stacks.map((s) => {
              const c = TIER_COLORS[s.tier];
              return (
                <Pressable
                  key={s.tier}
                  onPress={() => handleOpen(s.tier)}
                  disabled={openMut.isPending}
                  accessibilityLabel={`Cufar ${TIER_LABEL[s.tier]}`}
                  style={({ pressed }) => [
                    styles.miniStack,
                    (pressed || openMut.isPending) && { opacity: 0.6 },
                  ]}
                >
                  <MiniChestSvg tier={s.tier} />
                  <View style={[styles.miniStackBadge, { backgroundColor: c.dark }]}>
                    <Text style={styles.miniStackBadgeText}>{s.chests.length}</Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </Animated.View>
      </View>
      {!open && unopened.length > 0 && (
        <View pointerEvents="none" style={styles.chestDotBadge}>
          <Text style={styles.chestDotBadgeText}>
            {unopened.length > 9 ? '9+' : unopened.length}
          </Text>
        </View>
      )}
      <Modal
        visible={loot !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setLoot(null)}
      >
        {loot && (
          <LootRevealInline
            loot={loot.loot}
            tier={loot.tier}
            onDismiss={() => setLoot(null)}
          />
        )}
      </Modal>
    </View>
  );
}

// Mini chest pentru stack — small dar polished: gradient pe corp si lid,
// nituri metalice mici si keyhole. ID-uri unice per tier ca sa nu se ciocneasca
// gradient defs intre stacks.
function MiniChestSvg({ tier }: { tier: ChestTier }) {
  const c = TIER_COLORS[tier];
  const gid = `mini-${tier}`;
  return (
    <Svg width={34} height={32} viewBox="0 0 26 24" fill="none">
      <Defs>
        <LinearGradient id={`${gid}-body`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.bodyTop} />
          <Stop offset="1" stopColor={c.bodyBot} />
        </LinearGradient>
        <LinearGradient id={`${gid}-lid`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.bodyTop} />
          <Stop offset="1" stopColor={c.bg} />
        </LinearGradient>
      </Defs>
      {/* corp */}
      <Path
        d="M3 12 H23 V21 a1.5 1.5 0 0 1 -1.5 1.5 H4.5 A1.5 1.5 0 0 1 3 21 Z"
        fill={`url(#${gid}-body)`}
        stroke={c.dark}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {/* lid */}
      <Path
        d="M3 12 V8 a4 4 0 0 1 4 -4 h12 a4 4 0 0 1 4 4 v4 Z"
        fill={`url(#${gid}-lid)`}
        stroke={c.dark}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {/* banda metalica orizontala (linia de inchidere) */}
      <Path d="M3 12 H23" stroke={c.dark} strokeWidth={1.4} strokeLinecap="round" />
      {/* incuietoare */}
      <Rect x="11" y="13.5" width="4" height="5" rx="0.6" fill={c.metalDark} />
      <Circle cx="13" cy="15.2" r="0.7" fill={c.dark} />
      {/* highlight curbat pe lid */}
      <Path d="M6 8 a5 5 0 0 1 5 -3" stroke={c.glow} strokeWidth={0.9} strokeLinecap="round" fill="none" opacity={0.85} />
    </Svg>
  );
}

// Chest SVG mare pentru animatia de deschidere — corpul si lid-ul sunt SVG-uri
// separate, ca lid-ul sa poata fi animat independent (ridicare + rotire).
// Detalii: gradient pe corp (lumina sus, umbra jos), benzi metalice cu propriul
// gradient, nituri rotunde, keyhole. Pe tier-uri mari (Diamond/Champion) apare
// gem central; Champion are si coroana mica.
function BigChestBody({ tier, size }: { tier: ChestTier; size: number }) {
  const c = TIER_COLORS[tier];
  const gid = `body-${tier}`;
  return (
    <Svg width={size} height={size * 0.7} viewBox="0 0 100 70" fill="none">
      <Defs>
        <LinearGradient id={`${gid}-body`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.bodyTop} />
          <Stop offset="0.5" stopColor={c.bg} />
          <Stop offset="1" stopColor={c.bodyBot} />
        </LinearGradient>
        <LinearGradient id={`${gid}-metal`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.metalLight} />
          <Stop offset="0.5" stopColor={c.metal} />
          <Stop offset="1" stopColor={c.metalDark} />
        </LinearGradient>
        <RadialGradient id={`${gid}-keyhole`} cx="0.5" cy="0.45" r="0.6">
          <Stop offset="0" stopColor={c.metalDark} />
          <Stop offset="1" stopColor="#000000" />
        </RadialGradient>
      </Defs>
      {/* corp principal */}
      <Path
        d="M4 4 H96 V60 a6 6 0 0 1 -6 6 H10 a6 6 0 0 1 -6 -6 Z"
        fill={`url(#${gid}-body)`}
        stroke={c.dark}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      {/* banda metalica de jos */}
      <Rect x="2" y="56" width="96" height="9" rx="2" fill={`url(#${gid}-metal)`} stroke={c.dark} strokeWidth={1.6} />
      {/* nituri pe banda jos */}
      <Circle cx="10" cy="60.5" r="1.6" fill={c.metalLight} stroke={c.dark} strokeWidth={0.8} />
      <Circle cx="50" cy="60.5" r="1.6" fill={c.metalLight} stroke={c.dark} strokeWidth={0.8} />
      <Circle cx="90" cy="60.5" r="1.6" fill={c.metalLight} stroke={c.dark} strokeWidth={0.8} />
      {/* benzi verticale metalice stanga si dreapta */}
      <Rect x="6" y="4" width="8" height="56" fill={`url(#${gid}-metal)`} stroke={c.dark} strokeWidth={1.4} />
      <Rect x="86" y="4" width="8" height="56" fill={`url(#${gid}-metal)`} stroke={c.dark} strokeWidth={1.4} />
      {/* nituri verticale */}
      <Circle cx="10" cy="10" r="1.4" fill={c.metalLight} stroke={c.dark} strokeWidth={0.7} />
      <Circle cx="10" cy="30" r="1.4" fill={c.metalLight} stroke={c.dark} strokeWidth={0.7} />
      <Circle cx="10" cy="50" r="1.4" fill={c.metalLight} stroke={c.dark} strokeWidth={0.7} />
      <Circle cx="90" cy="10" r="1.4" fill={c.metalLight} stroke={c.dark} strokeWidth={0.7} />
      <Circle cx="90" cy="30" r="1.4" fill={c.metalLight} stroke={c.dark} strokeWidth={0.7} />
      <Circle cx="90" cy="50" r="1.4" fill={c.metalLight} stroke={c.dark} strokeWidth={0.7} />
      {/* incuietoare centrala — placa metalica + keyhole */}
      <Rect x="42" y="20" width="16" height="22" rx="2" fill={`url(#${gid}-metal)`} stroke={c.dark} strokeWidth={1.6} />
      <Circle cx="50" cy="28" r="2.4" fill={`url(#${gid}-keyhole)`} stroke={c.dark} strokeWidth={0.8} />
      <Path d="M50 30 L48.5 36 H51.5 Z" fill={c.dark} />
      {/* highlight lung pe corp (luciu vertical stanga) */}
      <Rect x="17" y="6" width="2.5" height="48" fill={c.glow} opacity={0.25} rx="1" />
    </Svg>
  );
}

function BigChestLid({ tier, size }: { tier: ChestTier; size: number }) {
  const c = TIER_COLORS[tier];
  const gid = `lid-${tier}`;
  return (
    <Svg width={size} height={size * 0.5} viewBox="0 0 100 50" fill="none">
      <Defs>
        <LinearGradient id={`${gid}-lid`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.bodyTop} />
          <Stop offset="0.65" stopColor={c.bg} />
          <Stop offset="1" stopColor={c.bodyBot} />
        </LinearGradient>
        <LinearGradient id={`${gid}-metal`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.metalLight} />
          <Stop offset="1" stopColor={c.metalDark} />
        </LinearGradient>
        {c.gem && (
          <RadialGradient id={`${gid}-gem`} cx="0.4" cy="0.35" r="0.7">
            <Stop offset="0" stopColor={c.gemHi} />
            <Stop offset="0.5" stopColor={c.gem} />
            <Stop offset="1" stopColor={c.dark} />
          </RadialGradient>
        )}
      </Defs>
      {/* lid principal — semi-curbat sus, drept jos */}
      <Path
        d="M4 46 V22 a18 18 0 0 1 18 -18 h56 a18 18 0 0 1 18 18 v24 Z"
        fill={`url(#${gid}-lid)`}
        stroke={c.dark}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      {/* benzi metalice verticale stanga/dreapta */}
      <Path d="M6 14 a16 16 0 0 1 8 -10 H14 V46 H6 Z" fill={`url(#${gid}-metal)`} stroke={c.dark} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M94 14 a16 16 0 0 0 -8 -10 H86 V46 H94 Z" fill={`url(#${gid}-metal)`} stroke={c.dark} strokeWidth={1.4} strokeLinejoin="round" />
      {/* nituri pe lid */}
      <Circle cx="10" cy="42" r="1.4" fill={c.metalLight} stroke={c.dark} strokeWidth={0.7} />
      <Circle cx="90" cy="42" r="1.4" fill={c.metalLight} stroke={c.dark} strokeWidth={0.7} />
      <Circle cx="10" cy="20" r="1.4" fill={c.metalLight} stroke={c.dark} strokeWidth={0.7} />
      <Circle cx="90" cy="20" r="1.4" fill={c.metalLight} stroke={c.dark} strokeWidth={0.7} />
      {/* banda metalica jos (intalnirea cu corpul) */}
      <Rect x="2" y="42" width="96" height="6" fill={`url(#${gid}-metal)`} stroke={c.dark} strokeWidth={1.4} />
      {/* highlight curbat pe lid (luciu) */}
      <Path d="M18 16 a14 14 0 0 1 14 -10" stroke={c.glow} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.85}/>
      {/* gem central pe lid (doar tiere care au gem) */}
      {c.gem && (
        <G>
          <Ellipse cx="50" cy="22" rx="7" ry="9" fill={`url(#${gid}-gem)`} stroke={c.dark} strokeWidth={1.4} />
          <Ellipse cx="48" cy="19" rx="2" ry="3" fill={c.gemHi} opacity={0.85} />
        </G>
      )}
      {/* coroana mica pe top (doar CHAMPION) */}
      {c.crown && (
        <G>
          <Path d="M40 5 L44 -1 L50 4 L56 -1 L60 5 L60 9 L40 9 Z" fill={c.metal} stroke={c.dark} strokeWidth={1.4} strokeLinejoin="round" transform="translate(0 1)"/>
          <Circle cx="44" cy="1" r="1.6" fill={c.gem ?? c.glow} stroke={c.dark} strokeWidth={0.7} transform="translate(0 1)"/>
          <Circle cx="50" cy="4.5" r="1.6" fill={c.gem ?? c.glow} stroke={c.dark} strokeWidth={0.7} transform="translate(0 1)"/>
          <Circle cx="56" cy="1" r="1.6" fill={c.gem ?? c.glow} stroke={c.dark} strokeWidth={0.7} transform="translate(0 1)"/>
        </G>
      )}
    </Svg>
  );
}

// Particule care explodeaza din chest la deschidere — monede mici + sparks.
// Acceptam un Animated.Value 'progress' (0→1): la 0 sunt strans in centru,
// la 1 sunt imprastiate radial. Folosim 'fadeOut' (0→1) ca opacity reverse.
function ParticleBurst({
  progress,
  fadeOut,
  tier,
}: {
  progress: Animated.Value;
  fadeOut: Animated.Value;
  tier: ChestTier;
}) {
  const c = TIER_COLORS[tier];
  // 10 particule cu unghi + raza maxima diferite
  const particles = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        const radius = 70 + (i % 3) * 18; // raza variabila
        return {
          dx: Math.cos(angle - Math.PI / 2) * radius,
          dy: Math.sin(angle - Math.PI / 2) * radius - 20, // bias in sus
          size: 8 + (i % 3) * 2,
          color: i % 2 === 0 ? c.metal : c.glow,
          delay: i * 18,
        };
      }),
    [c.metal, c.glow],
  );
  return (
    <>
      {particles.map((p, i) => {
        const x = progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] });
        const y = progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] });
        const opacity = fadeOut.interpolate({
          inputRange: [0, 0.15, 0.85, 1],
          outputRange: [0, 1, 1, 0],
        });
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${(i % 2 === 0 ? 1 : -1) * 360}deg`],
        });
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: '50%',
              top: '40%',
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: p.color,
              borderWidth: 1.5,
              borderColor: c.dark,
              marginLeft: -p.size / 2,
              marginTop: -p.size / 2,
              opacity,
              transform: [{ translateX: x }, { translateY: y }, { rotate }],
              shadowColor: c.glow,
              shadowOpacity: 0.9,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
        );
      })}
    </>
  );
}

// Raze de lumina care ies din chest cand se deschide — 8 raze radiale,
// scale-up + fade. Compus din View-uri rotate (mai performant decat SVG anim).
function LightRays({ progress, tier }: { progress: Animated.Value; tier: ChestTier }) {
  const c = TIER_COLORS[tier];
  const rays = 8;
  const opacity = progress.interpolate({
    inputRange: [0, 0.3, 0.8, 1],
    outputRange: [0, 0.7, 0.5, 0],
  });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.5] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: '50%',
        top: '40%',
        width: 0,
        height: 0,
        opacity,
        transform: [{ scale }],
      }}
    >
      {Array.from({ length: rays }, (_, i) => {
        const angle = (i / rays) * 360;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: 12,
              height: 160,
              marginLeft: -6,
              marginTop: -80,
              backgroundColor: c.glow,
              opacity: 0.5,
              borderRadius: 6,
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}
    </Animated.View>
  );
}

// Reveal stil Clash Royale: chest aterizeaza cu spring → shake → flash + burst
// → lid sare in sus + roteste → loot apare cu pop sequential → XP big
function LootRevealInline({
  loot,
  tier,
  onDismiss,
}: {
  loot: ChestLoot;
  tier: ChestTier;
  onDismiss: () => void;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const lid = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const [showOk, setShowOk] = useState(false);

  useEffect(() => {
    Animated.timing(backdrop, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    Animated.sequence([
      // 1. Chest enters from below with spring bounce
      Animated.spring(enter, {
        toValue: 1,
        friction: 5,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.delay(120),
      // 2. Shake 4× alternating
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 70, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 70, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 1, duration: 70, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 70, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]),
      // 3. Burst + lid pop in parallel
      Animated.parallel([
        Animated.timing(burst, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
        Animated.spring(lid, {
          toValue: 1,
          friction: 5,
          tension: 90,
          useNativeDriver: true,
        }),
      ]),
      // 4. Loot reveal
      Animated.spring(reveal, {
        toValue: 1,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start(() => setShowOk(true));
  }, [enter, shake, burst, lid, reveal, backdrop]);

  const c = TIER_COLORS[tier];

  const enterScale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const enterY = enter.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });
  const shakeRot = shake.interpolate({ inputRange: [-1, 1], outputRange: ['-7deg', '7deg'] });
  const burstScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.2, 2.6] });
  const burstOpacity = burst.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.85, 0],
  });
  const lidY = lid.interpolate({ inputRange: [0, 1], outputRange: [0, -36] });
  const lidRot = lid.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-22deg'] });
  const revealScale = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const revealY = reveal.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  return (
    <Animated.View style={[styles.lootBackdrop, { opacity: backdrop }]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={showOk ? onDismiss : undefined}
      />

      {/* Burst behind chest — glow ring care explodeaza din spatele cufarului */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.burstRing,
          {
            transform: [{ scale: burstScale }],
            opacity: burstOpacity,
            backgroundColor: c.glow,
          },
        ]}
      />

      {/* Raze de lumina radiale — ies din chest cand se ridica lid-ul */}
      <LightRays progress={burst} tier={tier} />

      {/* Chest container — enter scale + shake rotation */}
      <Animated.View
        style={[
          styles.chestContainer,
          {
            transform: [{ translateY: enterY }, { scale: enterScale }, { rotate: shakeRot }],
          },
        ]}
      >
        {/* Lid (animat separat — translateY si rotate) */}
        <Animated.View
          style={{
            transform: [{ translateY: lidY }, { rotate: lidRot }],
            transformOrigin: 'bottom left',
          }}
        >
          <BigChestLid tier={tier} size={160} />
        </Animated.View>
        {/* Body */}
        <View style={{ marginTop: -4 }}>
          <BigChestBody tier={tier} size={160} />
        </View>
        {/* Monede + sparks care explodeaza din lid */}
        <ParticleBurst progress={burst} fadeOut={burst} tier={tier} />
      </Animated.View>

      {/* Loot detalii */}
      <Animated.View
        style={[
          styles.lootCard,
          {
            backgroundColor: c.bg,
            borderColor: c.dark,
            opacity: reveal,
            transform: [{ translateY: revealY }, { scale: revealScale }],
          },
        ]}
      >
        <Text style={[styles.lootTier, { color: c.fg }]}>{TIER_LABEL[tier]}</Text>
        <Text style={[styles.lootXp, { color: c.fg }]}>+{loot.xp} XP</Text>

        {loot.items.length > 0 && (
          <View style={styles.lootGrid}>
            {loot.items.map((it) => (
              <View
                key={it.itemId}
                style={[styles.lootTile, { backgroundColor: '#FFFFFF22', borderColor: c.dark }]}
              >
                <View style={styles.lootTileArt}>
                  {it.svg ? (
                    <SvgXml xml={it.svg} width={64} height={64} />
                  ) : (
                    <Text style={[styles.lootItem, { color: c.fg }]}>?</Text>
                  )}
                </View>
                <Text
                  style={[styles.lootTileName, { color: c.fg }]}
                  numberOfLines={1}
                >
                  {it.name}
                </Text>
                <View style={[styles.rarityDot, { backgroundColor: RARITY_COLOR[it.rarity] }]} />
              </View>
            ))}
          </View>
        )}

        {loot.duplicates.length > 0 && (
          <View style={styles.lootGrid}>
            {loot.duplicates.map((d, idx) => (
              <View
                key={`${d.slug}-${idx}`}
                style={[styles.lootTile, styles.lootTileDup, { borderColor: c.dark }]}
              >
                <View style={[styles.lootTileArt, { opacity: 0.5 }]}>
                  {d.svg ? (
                    <SvgXml xml={d.svg} width={64} height={64} />
                  ) : (
                    <Text style={[styles.lootItem, { color: c.fg }]}>?</Text>
                  )}
                </View>
                <Text
                  style={[styles.lootTileName, { color: c.fg, opacity: 0.65 }]}
                  numberOfLines={1}
                >
                  {d.name}
                </Text>
                <Text style={[styles.lootTileShards, { color: c.fg }]}>
                  +{d.shardsXp} XP
                </Text>
              </View>
            ))}
          </View>
        )}
      </Animated.View>

      {showOk && (
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [
            styles.lootDismiss,
            { backgroundColor: c.dark, borderColor: c.dark },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.lootDismissText, { color: '#FFFFFF' }]}>Continua</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

function ChestIcon({ color = colors.text }: { color?: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8Z"
        stroke={color}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <Path
        d="M4 11V8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v3"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M4 13h16" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path
        d="M11 13v3h2v-3"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function GearIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} stroke={colors.text} strokeWidth={2} />
      <Path
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
        stroke={colors.text}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Capul prietenului dintr-un SVG full-body (viewBox 762×1400). Containerul
// patrat decupeaza partea de sus (capul), restul corpului ramane in afara.
function FriendAvatar({
  svg,
  petImageUrl,
}: {
  svg: string | null;
  petImageUrl: string | null;
}) {
  const SIZE = 48;
  // SVG-ul e 762:1400. Daca latimea = SIZE, inaltimea totala = SIZE * 1400/762.
  // Containerul ramane SIZE×SIZE → afiseaza doar capul (raportul cap = 762/1400).
  const fullHeight = Math.round(SIZE * (1400 / 762));
  return (
    <View>
      {svg ? (
        <View style={[styles.friendAvatar, { width: SIZE, height: SIZE }]}>
          <SvgXml xml={svg} width={SIZE} height={fullHeight} />
        </View>
      ) : (
        <View style={[styles.friendAvatar, styles.friendAvatarFallback]} />
      )}
      <View style={styles.friendPetBadge}>
        <PetBadge imageUrl={petImageUrl} size={22} withShadow />
      </View>
    </View>
  );
}

function BottomSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
        <View style={styles.sheet}>
          <View style={styles.sheetGrip} />
          <Text style={styles.sheetTitle}>{title}</Text>
          {children}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function SheetItem({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.sheetItem, pressed && styles.sheetItemPressed]}
    >
      <Text style={[styles.sheetItemLabel, danger && styles.sheetItemLabelDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 14 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Side rail vertical pe marginea STANGA, centrat pe inaltime. Stanga ca sa
  // nu se intercaleze cu pet-ul (bottom-right). top: '50%' + translateY -50
  // (jumatatea inaltimii proprii: 2 butoane × 44 + gap 12 = 100) → centrare
  // exacta pe orice device. Avatarul e centrat orizontal → la left: 20 nu se
  // suprapune cu silueta lui pe niciun screen size rezonabil.
  sideMenu: {
    position: 'absolute',
    top: '50%',
    left: 20,
    gap: 12,
    transform: [{ translateY: -50 }],
    zIndex: 5,
    elevation: 5,
  },
  iconButton: {
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
  iconButtonPressed: { transform: [{ scale: 0.94 }], opacity: 0.85 },

  statusBlock: { flex: 1, gap: 4 },
  statusLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  statusLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  hello: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },

  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.cardAlt,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 999,
  },

  scene: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Stage pt avatar + pet absolut pozitionat la nivelul picioarelor.
  // Pet-ul sta lipit langa picioare, putin overlap pe avatar ca sa para
  // ca sunt impreuna pe podea, nu la distanta.
  avatarStage: { position: 'relative' },
  petContainer: {
    position: 'absolute',
    bottom: 8,
    right: -30,
    alignItems: 'center',
  },
  petContainerPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  petImage: { width: 120, height: 120 },
  petPlaceholder: {
    backgroundColor: colors.card,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petPlaceholderEmoji: { fontSize: 36 },
  petName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  // Pozitionat deasupra pet-ului. Pet-ul e la bottom: 8, right: -30, dimensiune
  // 120×120 → ancora bula la ~140 deasupra (peste capul pet-ului) si centrata
  // pe latimea pet-ului. Folosim "right" cu offset astfel incat bula sa fie
  // peste pet, nu peste avatar.
  bubbleAnchor: {
    position: 'absolute',
    bottom: 130,
    right: -30,
    width: 120,
    alignItems: 'center',
  },

  // Cufere - badge mic pe iconita din side rail (numar de cufere nedeschise)
  chestDotBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  chestDotBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  // Wrap exterior fara overflow — permite badge-ului sa iasa peste marginea
  // capsulei (capsula are overflow:hidden pt clip scroll, deci badge-ul nu
  // poate sta inauntru daca vrem sa iasa). Position relative ca badge-ul cu
  // position:absolute sa se ancoreze fata de wrap.
  chestsWrap: { position: 'relative' },
  // Capsula are aceeasi forma vizuala ca iconButton cand e inchisa (44×44).
  // Cand se extinde, se lungeste in jos cu o sectiune animata (height anim).
  // overflow:'hidden' clip-eaza scroll-ul in interiorul borderRadius-ului ca
  // sa nu iasa din capatul de jos al pill-ului.
  chestsCapsule: {
    width: 44,
    backgroundColor: colors.card,
    borderRadius: 22,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  // Trigger-ul ramane vizual identic cu IconButton (Friends/CoWalk): cerc
  // perfect 44×44, transparent (capsula da fundalul). La press → tint cenusiu
  // subtil ca semnal vizual.
  chestsTrigger: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chestsTriggerPressed: {
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  // Sectiunea animata cu stacks — incepe la 0 height si creste pe interpolate.
  // overflow:'hidden' pe parinte (chestsCapsule) e ce previne content sa iasa
  // afara din pill in timpul scrollului.
  stacksClip: {
    width: '100%',
    overflow: 'hidden',
  },
  stacksInside: {
    paddingTop: 6,
    paddingBottom: 8,
    gap: 8,
    alignItems: 'center',
  },
  miniStack: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniStackBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  miniStackBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  chestsEmptyText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    paddingVertical: 8,
  },
  // Loot reveal overlay — animatie stil Clash Royale.
  // Backdrop semi-opac peste tot ecranul. Layout vertical:
  // [burst ring] → [chest cu lid si body] → [card loot] → [buton continua]
  lootBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 16, 32, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 18,
  },
  // Ring/glow circular care se extinde din spatele cufarului.
  burstRing: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: '30%',
  },
  // Container care contine lid (sus, animat separat) + body (sub, fix).
  // Folosit pentru transformul de enter (scale + translateY) si shake.
  chestContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  // Card cu detaliile loot (XP + items) — apare cu spring dupa lid pop.
  lootCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 22,
    borderWidth: 2,
    padding: 18,
    gap: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  lootTier: { fontSize: 16, fontWeight: '900', letterSpacing: 0.4, textTransform: 'uppercase' },
  lootXp: { fontSize: 30, fontWeight: '900' },
  lootSection: { width: '100%', gap: 4, marginTop: 4 },
  lootItem: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  lootDup: { fontSize: 12, fontWeight: '600', marginTop: 4, opacity: 0.85 },
  // Grid de tile-uri cu items / duplicates din loot reveal.
  lootGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 8,
    width: '100%',
  },
  lootTile: {
    width: 92,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    backgroundColor: '#FFFFFF22',
  },
  lootTileDup: {
    backgroundColor: '#00000022',
  },
  lootTileArt: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lootTileName: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  lootTileShards: {
    fontSize: 11,
    fontWeight: '900',
    marginTop: 2,
    opacity: 0.9,
  },
  rarityDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  lootDismiss: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  lootDismissText: { fontSize: 15, fontWeight: '900', letterSpacing: 0.4 },

  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingVertical: 18,
    borderRadius: 999,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
  },
  playButtonPressed: { transform: [{ scale: 0.97 }], opacity: 0.92 },
  playButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },


  errorText: { color: colors.danger, textAlign: 'center', fontWeight: '600' },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheetWrap: { marginTop: 'auto' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 8,
  },
  sheetGrip: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  sheetEmpty: { color: colors.textMuted, fontSize: 14, lineHeight: 20, paddingBottom: 8 },
  sheetList: { gap: 2, paddingBottom: 4 },
  sheetItem: { paddingVertical: 14, paddingHorizontal: 4 },
  sheetItemPressed: { opacity: 0.55 },
  sheetItemLabel: { color: colors.text, fontSize: 16, fontWeight: '600' },
  sheetItemLabelDanger: { color: colors.danger },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  friendRowPressed: { opacity: 0.55 },
  friendChevron: { color: colors.textMuted, fontSize: 22, fontWeight: '700' },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
  },
  friendAvatarFallback: { backgroundColor: colors.border, width: 48, height: 48, borderRadius: 24 },
  friendPetBadge: {
    position: 'absolute',
    bottom: -4,
    right: -6,
  },
  friendInfo: { flex: 1, gap: 2 },
  friendName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  friendLevel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
});
