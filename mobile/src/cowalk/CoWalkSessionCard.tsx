import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COWALK_MIN_DURATION_MS } from '../ble/constants';
import type { ClientSession } from '../ble/presence';
import { colors } from '../theme/colors';
import { AvatarStack } from './AvatarStack';

// Scena de co-walk activa: un strip imersiv care da senzatia ca grupul merge
// continuu spre obiectivul XP. Trei layere de animatie:
//  1. Background — linii oblice care se deruleaza orizontal in bucla (treadmill).
//     Doua copii ale aceluiasi pattern translateX → cand prima ajunge la
//     -PATTERN_W, salt instant la 0 (seamless loop, fara taietura vizibila).
//  2. Avatarele — bobbing translateY decalat pe index, ca pasi alternativi.
//     Mount-ul lor ramane spring 0→1 (cand intra cineva nou in sesiune).
//  3. Drumul — bara orizontala cu marker care urmareste ratio-ul real, capat
//     decorat cu o pictograma de obiectiv (zap). Marker-ul anim spring catre
//     pozitia noua la fiecare update de timp.

const PATTERN_W = 220;
const SCENE_HEIGHT = 168;

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

  const headline =
    others.length === 0
      ? 'Singur in raza'
      : others.length === 1
        ? `Cu ${others[0]!.name}`
        : `Cu ${others[0]!.name} +${others.length - 1}`;

  return (
    <View style={styles.scene}>
      {/* Banda fundal cu linii in miscare — efectul de "merg continuu". */}
      <View style={styles.scrollWrap} pointerEvents="none">
        <Treadmill paused={myAwarded} />
        <View style={styles.skylineFade} />
      </View>

      {/* Header: LIVE pulse + count + textul "spre XP". */}
      <View style={styles.headerRow}>
        <LiveBadge awarded={myAwarded} />
        <Text style={styles.squadCount}>
          {session.members.length} {session.members.length === 1 ? 'in pas' : 'in pas'}
        </Text>
      </View>

      {/* Grupul care merge — bobbing pe avatare, mount spring cand intra unul nou. */}
      <View style={styles.groupRow}>
        <AvatarStack members={session.members} walking={!myAwarded} />
      </View>

      <Text style={styles.headline} numberOfLines={1}>
        {headline}
      </Text>

      {/* Drumul spre XP. */}
      <ProgressTrail ratio={ratio} awarded={myAwarded} />

      <View style={styles.footerRow}>
        <Text style={[styles.timer, myAwarded && { color: colors.success }]}>
          {myAwarded ? '✓ Acordat' : formatDuration(elapsed)}
        </Text>
        <Text style={styles.hint}>
          {myAwarded
            ? 'XP primit pentru aceasta sesiune'
            : `inca ${formatDuration(remainingMs)} pana la XP`}
        </Text>
      </View>
    </View>
  );
}

// =====================================================================
// Treadmill — fundal cu linii oblice care curg orizontal continuu
// =====================================================================

function Treadmill({ paused }: { paused: boolean }) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (paused) {
      x.stopAnimation();
      return;
    }
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 5200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [paused, x]);

  const translate = x.interpolate({ inputRange: [0, 1], outputRange: [0, -PATTERN_W] });

  return (
    <Animated.View style={[styles.treadmill, { transform: [{ translateX: translate }] }]}>
      <Pattern />
      <Pattern />
      <Pattern />
    </Animated.View>
  );
}

function Pattern() {
  // Linii diagonale la fiecare 36px. PATTERN_W = 220 → ~6 linii vizibile per
  // copie. Capatul stang al unei copii e identic cu capatul drept al copiei
  // anterioare → scroll-ul e seamless cand reset la translateX 0.
  const lines = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < 8; i++) out.push(i * 36);
    return out;
  }, []);
  return (
    <Svg width={PATTERN_W} height={SCENE_HEIGHT} viewBox={`0 0 ${PATTERN_W} ${SCENE_HEIGHT}`}>
      {lines.map((x, i) => (
        <Path
          key={i}
          d={`M${x - 40} ${SCENE_HEIGHT + 20} L${x + 80} -20`}
          stroke={colors.accent}
          strokeWidth={2}
          opacity={0.32}
        />
      ))}
    </Svg>
  );
}

// =====================================================================
// LIVE badge cu dot pulsant
// =====================================================================

function LiveBadge({ awarded }: { awarded: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (awarded) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [awarded, pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const bg = awarded ? 'rgba(46, 204, 113, 0.15)' : 'rgba(255, 79, 107, 0.16)';
  const dotColor = awarded ? colors.success : colors.danger;
  const textColor = awarded ? colors.success : colors.danger;

  return (
    <View style={[styles.liveBadge, { backgroundColor: bg }]}>
      <Animated.View
        style={[
          styles.liveDot,
          { backgroundColor: dotColor, opacity: awarded ? 1 : opacity },
        ]}
      />
      <Text style={[styles.liveText, { color: textColor }]}>
        {awarded ? 'COMPLET' : 'LIVE'}
      </Text>
    </View>
  );
}

// =====================================================================
// ProgressTrail — drumul spre XP cu marker animat
// =====================================================================

function ProgressTrail({ ratio, awarded }: { ratio: number; awarded: boolean }) {
  const TRACK_H = 14;
  const target = useRef(new Animated.Value(ratio)).current;
  useEffect(() => {
    Animated.spring(target, {
      toValue: ratio,
      friction: 8,
      tension: 50,
      useNativeDriver: false,
    }).start();
  }, [ratio, target]);

  const fillWidth = target.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const fillColor = awarded ? colors.success : colors.accent;

  // Stea de obiectiv la capatul drumului — pulsa cand nu e cucerit, fixa cand
  // ratio === 1. SVG simplu pe layer separat ca sa fie peste track.
  const goalPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (awarded) {
      goalPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(goalPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(goalPulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [awarded, goalPulse]);

  const goalScale = goalPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });

  return (
    <View style={styles.trail}>
      <View style={[styles.track, { height: TRACK_H }]}>
        <Animated.View
          style={[
            styles.fill,
            { width: fillWidth, backgroundColor: fillColor, height: TRACK_H },
          ]}
        />
      </View>

      <Animated.View style={[styles.goal, { transform: [{ scale: goalScale }] }]}>
        <Svg width={26} height={26} viewBox="0 0 24 24">
          <Path
            d="M12 2 L14.5 9 L22 9.5 L16 14 L18 22 L12 17.5 L6 22 L8 14 L2 9.5 L9.5 9 Z"
            fill={awarded ? colors.success : colors.accent}
            stroke="#FFFFFF"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>

      {/* Linii la capete pentru "start / finish". */}
      <View style={[styles.endCap, { left: 0 }]} />
    </View>
  );
}

// =====================================================================
// Styles
// =====================================================================

const styles = StyleSheet.create({
  scene: {
    paddingVertical: 16,
    paddingHorizontal: 4,
    overflow: 'hidden',
    gap: 10,
  },
  scrollWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  treadmill: {
    flexDirection: 'row',
    height: SCENE_HEIGHT,
  },
  skylineFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 226, 122, 0.55)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  squadCount: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  groupRow: {
    paddingTop: 6,
    paddingBottom: 4,
    alignItems: 'center',
    zIndex: 2,
  },
  headline: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    zIndex: 2,
  },
  trail: {
    height: 28,
    justifyContent: 'center',
    marginTop: 4,
    zIndex: 2,
    paddingRight: 28,
  },
  track: {
    backgroundColor: 'rgba(45, 42, 74, 0.12)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 999,
  },
  goal: {
    position: 'absolute',
    right: 0,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endCap: {
    position: 'absolute',
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: colors.text,
    opacity: 0.18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 2,
  },
  timer: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
});

