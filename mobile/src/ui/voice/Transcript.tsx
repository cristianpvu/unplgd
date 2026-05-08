import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import type { OrbPhase } from './Orb';

// Zona centrala unde apare textul — fie ce zice naratorul (typewriter), fie
// transcriptul user-ului (live partial sau echo dupa final). Comportament:
// - daca user vorbeste → afiseaza partial-ul
// - daca thinking si avem un finalEcho → afiseaza ce a zis user-ul
// - altfel daca aiShown exista → afiseaza-l (cu cursor cand vorbeste)
// - placeholder cand toate sunt goale

export type TranscriptProps = {
  phase: OrbPhase;
  aiShown: string;
  userPartial: string;
  userFinalEcho: string;
  placeholder: string;
  // Cand parintele vrea sa randeze ceva in locul transcriptului
  // (ex. final card), trece children si transcriptul nu se mai randeaza.
  children?: React.ReactNode;
  // Limit max-height in caz ca parintele vrea hub-style (mai mic).
  compact?: boolean;
};

export function Transcript({
  phase,
  aiShown,
  userPartial,
  userFinalEcho,
  placeholder,
  children,
  compact,
}: TranscriptProps) {
  return (
    <ScrollView
      style={[styles.scroll, compact && styles.scrollCompact]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {children ? (
        children
      ) : userPartial ? (
        <Text style={styles.userTranscript}>{userPartial}</Text>
      ) : phase === 'thinking' && userFinalEcho ? (
        <Text style={styles.userTranscript}>{userFinalEcho}</Text>
      ) : aiShown ? (
        <Text style={styles.aiTranscript}>
          {aiShown}
          {phase === 'speaking' && <Text style={styles.cursor}>▍</Text>}
        </Text>
      ) : (
        <Text style={styles.placeholder}>{placeholder}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, width: '100%' },
  scrollCompact: { flex: 0, maxHeight: 120 },
  content: { paddingTop: 12, paddingBottom: 24, minHeight: 80, alignItems: 'center' },
  aiTranscript: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '600',
    textAlign: 'center',
  },
  userTranscript: {
    color: colors.accent,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingTop: 16,
  },
  cursor: { color: colors.accent, fontWeight: '900' },
});
