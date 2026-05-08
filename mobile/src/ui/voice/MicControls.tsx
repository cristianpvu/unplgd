import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
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
      <Pressable
        onPress={onPress}
        disabled={phase === 'thinking'}
        style={({ pressed }) => [
          styles.micBtn,
          phase === 'listening' && styles.micBtnListening,
          phase === 'speaking' && styles.micBtnSpeaking,
          phase === 'thinking' && styles.micBtnDisabled,
          pressed && styles.btnPressed,
        ]}
      >
        <Text style={styles.micIcon}>{micIconFor(phase)}</Text>
      </Pressable>
      <Text style={styles.micLabel}>{micLabelFor(phase)}</Text>
    </View>
  );
}

function micIconFor(phase: OrbPhase): string {
  switch (phase) {
    case 'listening':
      return '⏹';
    case 'speaking':
      return '⏸';
    case 'thinking':
      return '...';
    default:
      return '🎤';
  }
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
  micBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  micBtnListening: { backgroundColor: '#E55353' },
  micBtnSpeaking: { backgroundColor: colors.textMuted },
  micBtnDisabled: { opacity: 0.6 },
  micIcon: { fontSize: 36 },
  micLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  btnPressed: { transform: [{ scale: 0.95 }], opacity: 0.85 },
});
