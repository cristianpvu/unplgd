import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Orb, BackgroundMesh, type OrbPhase } from './Orb';
import { colors } from '../../theme/colors';

// Layout comun pentru toate ecranele voice-first: mesh gradient animat in
// fundal, top bar minimal (back + titlu + actiune dreapta optionala), orb
// in centru cu status text, apoi children pentru transcript + actiuni.

export type VoiceShellProps = {
  title: string;
  phase: OrbPhase;
  status: string;
  onClose: () => void;
  rightButton?: { label: string; onPress: () => void; accessibilityLabel?: string };
  children: React.ReactNode;
};

export function VoiceShell({
  title,
  phase,
  status,
  onClose,
  rightButton,
  children,
}: VoiceShellProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <BackgroundMesh />

      <View style={styles.topRow}>
        <Pressable onPress={onClose} hitSlop={14} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>×</Text>
        </Pressable>
        <Text style={styles.headerName} numberOfLines={1}>
          {title}
        </Text>
        {rightButton ? (
          <Pressable
            onPress={rightButton.onPress}
            hitSlop={14}
            style={styles.smallBtn}
            accessibilityLabel={rightButton.accessibilityLabel}
          >
            <Text style={styles.smallBtnText}>{rightButton.label}</Text>
          </Pressable>
        ) : (
          <View style={{ width: 38 }} />
        )}
      </View>

      <View style={styles.body}>
        <Orb phase={phase} />
        <Text style={styles.statusText}>{status}</Text>
      </View>

      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 12,
  },
  smallBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  headerName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  body: {
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 24,
    gap: 12,
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 4,
  },
});
