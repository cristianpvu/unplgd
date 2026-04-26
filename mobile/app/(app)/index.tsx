import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import Svg, { Circle, Path, SvgXml } from 'react-native-svg';
import { getMe } from '../../src/api/me';
import { getMyAvatar } from '../../src/api/avatar';
import { listFriends } from '../../src/api/friends';
import { ApiError } from '../../src/api/client';
import { useAuth } from '../../src/lib/auth';
import { AvatarHead, type AvatarHeadHandle } from '../../src/avatar/AvatarHead';
import { colors } from '../../src/theme/colors';

type SheetKind = 'friends' | 'settings' | null;

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
          <IconButton onPress={() => setSheet('friends')} accessibilityLabel="Prieteni">
            <FriendsIcon />
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

        <Text style={styles.hello} numberOfLines={1}>
          Salut{me ? `, ${me.name}` : ''}!
        </Text>

        <Pressable
          style={styles.scene}
          onPressIn={() => avatarRef.current?.bounce()}
          onPress={() => router.push('/(app)/avatar-edit')}
        >
          <AvatarHead ref={avatarRef} svg={avatar?.svg} svgBlink={avatar?.svgBlink} height={420} />
        </Pressable>

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
        title={sheet === 'friends' ? 'Prietenii mei' : 'Setari'}
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
              <View key={f.friendshipId} style={styles.friendRow}>
                <FriendAvatar svg={f.user.avatarSvg} />
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName} numberOfLines={1}>
                    {f.user.name}
                  </Text>
                  <Text style={styles.friendLevel}>Lvl {f.user.level} · {f.user.xp} XP</Text>
                </View>
              </View>
            ))}
            <SheetItem
              label="Adauga prieten"
              onPress={() => {
                setSheet(null);
                router.push('/(app)/scan-friend');
              }}
            />
          </View>
        )}
        {sheet === 'settings' && (
          <View style={styles.sheetList}>
            <SheetItem
              label="Personalizeaza avatar"
              onPress={() => {
                setSheet(null);
                router.push('/(app)/avatar-edit');
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
function FriendAvatar({ svg }: { svg: string | null }) {
  const SIZE = 48;
  if (!svg) {
    return <View style={[styles.friendAvatar, styles.friendAvatarFallback]} />;
  }
  // SVG-ul e 762:1400. Daca latimea = SIZE, inaltimea totala = SIZE * 1400/762.
  // Containerul ramane SIZE×SIZE → afiseaza doar capul (raportul cap = 762/1400).
  const fullHeight = Math.round(SIZE * (1400 / 762));
  return (
    <View style={[styles.friendAvatar, { width: SIZE, height: SIZE }]}>
      <SvgXml xml={svg} width={SIZE} height={fullHeight} />
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
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
  },
  friendAvatarFallback: { backgroundColor: colors.border },
  friendInfo: { flex: 1, gap: 2 },
  friendName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  friendLevel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
});
