import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '../../src/theme/colors';

export default function ParkHintModal() {
  const params = useLocalSearchParams<{
    title?: string;
    body?: string;
    parkName?: string;
    lat?: string;
    lng?: string;
  }>();

  const title = params.title || 'Idee pentru tine';
  const body = params.body || '';
  const parkName = params.parkName || '';
  const lat = params.lat ? Number(params.lat) : null;
  const lng = params.lng ? Number(params.lng) : null;

  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(slide, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [slide]);

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [Dimensions.get('window').height * 0.4, 0],
  });

  function openDirections() {
    let url: string;
    if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      // URL universal Google Maps — deschide app-ul nativ daca e instalat,
      // altfel browser-ul (functioneaza si pe iOS).
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    } else if (parkName) {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parkName)}`;
    } else {
      return;
    }
    Linking.openURL(url).catch(() => {});
  }

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.backdrop, { opacity: slide }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} />
      </Animated.View>

      <Animated.View style={[styles.panel, { transform: [{ translateY }], opacity: slide }]}>
        <SafeAreaView edges={['bottom']}>
          <View style={styles.grip} />

          <View style={styles.header}>
            <View style={styles.pinWrap}>
              <PinGlyph color={colors.accent} />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M6 6l12 12M18 6L6 18"
                  stroke={colors.textMuted}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
          </View>

          {parkName ? <Text style={styles.park}>{parkName}</Text> : null}
          {body ? <Text style={styles.body}>{body}</Text> : null}

          <Pressable
            onPress={openDirections}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          >
            <PinGlyph color="#FFFFFF" small />
            <Text style={styles.primaryBtnText}>Indicatii spre parc</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              router.back();
              router.push('/(app)/chat');
            }}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.secondaryBtnText}>Vorbeste cu prietenul tau</Text>
          </Pressable>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

function PinGlyph({ color, small }: { color: string; small?: boolean }) {
  const s = small ? 18 : 24;
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11Z"
        stroke={color}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={10} r={2.5} stroke={color} strokeWidth={2.2} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(45, 42, 74, 0.45)' },

  panel: {
    backgroundColor: colors.bgAlt,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grip: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: 14,
  },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pinWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.accent + '1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: 0.2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

  park: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 18 },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginTop: 8 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 22,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },

  secondaryBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 2 },
  secondaryBtnText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },

  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
});
