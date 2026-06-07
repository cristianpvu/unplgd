import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import Svg, { Path, G } from 'react-native-svg';
import { colors } from '../theme/colors';
import { IconChevronRight, IconLock } from '../ui/icons';

const AnimatedBlur = Animated.createAnimatedComponent(BlurView);

// Overlay full-screen de pe home: optiunile de joaca plutesc centrate, cu home-ul
// estompat in spate. Cardurile intra animat, una cate una. Fara emoji.

type GameDef = {
  key: string;
  title: string;
  subtitle: string;
  route: string;
  bg: string;
  fg: string;
  accent: string;
  dark?: boolean;
  Icon: React.FC<{ color: string }>;
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
    subtitle: 'Desenati o scena cu un prieten, AI-ul o ilustreaza',
    route: '/(app)/co-create',
    bg: '#FFF1E8',
    fg: '#7A3A0E',
    accent: '#FF7A4C',
    Icon: BrushIcon,
  },
  {
    key: 'hunt',
    title: 'Vanatoare in parc',
    subtitle: 'Gasiti monstri pe harta si invingeti-i pe echipe',
    route: '/(app)/hunt',
    bg: '#E4F5EA',
    fg: '#0F4F2C',
    accent: '#1FA67A',
    Icon: TargetIcon,
  },
  {
    key: 'phonedown',
    title: 'Last Phone Standing',
    subtitle: 'Cine sta cel mai mult fara telefon castiga un cufar',
    route: '/(app)/phonedown',
    bg: '#0F1020',
    fg: '#FFFFFF',
    accent: '#9F84FF',
    dark: true,
    Icon: ({ color }: { color: string }) => <IconLock size={26} color={color} />,
  },
];

export function PlaySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, t]);

  function openGame(route: string) {
    onClose();
    router.push(route as never);
  }

  // Intrare in cascada: cardul i apare intre start..end pe axa 0..1.
  function cardAnim(i: number) {
    const start = 0.08 + i * 0.1;
    const end = Math.min(1, start + 0.55);
    return {
      opacity: t.interpolate({ inputRange: [start, end], outputRange: [0, 1], extrapolate: 'clamp' }),
      transform: [
        {
          translateY: t.interpolate({
            inputRange: [start, end],
            outputRange: [26, 0],
            extrapolate: 'clamp',
          }),
        },
      ],
    };
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        {/* Fundal blurat: home-ul ramane vizibil dar estompat. Pe Android, blur
            real cere experimentalBlurMethod. Tint-ul intunecat suplimentar da
            contrast pt textul alb. */}
        <AnimatedBlur
          style={[StyleSheet.absoluteFill, { opacity: t }]}
          intensity={48}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
        >
          <View style={styles.tint} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </AnimatedBlur>

        {/* Continut centrat care pluteste peste home. box-none ca tap-ul pe gol
            sa ajunga la scrim (inchidere), dar cardurile sa fie interactive. */}
        <View style={styles.center} pointerEvents="box-none">
          <Animated.Text style={[styles.title, { opacity: t }]}>Joaca-te</Animated.Text>

          {GAMES.map((g, i) => (
            <Animated.View key={g.key} style={[styles.cardWrap, cardAnim(i)]}>
              <GameCard game={g} onPress={() => openGame(g.route)} />
            </Animated.View>
          ))}

          <Animated.View style={{ opacity: t }}>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Text style={styles.closeText}>Inchide</Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

function GameCard({ game, onPress }: { game: GameDef; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: game.bg },
        pressed && styles.cardPressed,
      ]}
    >
      <View
        style={[
          styles.cardIconWrap,
          { backgroundColor: game.dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)' },
        ]}
      >
        <game.Icon color={game.accent} />
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: game.fg }]} numberOfLines={1}>
          {game.title}
        </Text>
        <Text
          style={[styles.cardSub, { color: game.dark ? 'rgba(255,255,255,0.65)' : `${game.fg}99` }]}
          numberOfLines={2}
        >
          {game.subtitle}
        </Text>
      </View>
      <IconChevronRight
        size={18}
        color={game.dark ? 'rgba(255,255,255,0.5)' : `${game.fg}80`}
      />
    </Pressable>
  );
}

// ---------- Iconite line-art (fara emoji) ----------

function BookIcon({ color }: { color: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 512 512" fill={color}>
      <G>
        <Path d="M349.867,392.533c4.71,0,8.533-3.823,8.533-8.533v-8.533h8.533c4.71,0,8.533-3.823,8.533-8.533s-3.823-8.533-8.533-8.533H358.4v-8.533c0-4.71-3.823-8.533-8.533-8.533s-8.533,3.823-8.533,8.533v8.533H332.8c-4.71,0-8.533,3.823-8.533,8.533s3.823,8.533,8.533,8.533h8.533V384C341.333,388.71,345.156,392.533,349.867,392.533z" />
        <Path d="M256,102.4c-65.877,0-119.467,53.589-119.467,119.467c0,4.71,3.823,8.533,8.533,8.533c4.71,0,8.533-3.823,8.533-8.533c0-56.465,45.935-102.4,102.4-102.4s102.4,45.935,102.4,102.4c0,4.71,3.823,8.533,8.533,8.533s8.533-3.823,8.533-8.533C375.467,155.989,321.877,102.4,256,102.4z" />
        <Path d="M76.8,230.4c4.71,0,8.533-3.823,8.533-8.533C85.333,127.761,161.894,51.2,256,51.2s170.667,76.561,170.667,170.667c0,4.71,3.823,8.533,8.533,8.533s8.533-3.823,8.533-8.533c0-103.518-84.215-187.733-187.733-187.733S68.267,118.349,68.267,221.867C68.267,226.577,72.09,230.4,76.8,230.4z" />
        <Path d="M503.467,128c-4.71,0-8.533,3.823-8.533,8.533v332.8c0,14.114-11.486,25.6-25.6,25.6h-204.8v-19.635c12.442-4.352,44.843-14.498,76.8-14.498c74.325,0,124.8,16.461,125.312,16.631c2.586,0.862,5.453,0.418,7.68-1.178c2.219-1.604,3.541-4.181,3.541-6.921V93.867c0-3.413-2.031-6.502-5.171-7.842c-0.759-0.324-18.91-7.962-54.349-10.914c-4.753-0.435-8.815,3.098-9.207,7.791c-0.393,4.702,3.098,8.823,7.791,9.216c21.982,1.826,36.668,5.572,43.87,7.808v358.067c-19.337-5.069-62.276-14.259-119.467-14.259c-37.18,0-73.702,12.211-85.001,16.35c-10.044-4.437-40.405-16.35-77.133-16.35c-58.778,0-107.204,9.694-128,14.618V100.463c7.987-1.971,23.287-5.436,43.409-8.533c4.659-0.717,7.859-5.069,7.142-9.728c-0.725-4.659-5.12-7.876-9.728-7.134C60.749,79.872,41.139,85.427,40.32,85.666c-3.661,1.041-6.187,4.395-6.187,8.201v375.467c0,2.671,1.254,5.197,3.388,6.81c1.502,1.135,3.311,1.724,5.146,1.724c0.785,0,1.57-0.111,2.338-0.333c0.589-0.162,59.597-16.734,134.195-16.734c31.198,0,57.856,9.711,68.267,14.071v20.062h-204.8c-14.114,0-25.6-11.486-25.6-25.6v-332.8c0-4.71-3.823-8.533-8.533-8.533S0,131.823,0,136.533v332.8C0,492.86,19.14,512,42.667,512h426.667C492.86,512,512,492.86,512,469.333v-332.8C512,131.823,508.177,128,503.467,128z" />
        <Path d="M247.467,145.067V435.2c0,4.71,3.823,8.533,8.533,8.533s8.533-3.823,8.533-8.533V145.067c0-4.71-3.823-8.533-8.533-8.533S247.467,140.356,247.467,145.067z" />
        <Path d="M401.067,230.4c4.71,0,8.533-3.823,8.533-8.533c0-84.693-68.907-153.6-153.6-153.6s-153.6,68.907-153.6,153.6c0,4.71,3.823,8.533,8.533,8.533s8.533-3.823,8.533-8.533c0-75.281,61.252-136.533,136.533-136.533s136.533,61.252,136.533,136.533C392.533,226.577,396.356,230.4,401.067,230.4z" />
      </G>
    </Svg>
  );
}

function BrushIcon({ color }: { color: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 7.49996L17.5 9.99996M7.5 20L19.25 8.24996C19.9404 7.5596 19.9404 6.44032 19.25 5.74996V5.74996C18.5596 5.0596 17.4404 5.05961 16.75 5.74996L5 17.5V20H7.5ZM7.5 20H15.8787C17.0503 20 18 19.0502 18 17.8786V17.8786C18 17.316 17.7765 16.7765 17.3787 16.3786L17 16M4.5 4.99996C6.5 2.99996 10 3.99996 10 5.99996C10 8.5 4 8.5 4 11C4 11.8759 4.53314 12.5256 5.22583 13"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TargetIcon({ color }: { color: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill={color}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14.3675 2.15671C14.7781 2.01987 15.2219 2.01987 15.6325 2.15671L20.6325 3.82338C21.4491 4.09561 22 4.85988 22 5.72074V19.6126C22 20.9777 20.6626 21.9416 19.3675 21.5099L15 20.0541L9.63246 21.8433C9.22192 21.9801 8.77808 21.9801 8.36754 21.8433L3.36754 20.1766C2.55086 19.9044 2 19.1401 2 18.2792V4.38741C2 3.0223 3.33739 2.05836 4.63246 2.49004L9 3.94589L14.3675 2.15671ZM15 4.05408L9.63246 5.84326C9.22192 5.9801 8.77808 5.9801 8.36754 5.84326L4 4.38741V18.2792L9 19.9459L14.3675 18.1567C14.7781 18.0199 15.2219 18.0199 15.6325 18.1567L20 19.6126V5.72074L15 4.05408ZM13.2929 8.29288C13.6834 7.90235 14.3166 7.90235 14.7071 8.29288L15.5 9.08577L16.2929 8.29288C16.6834 7.90235 17.3166 7.90235 17.7071 8.29288C18.0976 8.6834 18.0976 9.31657 17.7071 9.70709L16.9142 10.5L17.7071 11.2929C18.0976 11.6834 18.0976 12.3166 17.7071 12.7071C17.3166 13.0976 16.6834 13.0976 16.2929 12.7071L15.5 11.9142L14.7071 12.7071C14.3166 13.0976 13.6834 13.0976 13.2929 12.7071C12.9024 12.3166 12.9024 11.6834 13.2929 11.2929L14.0858 10.5L13.2929 9.70709C12.9024 9.31657 12.9024 8.6834 13.2929 8.29288ZM6 16C6.55228 16 7 15.5523 7 15C7 14.4477 6.55228 14 6 14C5.44772 14 5 14.4477 5 15C5 15.5523 5.44772 16 6 16ZM9 12C9 12.5523 8.55228 13 8 13C7.44772 13 7 12.5523 7 12C7 11.4477 7.44772 11 8 11C8.55228 11 9 11.4477 9 12ZM11 12C11.5523 12 12 11.5523 12 11C12 10.4477 11.5523 9.99998 11 9.99998C10.4477 9.99998 10 10.4477 10 11C10 11.5523 10.4477 12 11 12Z"
        fill={color}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Strat subtire peste blur pt contrast text (blur singur poate fi prea luminos).
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(18, 16, 36, 0.34)' },

  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    gap: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.3,
  },

  cardWrap: { width: '100%' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 22,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  cardPressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },
  cardIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.2 },
  cardSub: { fontSize: 12.5, fontWeight: '500', lineHeight: 17 },

  closeBtn: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 24, marginTop: 6 },
  closeText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
