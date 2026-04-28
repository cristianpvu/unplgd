import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../src/theme/colors';

type GameCard = {
  key: string;
  emoji: string;
  title: string;
  subtitle: string;
  bg: string;
  soon?: boolean;
};

const SOCIAL: GameCard[] = [
  {
    key: 'duel',
    emoji: '⚔️',
    title: 'Duel',
    subtitle: 'Provocare 1 la 1',
    bg: '#FFE2E8',
    soon: true,
  },
  {
    key: 'daily',
    emoji: '🎯',
    title: 'Provocarea zilei',
    subtitle: 'Misiunea de azi',
    bg: '#E3F2FF',
    soon: true,
  },
];

export default function Play() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Hai la joaca!</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.push('/(app)/story')}
          style={({ pressed }) => [styles.heroCard, pressed && styles.cardPressed]}
        >
          <View style={styles.heroIconWrap}>
            <Text style={styles.heroEmoji}>📖</Text>
            <View style={styles.heroSparkle}>
              <SparklesIcon />
            </View>
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>Spune o poveste</Text>
            <Text style={styles.heroSubtitle}>
              Inventeaza o poveste cu Buddy si spune-o unui prieten.
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(app)/co-create')}
          style={({ pressed }) => [
            styles.heroCard,
            { backgroundColor: colors.secondary },
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.heroIconWrap}>
            <Text style={styles.heroEmoji}>🎨</Text>
            <View style={styles.heroSparkle}>
              <SparklesIcon />
            </View>
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>Deseneaza impreuna</Text>
            <Text style={styles.heroSubtitle}>
              Cu un prieten alaturi, desenati o scena dintr-o poveste si AI-ul o transforma in
              ilustratie magica.
            </Text>
          </View>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function GameTile({ game }: { game: GameCard }) {
  return (
    <Pressable
      onPress={() => Alert.alert('In curand', `${game.title} apare in curand!`)}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: game.bg },
        pressed && styles.cardPressed,
      ]}
    >
      {game.soon && (
        <View style={styles.soonBadge}>
          <Text style={styles.soonBadgeText}>In curand</Text>
        </View>
      )}
      <Text style={styles.tileEmoji}>{game.emoji}</Text>
      <Text style={styles.tileTitle}>{game.title}</Text>
      <Text style={styles.tileSubtitle}>{game.subtitle}</Text>
    </Pressable>
  );
}

function SparklesIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z"
        fill="#FFD93D"
      />
    </Svg>
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

  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 18 },

  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.accent,
    borderRadius: 24,
    padding: 18,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  heroIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 44 },
  heroSparkle: { position: 'absolute', top: 6, right: 6 },
  heroText: { flex: 1, gap: 4 },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.28)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginBottom: 2,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },

  section: { gap: 10 },
  sectionTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingLeft: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '47.5%',
    aspectRatio: 1,
    borderRadius: 22,
    padding: 16,
    justifyContent: 'flex-end',
    gap: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  tileEmoji: { fontSize: 38, marginBottom: 6 },
  tileTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  tileSubtitle: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  soonBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(45,42,74,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  soonBadgeText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  cardPressed: { transform: [{ scale: 0.97 }], opacity: 0.92 },

  footer: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
});
