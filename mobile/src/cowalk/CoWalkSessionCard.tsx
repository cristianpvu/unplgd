import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { COWALK_MIN_DURATION_MS } from '../ble/constants';
import type { ClientSession } from '../ble/presence';
import { colors } from '../theme/colors';
import { AvatarStack } from './AvatarStack';

// Card pentru o sesiune co-walk activa: hero cu avatare animate, counter mare,
// bara de progres cu shimmer. Se monteaza la inceperea sesiunii (cand UI
// switch-uieste la "Co-walk in derulare") si se demonteaza cand sesiunea pleaca
// din lista. Animatiile interne (mount + shimmer + pulse LIVE) ruleaza tot
// timpul ca sesiunea sa "respire".

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function CoWalkSessionCard({
  session,
  now,
}: {
  session: ClientSession;
  now: number;
}) {
  const me = session.members.find((m) => m.isMe);
  const others = session.members.filter((m) => !m.isMe);
  const myJoinedAt = me?.joinedAtClient ?? session.startedAtClient;
  const myAwarded = me?.awarded ?? false;
  const elapsed = Math.max(0, now - myJoinedAt);
  const ratio = Math.min(1, elapsed / COWALK_MIN_DURATION_MS);
  const remainingMs = Math.max(0, COWALK_MIN_DURATION_MS - elapsed);

  // Shimmer trece peste bara de progres in bucla — sugereaza ca sesiunea e
  // "vie", chiar si cand timpul aproape ca sta pe loc vizual la inceput.
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (myAwarded) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [myAwarded, shimmer]);

  // Pulse pe dot-ul "LIVE" — semnal subtil ca evenimentele real-time curg.
  const livePulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(livePulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [livePulse]);
  const liveDotOpacity = livePulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  const headline =
    others.length === 0
      ? 'Singur in raza'
      : others.length === 1
        ? `Cu ${others[0]!.name}`
        : `Cu ${others[0]!.name} +${others.length - 1}`;

  const fillColor = myAwarded ? colors.success : colors.accent;

  return (
    <View style={styles.card}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 400 200"
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient id="cowalkGlow" cx="0.2" cy="0.2" r="0.9">
            <Stop offset="0%" stopColor={colors.accent} stopOpacity={myAwarded ? '0' : '0.25'} />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="cowalkGlow2" cx="0.9" cy="0.95" r="0.7">
            <Stop offset="0%" stopColor={myAwarded ? colors.success : colors.secondary} stopOpacity="0.25" />
            <Stop offset="100%" stopColor={colors.secondary} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="80" cy="60" r="160" fill="url(#cowalkGlow)" />
        <Circle cx="360" cy="190" r="160" fill="url(#cowalkGlow2)" />
      </Svg>

      <View style={styles.topRow}>
        <View style={styles.liveBadge}>
          <Animated.View style={[styles.liveDot, { opacity: liveDotOpacity }]} />
          <Text style={styles.liveText}>{myAwarded ? 'COMPLET' : 'LIVE'}</Text>
        </View>
        <Text style={styles.squadCount}>
          {session.members.length} {session.members.length === 1 ? 'membru' : 'membri'}
        </Text>
      </View>

      <View style={styles.avatarsRow}>
        <AvatarStack members={session.members} />
      </View>

      <Text style={styles.headline} numberOfLines={1}>
        {headline}
      </Text>

      <View style={styles.timerRow}>
        <Text style={[styles.timerBig, { color: fillColor }]}>
          {myAwarded ? '✓ Acordat' : formatDuration(elapsed)}
        </Text>
        {!myAwarded && <Text style={styles.timerCap}>/ 10:00</Text>}
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: fillColor }]}>
          {!myAwarded && (
            <Animated.View
              style={[
                styles.shimmer,
                {
                  transform: [
                    {
                      translateX: shimmer.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-60, 360],
                      }),
                    },
                  ],
                },
              ]}
            />
          )}
        </View>
      </View>

      <Text style={styles.hint}>
        {myAwarded
          ? 'XP acordat azi pentru aceasta sesiune'
          : `Mai sunt ${formatDuration(remainingMs)} pana la XP`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    gap: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 79, 107, 0.12)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  liveText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  squadCount: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  avatarsRow: {
    paddingTop: 4,
    paddingBottom: 2,
  },
  headline: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  timerBig: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  timerCap: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginTop: 2,
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.55)',
    transform: [{ skewX: '-20deg' }],
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
