import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors } from '../../src/theme/colors';
import {
  IconArrowLeft,
  IconChevronRight,
  IconLock,
  IconUsers,
} from '../../src/ui/icons';
import Svg, { Path, Circle, Line, Polyline } from 'react-native-svg';

// Hub central pentru jocuri / activitati. Cardurile au identitate vizuala
// proprie (culoare + iconografie line-art custom), fara emoji.

type GameDef = {
  key: string;
  title: string;
  subtitle: string;
  route?: string;
  bg: string;
  fg: string;
  accent: string;
  Icon: React.FC<{ color: string }>;
  badge?: string;
};

const GAMES: GameDef[] = [
  {
    key: 'story',
    title: 'Spune o poveste',
    subtitle: 'Inventeaza o poveste cu Buddy si spune-o unui prieten',
    route: '/(app)/story',
    bg: '#F4EFFF',
    fg: '#2A1A6E',
    accent: '#7C5CFC',
    Icon: BookIcon,
  },
  {
    key: 'co-create',
    title: 'Deseneaza impreuna',
    subtitle: 'Desenati o scena cu un prieten si AI-ul o transforma in ilustratie',
    route: '/(app)/co-create',
    bg: '#FFF1E8',
    fg: '#7A3A0E',
    accent: '#FF7A4C',
    Icon: BrushIcon,
  },
  {
    key: 'hunt',
    title: 'Vanatoare in parc',
    subtitle: 'Cu prietenii in parc, gasiti monstri pe harta si invingeti-i pe echipe',
    route: '/(app)/hunt',
    bg: '#E4F5EA',
    fg: '#0F4F2C',
    accent: '#1FA67A',
    Icon: TargetIcon,
  },
  {
    key: 'phonedown',
    title: 'Phone Down',
    subtitle: 'Cine sta cel mai mult fara telefon castiga un cufar',
    route: '/(app)/phonedown',
    bg: '#0F1020',
    fg: '#FFFFFF',
    accent: '#9F84FF',
    Icon: ({ color }: { color: string }) => <IconLock size={26} color={color} />,
  },
  {
    key: 'duel',
    title: 'Duel',
    subtitle: 'Provocare 1 la 1',
    bg: '#FFE7EC',
    fg: '#6B0E20',
    accent: '#E74C5C',
    Icon: SwordIcon,
    badge: 'In curand',
  },
  {
    key: 'daily',
    title: 'Provocarea zilei',
    subtitle: 'Misiunea zilnica',
    bg: '#E5F2FF',
    fg: '#0F3463',
    accent: '#2F86E0',
    Icon: ({ color }: { color: string }) => <IconUsers size={24} color={color} />,
    badge: 'In curand',
  },
];

export default function Play() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <IconArrowLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Hai la joaca</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {GAMES.map((g) => (
          <GameCard key={g.key} game={g} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function GameCard({ game }: { game: GameDef }) {
  const disabled = !!game.badge;
  return (
    <Pressable
      onPress={() => {
        if (disabled || !game.route) return;
        router.push(game.route as any);
      }}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: game.bg },
        pressed && !disabled && styles.cardPressed,
        disabled && { opacity: 0.85 },
      ]}
    >
      <View
        style={[
          styles.cardIconWrap,
          {
            backgroundColor:
              game.bg === '#0F1020'
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(255,255,255,0.55)',
          },
        ]}
      >
        <game.Icon color={game.accent} />
      </View>
      <View style={styles.cardText}>
        {game.badge && (
          <View
            style={[
              styles.cardBadge,
              {
                backgroundColor:
                  game.bg === '#0F1020' ? 'rgba(255,255,255,0.1)' : 'rgba(15,16,32,0.08)',
              },
            ]}
          >
            <Text
              style={[
                styles.cardBadgeText,
                { color: game.bg === '#0F1020' ? '#FFFFFF' : colors.text },
              ]}
            >
              {game.badge}
            </Text>
          </View>
        )}
        <Text style={[styles.cardTitle, { color: game.fg }]}>{game.title}</Text>
        <Text
          style={[
            styles.cardSubtitle,
            { color: game.bg === '#0F1020' ? 'rgba(255,255,255,0.65)' : `${game.fg}99` },
          ]}
        >
          {game.subtitle}
        </Text>
      </View>
      {!disabled && (
        <View style={styles.cardChevron}>
          <IconChevronRight
            size={18}
            color={game.bg === '#0F1020' ? 'rgba(255,255,255,0.5)' : `${game.fg}80`}
          />
        </View>
      )}
    </Pressable>
  );
}

// ---------- Iconite specifice activitatilor (line-art) ----------

function BookIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5a2.5 2.5 0 0 0 0 5H20"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function BrushIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 2l8 8-9.5 9.5a3 3 0 0 1-4.24 0L4 15.24a3 3 0 0 1 0-4.24L14 2z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Line
        x1="2"
        y1="22"
        x2="6"
        y2="18"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function TargetIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={2} />
      <Circle cx="12" cy="12" r="6" stroke={color} strokeWidth={2} />
      <Circle cx="12" cy="12" r="2" fill={color} />
    </Svg>
  );
}

function SwordIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="14 6 3 6 14 17 21 10 14 6"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        fill="none"
      />
      <Line x1="3" y1="6" x2="14" y2="17" stroke={color} strokeWidth={2} />
      <Line x1="14" y1="17" x2="11" y2="21" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
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

  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 12 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 22,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  cardIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 2 },
  cardBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginBottom: 4,
  },
  cardBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  cardTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.2 },
  cardSubtitle: { fontSize: 12.5, fontWeight: '500', lineHeight: 17 },
  cardChevron: { paddingLeft: 4 },

  cardPressed: { transform: [{ scale: 0.98 }] },
});
