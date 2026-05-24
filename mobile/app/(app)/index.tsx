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
import Svg, { Circle, Path, SvgXml } from 'react-native-svg';
import { getMe } from '../../src/api/me';
import { getMyAvatar } from '../../src/api/avatar';
import {
  listChests,
  listChestTiers,
  openChest,
  type ChestDto,
  type ChestLoot,
  type ChestTier,
  type ChestTierVisual,
} from '../../src/api/chests';
import {
  LootRevealInline,
  MiniChestSvg,
  resolveTier,
  TIER_LABEL,
} from '../../src/chests/reveal';
import { listFriends } from '../../src/api/friends';
import { getMyPet, getPetDailyHook, petImageUrl } from '../../src/api/pets';
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '../../src/api/notifications';
import { ApiError } from '../../src/api/client';
import { useAuth } from '../../src/lib/auth';
import { AvatarHead, type AvatarHeadHandle } from '../../src/avatar/AvatarHead';
import { PetSpeechBubble } from '../../src/ui/PetSpeechBubble';
import { PetBadge } from '../../src/ui/PetBadge';
import { BackgroundMedia } from '../../src/ui/BackgroundMedia';
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

  // Notificari — query mereu activ (low-cost, max 50 records) ca sa avem
  // badge unread vizibil instant. Sheet-ul reuseste aceleasi date.
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => getMyNotifications(),
    refetchInterval: 60_000, // refetch la 1 min ca sa prinda notificari noi
    staleTime: 30_000,
  });
  const qc = useQueryClient();
  const markReadMut = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markAllReadMut = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const petQuery = useQuery({ queryKey: ['pet'], queryFn: getMyPet });
  const petImage = petImageUrl(petQuery.data?.pet.species.imagePath ?? null);
  const petName = petQuery.data?.pet.name ?? null;
  const petCatchphrases = petQuery.data?.pet.species.catchphrases ?? [];

  // Daily hook personalizat — un singur mesaj/zi pe baza activitatii recente.
  // Daca pica (network/AI), bubble-ul cade pe catchphrases speciei.
  const hookQuery = useQuery({
    queryKey: ['pet', 'daily-hook'],
    queryFn: getPetDailyHook,
    // 6h — hook-ul se schimba zilnic la miezul noptii, dar nu vrem refetch
    // la fiecare focus al app-ului. 6h prinde ziua noua daca ramane logat.
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
  });
  const bubblePhrases = hookQuery.data?.text
    ? [hookQuery.data.text]
    : petCatchphrases;

  // Daca user-ul e logat dar n-a apucat sa-si creeze avatarul (a inchis app-ul
  // pe mijlocul onboarding-ului), il trimitem inapoi in flow-ul de creare.
  useEffect(() => {
    if (avatarError instanceof ApiError && avatarError.status === 404) {
      router.replace('/(app)/avatar-edit?firstTime=1');
    }
  }, [avatarError]);

  const progress = me ? xpProgress(me.xp, me.level) : null;

  return (
    <View style={styles.root}>
      {/* Fundal fullscreen sub TOT (status bar inclusiv). Poster + video opt
          live. Cand user n-are fundal selectat, ramane colors.bg din `root`. */}
      {me?.background && (
        <BackgroundMedia
          imageUrl={me.background.imageUrl}
          videoUrl={me.background.videoUrl}
        />
      )}
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.container}>
        <View style={styles.topRow}>
          <View>
            <IconButton
              onPress={() => setSheet('notifications')}
              accessibilityLabel="Notificari"
            >
              <BellIcon />
            </IconButton>
            {(notificationsQuery.data?.unreadCount ?? 0) > 0 && (
              <View style={styles.notifBadge} pointerEvents="none">
                <Text style={styles.notifBadgeText}>
                  {Math.min(notificationsQuery.data?.unreadCount ?? 0, 9)}
                </Text>
              </View>
            )}
          </View>
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
                  phrases={bubblePhrases}
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
            {notificationsQuery.isPending ? (
              <ActivityIndicator color={colors.accent} />
            ) : notificationsQuery.data && notificationsQuery.data.items.length > 0 ? (
              <>
                {notificationsQuery.data.unreadCount > 0 && (
                  <Pressable
                    onPress={() => markAllReadMut.mutate()}
                    style={({ pressed }) => [
                      styles.markAllReadBtn,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={styles.markAllReadText}>Marcheaza toate ca citite</Text>
                  </Pressable>
                )}
                {notificationsQuery.data.items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    onPress={() => {
                      if (!n.readAt) markReadMut.mutate(n.id);
                      // Park hint tap = deschide chat-ul cu pet-ul ca sa
                      // continue conversatia natural acolo.
                      if (n.kind === 'park_hint') {
                        setSheet(null);
                        router.push('/(app)/chat');
                      }
                    }}
                  />
                ))}
              </>
            ) : (
              <Text style={styles.sheetEmpty}>Inca nu ai notificari.</Text>
            )}
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
    </View>
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
// Nu navigare la pagina noua — totul aici. Vizualurile + reveal-ul sunt in
// src/chests/reveal.tsx (partajat cu pagina /chests).
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

// Iconita per tip de notificare — standardizam design. Park hint = pin verde,
// alte tipuri vor avea iconitele lor specifice.
const NOTIFICATION_VISUALS: Record<
  string,
  { icon: string; color: string; bg: string }
> = {
  park_hint: { icon: '◉', color: '#7DCEA0', bg: 'rgba(125,206,160,0.15)' },
};

const DEFAULT_VISUAL = { icon: '✦', color: colors.accent, bg: 'rgba(33,150,243,0.15)' };

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return 'acum';
  if (m < 60) return `acum ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `acum ${h}h`;
  const d = Math.floor(h / 24);
  return `acum ${d}z`;
}

// Card notificare standardizat: iconita colorata stanga + titlu + body
// compact + chip domenii (daca exista in payload) + timestamp jos-dreapta.
function NotificationRow({ n, onPress }: { n: NotificationItem; onPress: () => void }) {
  const unread = !n.readAt;
  const visual = NOTIFICATION_VISUALS[n.kind] ?? DEFAULT_VISUAL;
  const domains = Array.isArray(n.payload?.sharedDomains)
    ? (n.payload.sharedDomains as string[]).slice(0, 3)
    : [];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.notifCard,
        unread && styles.notifCardUnread,
        pressed && { opacity: 0.92 },
      ]}
    >
      <View style={[styles.notifIcon, { backgroundColor: visual.bg }]}>
        <Text style={[styles.notifIconText, { color: visual.color }]}>{visual.icon}</Text>
      </View>

      <View style={styles.notifBodyCol}>
        <View style={styles.notifHeaderRow}>
          <Text style={styles.notifTitleNew} numberOfLines={1}>
            {n.title}
          </Text>
          {unread && <View style={styles.notifDotInline} />}
        </View>
        <Text style={styles.notifBodyNew} numberOfLines={2}>
          {n.body}
        </Text>

        {domains.length > 0 && (
          <View style={styles.notifChips}>
            {domains.map((d) => (
              <View key={d} style={styles.notifChip}>
                <Text style={styles.notifChipText}>{d}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.notifTime}>{timeAgo(n.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

function ChestsSideButton() {
  const qc = useQueryClient();
  const chestsQ = useQuery({ queryKey: ['chests'], queryFn: listChests });
  // Visual config — cache lung; modificarea SVG-urilor in DB necesita
  // refetch manual (logout/login sau forceRefresh).
  const tiersQ = useQuery({
    queryKey: ['chestTiers'],
    queryFn: listChestTiers,
    staleTime: 60 * 60 * 1000, // 1h
    gcTime: 24 * 60 * 60 * 1000,
  });
  const tierByTier = useMemo<Partial<Record<ChestTier, ChestTierVisual>>>(() => {
    const out: Partial<Record<ChestTier, ChestTierVisual>> = {};
    for (const t of tiersQ.data?.tiers ?? []) out[t.tier] = t;
    return out;
  }, [tiersQ.data]);

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
              const c = resolveTier(s.tier, tierByTier);
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
                  {c.miniSvg ? (
                    <SvgXml xml={c.miniSvg} width={34} height={32} />
                  ) : (
                    <MiniChestSvg tier={s.tier} />
                  )}
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
            visual={resolveTier(loot.tier, tierByTier)}
            onDismiss={() => setLoot(null)}
          />
        )}
      </Modal>
    </View>
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
  // Wrapper exterior: tine colors.bg ca fallback cand n-ai fundal selectat,
  // si gazduieste BackgroundMedia absolutFill care acopera TOT (status bar inclusiv).
  root: { flex: 1, backgroundColor: colors.bg },
  // SafeAreaView ramane transparent ca BackgroundMedia sa fie vizibil dedesubt.
  safe: { flex: 1, backgroundColor: 'transparent' },
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

  // Notifications
  markAllReadBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  markAllReadText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  // Card notificare standardizat
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  notifCardUnread: {
    backgroundColor: colors.cardAlt,
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifIconText: {
    fontSize: 18,
    fontWeight: '900',
  },
  notifBodyCol: {
    flex: 1,
    gap: 4,
  },
  notifHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notifTitleNew: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  notifDotInline: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  notifBodyNew: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  notifChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  notifChip: {
    backgroundColor: 'rgba(125,206,160,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  notifChipText: {
    color: '#5DAA80',
    fontSize: 11,
    fontWeight: '700',
  },
  notifTime: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
});
