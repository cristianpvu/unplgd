import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { MicIcon } from './MicIcon';
import { TypingDots } from './TypingDots';
import type { OrbPhase } from './Orb';

export type MicControlsProps = {
  phase: OrbPhase;
  onPress: () => void;
  // Optional finish chip deasupra mic button-ului.
  finishLabel?: string;
  onFinish?: () => void;
  showFinish?: boolean;
};

export function MicControls({
  phase,
  onPress,
  finishLabel,
  onFinish,
  showFinish,
}: MicControlsProps) {
  // Halo extern pulsatil cand listening / speaking — semnal vizual ca butonul
  // e activ. Pe idle / thinking ramane stins.
  const halo = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    halo.stopAnimation();
    if (phase !== 'listening' && phase !== 'speaking') {
      Animated.timing(halo, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, {
          toValue: 1,
          duration: phase === 'listening' ? 900 : 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(halo, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [halo, phase]);

  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const haloColor =
    phase === 'listening' ? colors.accent : phase === 'speaking' ? colors.secondary : 'transparent';

  return (
    <View style={styles.controls}>
      {showFinish && finishLabel && onFinish && (
        <Pressable
          onPress={onFinish}
          style={({ pressed }) => [styles.finishChip, pressed && styles.btnPressed]}
        >
          <Text style={styles.finishChipText}>{finishLabel}</Text>
        </Pressable>
      )}
      <View style={styles.btnWrap}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            { backgroundColor: haloColor, opacity: haloOpacity, transform: [{ scale: haloScale }] },
          ]}
        />
        <Pressable
          onPress={onPress}
          disabled={phase === 'thinking'}
          style={({ pressed }) => [
            styles.micBtn,
            phase === 'listening' && styles.micBtnListening,
            phase === 'speaking' && styles.micBtnSpeaking,
            phase === 'thinking' && styles.micBtnThinking,
            pressed && styles.btnPressed,
          ]}
        >
          {phase === 'thinking' ? (
            <TypingDots size={9} color="#FFFFFF" />
          ) : (
            <MicIcon phase={phase} size={36} color="#FFFFFF" />
          )}
        </Pressable>
      </View>
      <Text style={styles.micLabel}>{micLabelFor(phase)}</Text>
    </View>
  );
}

function micLabelFor(phase: OrbPhase): string {
  switch (phase) {
    case 'listening':
      return 'Opreste';
    case 'speaking':
      return 'Sari';
    case 'thinking':
      return ' ';
    default:
      return 'Vorbeste';
  }
}

const BTN_SIZE = 88;

const styles = StyleSheet.create({
  controls: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  finishChip: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accent,
    marginBottom: 8,
  },
  finishChipText: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  btnWrap: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
  },
  micBtn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 10,
  },
  // Listening: ramane accent, dar mai inchis si fara umbra exagerata. Halo-ul
  // de afara e cel care comunica "active recording". Fara rosu strident.
  micBtnListening: {
    backgroundColor: colors.text,
    shadowColor: colors.text,
    shadowOpacity: 0.35,
  },
  // Speaking: tonalitate calda mai stinsa, sugereaza pauzabil.
  micBtnSpeaking: {
    backgroundColor: colors.secondary,
    shadowColor: colors.secondary,
    shadowOpacity: 0.35,
  },
  micBtnThinking: {
    backgroundColor: colors.accentDim,
    shadowOpacity: 0.2,
  },
  micLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  btnPressed: { transform: [{ scale: 0.94 }], opacity: 0.92 },
});
