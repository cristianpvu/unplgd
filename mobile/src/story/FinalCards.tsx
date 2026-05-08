import { StyleSheet, Text, View } from 'react-native';
import type {
  ExtendChatResponse,
  ExtendFinalStory,
  FinalStory,
  VerifyChatResponse,
} from '../api/stories';
import { colors } from '../theme/colors';

// Card-uri de final pentru cele 3 fluxuri voice. Toate au stilul "glassy
// 85% white" cu border accent — par parte din ecranul cu orb.

export function FinalCreateCard({ story, body }: { story: FinalStory; body: string }) {
  return (
    <View style={[styles.card, { borderColor: colors.accent }]}>
      <Text style={[styles.label, { color: colors.accent }]}>POVESTEA TA</Text>
      <Text style={styles.title}>{story.title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

type VerifyDoneState = Extract<VerifyChatResponse, { done: true }>;

export function FinalVerifyCard({
  result,
  body,
}: {
  result: VerifyDoneState;
  body: string;
}) {
  const passed = result.status === 'VERIFIED';
  return (
    <View
      style={[
        styles.card,
        passed
          ? { borderColor: colors.success, alignItems: 'center' }
          : { borderColor: colors.border, alignItems: 'center' },
      ]}
    >
      <Text style={styles.emoji}>{passed ? '🎉' : result.canRetry ? '🤔' : '😅'}</Text>
      <Text style={[styles.title, { textAlign: 'center' }]}>
        {passed
          ? `${result.score} din 5 — bravo!`
          : result.canRetry
            ? 'Aproape! Mai incearca o data.'
            : 'Hmm, nu prea ai prins-o.'}
      </Text>
      <Text style={[styles.summary, { textAlign: 'center' }]}>{body}</Text>
      {passed && (result.xp.listener > 0 || result.xp.author > 0) && (
        <View style={styles.xpRow}>
          <Text style={styles.xpText}>+{result.xp.listener} XP pentru tine</Text>
          <Text style={styles.xpText}>+{result.xp.author} XP pentru prieten</Text>
        </View>
      )}
    </View>
  );
}

type ExtendDoneState = Extract<ExtendChatResponse, { finalStory: ExtendFinalStory }>;

export function FinalExtendCard({
  result,
  body,
}: {
  result: ExtendDoneState;
  body: string;
}) {
  return (
    <View style={[styles.card, { borderColor: colors.success }]}>
      <Text style={[styles.label, { color: colors.success, textAlign: 'center' }]}>
        CAPITOLUL TAU
      </Text>
      <Text style={[styles.title, { textAlign: 'center' }]}>{result.finalStory.title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Capitol {result.finalStory.chainLength} din lant</Text>
        {result.xp.extender.amount > 0 && (
          <Text style={styles.xpText}>+{result.xp.extender.amount} XP</Text>
        )}
      </View>
      {result.xp.chainBonusAwarded && (
        <Text style={styles.bonusText}>🌟 Bonus lant lung — toti autorii primesc XP!</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 22,
    padding: 18,
    gap: 8,
    borderWidth: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  body: { color: colors.text, fontSize: 16, lineHeight: 24 },
  summary: { color: colors.text, fontSize: 14, lineHeight: 20 },
  emoji: { fontSize: 48 },

  xpRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  xpText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800',
    backgroundColor: 'rgba(46,204,113,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  metaText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  bonusText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },
});
