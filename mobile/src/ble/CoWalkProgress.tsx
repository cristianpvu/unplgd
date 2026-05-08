import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { usePresence } from './usePresence';
import { COWALK_MIN_DURATION_MS } from './constants';
import type { ClientSession } from './presence';
import { colors } from '../theme/colors';

// Card vizibil oriunde in app cand user-ul are co-walk-uri active.
// Sursa de adevar: server (prin socket). Refresha la 1s pt animatia barii.

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Returneaza joinedAt-ul propriu (sau startedAt ca fallback) si lista celorlalti.
function readSession(s: ClientSession): {
  myJoinedAtClient: number;
  myAwarded: boolean;
  others: ClientSession['members'];
} {
  const me = s.members.find((m) => m.isMe);
  const others = s.members.filter((m) => !m.isMe);
  return {
    myJoinedAtClient: me?.joinedAtClient ?? s.startedAtClient,
    myAwarded: me?.awarded ?? false,
    others,
  };
}

export function CoWalkProgressCard() {
  const { sessions } = usePresence();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (sessions.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sessions.length]);

  if (sessions.length === 0) return null;

  const primary = sessions[0];
  if (!primary) return null;
  const { myJoinedAtClient, myAwarded, others } = readSession(primary);
  const elapsed = now - myJoinedAtClient;
  const ratio = Math.max(0, Math.min(1, elapsed / COWALK_MIN_DURATION_MS));
  const remainingMs = Math.max(0, COWALK_MIN_DURATION_MS - elapsed);

  const otherNames = others.map((o) => o.name).filter(Boolean);
  const headline = otherNames.length === 0
    ? 'Co-walk in derulare'
    : otherNames.length === 1
      ? `Co-walk cu ${otherNames[0]}`
      : `Co-walk cu ${otherNames[0]} +${otherNames.length - 1}`;

  return (
    <Pressable
      onPress={() => router.push('/(app)/nearby')}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          🚶 {headline}
          {sessions.length > 1 ? ` · +${sessions.length - 1} sesiuni` : ''}
        </Text>
        <Text style={styles.timer}>
          {myAwarded ? '✓ Acordat' : `${formatDuration(elapsed)} / 10:00`}
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${ratio * 100}%`,
              backgroundColor: myAwarded ? colors.success : colors.accent,
            },
          ]}
        />
      </View>
      <Text style={styles.hint}>
        {myAwarded
          ? 'XP acordat azi · Continua sa stati impreuna'
          : `Mai sunt ${formatDuration(remainingMs)} pana la XP`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardAlt,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.accentDim,
    gap: 8,
  },
  cardPressed: { opacity: 0.85 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { color: colors.text, fontSize: 14, fontWeight: '800', flex: 1 },
  timer: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  track: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 999 },
  hint: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
});
