import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COWALK_MIN_DURATION_MS } from '../ble/constants';
import type { ClientSession } from '../ble/presence';
import { colors } from '../theme/colors';
import { AvatarStack } from './AvatarStack';
import { Landscape } from './Landscape';

// Palier display data — trebuie aliniat cu COWALK_XP_TIERS din backend.
// Index = palier (0=baseline 10min, 1..3 = tick paliere).
const TIER_LABELS = ['Obiectiv 10 min', 'Palier 1', 'Palier 2', 'Palier 3'];
const TIER_RATES = [0, 5, 10, 15];

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
  // Marimea reala a cardului — masurata pe scena (view in-flux cu continut
  // real, onLayout se emite garantat). Landscape primeste dimensiuni numerice
  // exacte; nu mai depindem de absoluteFill (nesigur pe RN new arch aici).
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const onSceneLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!box || Math.abs(box.w - width) > 1 || Math.abs(box.h - height) > 1) {
      setBox({ w: width, h: height });
    }
  };

  const me = session.members.find((m) => m.isMe);
  const others = session.members.filter((m) => !m.isMe);
  const myJoinedAt = me?.joinedAtClient ?? session.startedAtClient;
  const myAwarded = me?.awarded ?? false;
  const elapsed = Math.max(0, now - myJoinedAt);

  // Pre-baseline (sub 10 min): bara umple liniar spre prima stea.
  // Post-baseline: ciclam la fiecare 10 min, marcam o stea pentru fiecare
  // palier complet. Stelele acumulate raman vizibile in partea stanga a barei.
  // Palierul curent dicteaza culoarea + rata XP afisata.
  const tier = me ? session.myTickTier : 0;
  // Cate stele/checkpoint-uri am atins. Pre-baseline: 0. Post-baseline: 1+tier.
  const checkpointsReached = myAwarded ? 1 + tier : 0;
  // Progress in palierul curent. Pre-baseline e fata de 10min; post-baseline
  // e progresul fata de urmatoarea stea, in cadrul aceluiasi tier de 10min.
  const ratio = myAwarded
    ? (elapsed % COWALK_MIN_DURATION_MS) / COWALK_MIN_DURATION_MS
    : Math.min(1, elapsed / COWALK_MIN_DURATION_MS);
  const remainingMs = Math.max(0, COWALK_MIN_DURATION_MS - elapsed);
  const currentRate = myAwarded ? (TIER_RATES[tier + 1] ?? TIER_RATES[TIER_RATES.length - 1]!) : 0;
  const tierLabel = myAwarded ? TIER_LABELS[Math.min(tier + 1, TIER_LABELS.length - 1)] : TIER_LABELS[0];

  const headline =
    others.length === 0
      ? 'Singur in raza'
      : others.length === 1
        ? `Cu ${others[0]!.name}`
        : `Cu ${others[0]!.name} +${others.length - 1}`;

  return (
    <View style={styles.scene} onLayout={onSceneLayout}>
      <View style={styles.sceneContent}>
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

      {/* Drumul spre XP — checkpoint-uri la fiecare 10 min dupa baseline. */}
      <CheckpointTrail
        ratio={ratio}
        awarded={myAwarded}
        checkpointsReached={checkpointsReached}
      />

      {myAwarded && (
        <View style={styles.tierRow}>
          <Text style={styles.tierLabel} numberOfLines={1}>
            {tierLabel} · {currentRate} XP/min
          </Text>
          <Text style={styles.tierXp}>+{session.myTickXp} XP</Text>
        </View>
      )}

      <View style={styles.footerRow}>
        <Text style={[styles.timer, myAwarded && { color: colors.success }]}>
          {formatDuration(elapsed)}
        </Text>
        <Text style={styles.hint}>
          {myAwarded
            ? 'Continui sa primesti XP cat mergi'
            : `inca ${formatDuration(remainingMs)} pana la primul XP`}
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

      {/* Peisaj parallax — 4 layere care curg cu viteze diferite; se opresc
          cand obiectivul e cucerit. ULTIMUL copil, in-flux, cu marginTop
          negativ (vezi Landscape.tsx) → se suprapune exact peste card, sub
          continut. Randat abia dupa ce onLayout ne da marimea cardului. */}
      {box && <Landscape paused={myAwarded} w={box.w} h={box.h} />}
    </View>
  );
}

// Pauza singulara admisa pana cand ghost-ul expira pe backend si sesiunea
// porneste de la 0 la urmatoarea reluare. Trebuie sa fie identic cu
// ABSENT_MAX_SINGLE_MS din backend/lib/cowalk/session.ts.
const RESUME_GRACE_MS = 3 * 60 * 1000;

// Card afisat cand user-ul a apasat manual "Pauza". Sesiunea server-side a
// fost mutata in pausedParticipants (joinedAt + steps + RSSI pastrate). Daca
// user-ul apasa Reia in 3 min, sesiunea continua de unde a ramas; daca trec
// 3 min, urmatorul handshake porneste de la 0.
export function CoWalkPausedCard({
  pausedAt,
  now,
  onResume,
}: {
  pausedAt: number | null;
  now: number;
  onResume: () => void;
}) {
  const elapsed = pausedAt ? Math.max(0, now - pausedAt) : 0;
  const remainingMs = Math.max(0, RESUME_GRACE_MS - elapsed);
  const expired = pausedAt !== null && remainingMs === 0;

  return (
    <View style={[styles.scene, styles.pausedScene]}>
      <View style={styles.pausedBadgeRow}>
        <View style={styles.pausedBadge}>
          <Text style={styles.pausedBadgeText}>PE PAUZA</Text>
        </View>
      </View>
      <Text style={styles.pausedTitle}>
        {expired ? 'Pauza expirata' : 'Co-walk oprit manual'}
      </Text>
      <Text style={styles.pausedHint}>
        {expired
          ? 'La reluare va incepe un handshake nou (de la 0).'
          : pausedAt
            ? `Ai ${formatDuration(remainingMs)} sa revii. Dupa, sesiunea reincepe.`
            : 'La reluare, sesiunea continua de unde a ramas.'}
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
// CheckpointTrail — drumul spre XP. Pre-baseline: bara umple liniar spre
// prima stea (10 min). Post-baseline: bara cicleaza la fiecare 10 min, fiecare
// ciclu adauga o stea pe track-ul de checkpoint-uri din partea stanga.
// =====================================================================

function CheckpointTrail({
  ratio,
  awarded,
  checkpointsReached,
}: {
  ratio: number;
  awarded: boolean;
  checkpointsReached: number;
}) {
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

  // Stea de obiectiv la capatul drumului — pulsa cand nu e cucerit inca,
  // fixa altfel. Post-baseline e tot o stea care pulseaza (urmatorul ciclu).
  const goalPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
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
  }, [goalPulse]);

  const goalScale = goalPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });

  return (
    <View style={styles.trailWrap}>
      {checkpointsReached > 0 && (
        <View style={styles.checkpointRow}>
          {Array.from({ length: Math.min(checkpointsReached, 6) }).map((_, i) => (
            <Star key={i} size={18} color={colors.success} />
          ))}
          {checkpointsReached > 6 && (
            <Text style={styles.checkpointMore}>+{checkpointsReached - 6}</Text>
          )}
        </View>
      )}

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
          <Star size={26} color={fillColor} />
        </Animated.View>

        <View style={[styles.endCap, { left: 0 }]} />
      </View>
    </View>
  );
}

function Star({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2 L14.5 9 L22 9.5 L16 14 L18 22 L12 17.5 L6 22 L8 14 L2 9.5 L9.5 9 Z"
        fill={color}
        stroke="#FFFFFF"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// =====================================================================
// Styles
// =====================================================================

const styles = StyleSheet.create({
  // Fara gap/padding aici (vezi comentariul din render) — doar forma cardului.
  scene: {
    overflow: 'hidden',
    borderRadius: 18,
    minHeight: SCENE_HEIGHT,
  },
  sceneContent: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 10,
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

  trailWrap: {
    gap: 6,
    zIndex: 2,
  },
  checkpointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 2,
  },
  checkpointMore: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 4,
  },

  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
    zIndex: 2,
  },
  tierLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  tierXp: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '900',
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

