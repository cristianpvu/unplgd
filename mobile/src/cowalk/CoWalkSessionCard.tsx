import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COWALK_MIN_DURATION_MS } from '../ble/constants';
import type { ClientSession } from '../ble/presence';
import { colors } from '../theme/colors';
import { AvatarStack } from './AvatarStack';
import { Landscape } from './Landscape';

// Scena de co-walk activa: un strip imersiv care da senzatia ca grupul merge
// continuu spre obiectivul XP. Trei layere de animatie:
//  1. Background — peisaj parallax (cer/munti/copaci/iarba), vezi Landscape.tsx.
//  2. Avatarele — bobbing translateY decalat pe index, ca pasi alternativi.
//     Mount-ul lor ramane spring 0→1 (cand intra cineva nou in sesiune).
//  3. Drumul — bara orizontala cu marker care urmareste ratio-ul real, capat
//     decorat cu o stea-obiectiv care pulseaza pana la cucerire.

const SCENE_HEIGHT = 192;

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function CoWalkSessionCard({
  session,
  now,
  onPause,
  onFocus,
}: {
  session: ClientSession;
  now: number;
  onPause?: () => void;
  onFocus?: () => void;
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
      {/* Peisaj parallax — 4 layere care curg cu viteze diferite. Cand
          obiectivul e cucerit, layerele se opresc (sesiunea s-a terminat). */}
      <Landscape paused={myAwarded} />

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

      {(onPause || onFocus) && !myAwarded && (
        <View style={styles.actionsRow}>
          {onFocus && (
            <Pressable
              onPress={onFocus}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionFocus,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.actionFocusText}>Mod concentrat</Text>
            </Pressable>
          )}
          {onPause && (
            <Pressable
              onPress={onPause}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionPause,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.actionPauseText}>Pauza</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

// Card afisat cand user-ul a apasat manual "Pauza". Sesiunea server-side e
// inchisa (cowalk:left a iesit catre peer-i); backend-ul va re-crea sesiunea
// la urmatorul heartbeat dupa "Reia" daca prietenul e inca in raza.
export function CoWalkPausedCard({ onResume }: { onResume: () => void }) {
  return (
    <View style={[styles.scene, styles.pausedScene]}>
      <View style={styles.pausedBadgeRow}>
        <View style={styles.pausedBadge}>
          <Text style={styles.pausedBadgeText}>PE PAUZA</Text>
        </View>
      </View>
      <Text style={styles.pausedTitle}>Co-walk oprit manual</Text>
      <Text style={styles.pausedHint}>
        La reluare, contorul de 10 minute incepe din nou (re-handshake).
      </Text>
      <Pressable
        onPress={onResume}
        style={({ pressed }) => [
          styles.resumeBtn,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.resumeBtnText}>Reia</Text>
      </Pressable>
    </View>
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
    paddingHorizontal: 12,
    overflow: 'hidden',
    gap: 10,
    borderRadius: 18,
    minHeight: SCENE_HEIGHT,
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

  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    zIndex: 2,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionFocus: {
    backgroundColor: colors.accent,
  },
  actionFocusText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  actionPause: {
    backgroundColor: 'rgba(45, 42, 74, 0.08)',
  },
  actionPauseText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  pausedScene: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 0,
    paddingVertical: 18,
    gap: 8,
    alignItems: 'center',
  },
  pausedBadgeRow: {
    width: '100%',
    alignItems: 'center',
  },
  pausedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(45, 42, 74, 0.08)',
  },
  pausedBadgeText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  pausedTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  pausedHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 12,
    lineHeight: 16,
  },
  resumeBtn: {
    marginTop: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
  },
  resumeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});

