import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors } from '../theme/colors';

// Avatar circular pentru un membru de co-walk. Cand chip-ul e montat (membru
// nou se alatura sesiunii), spring-ul scale 0→1 produce un "pop in" satisfacator.
// Existentele nu se remontaza — react foloseste key={userId}, deci doar noul
// chip animeaza, restul raman pe loc.

const SIZE = 64;

export type AvatarChipMember = {
  userId: string;
  name: string;
  avatarSvg: string | null;
  isMe: boolean;
  awarded: boolean;
};

export function AvatarChip({
  member,
  zIndex,
  bobIndex,
}: {
  member: AvatarChipMember;
  zIndex: number;
  // Cand setat, porneste un bobbing pe translateY cu offset per index pentru
  // efectul de "grup care merge" (pasi alternativi). Anim infinita.
  bobIndex?: number;
}) {
  const scale = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  // Pulse pe halo cand memberul e "live" (nu inca awarded). Anim infinita
  // usoara, nu agresiva. Cand a primit XP, halo-ul ramane verde fix.
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  useEffect(() => {
    if (bobIndex === undefined) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay((bobIndex % 4) * 130),
        Animated.timing(bob, {
          toValue: -7,
          duration: 320,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 320,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(220),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bobIndex, bob]);

  useEffect(() => {
    if (member.awarded) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [member.awarded, pulse]);

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  const haloColor = member.awarded ? colors.success : member.isMe ? colors.accent : colors.secondary;

  const initials = member.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <Animated.View
      style={[styles.chip, { zIndex, transform: [{ scale }, { translateY: bob }] }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            backgroundColor: haloColor,
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
          },
        ]}
      />
      <View
        style={[
          styles.ring,
          member.isMe && { borderColor: colors.accent },
          member.awarded && { borderColor: colors.success },
        ]}
      >
        {member.avatarSvg ? (
          <View style={styles.svgWrap}>
            <SvgXml xml={member.avatarSvg} width={SIZE - 8} height={SIZE - 8} />
          </View>
        ) : (
          <View style={[styles.svgWrap, styles.fallback]}>
            <Text style={styles.fallbackText}>{initials || '?'}</Text>
          </View>
        )}
      </View>
      {member.awarded && (
        <View style={styles.checkBadge}>
          <Text style={styles.checkText}>✓</Text>
        </View>
      )}
    </Animated.View>
  );
}

// Stack-ul orizontal de avatare cu overlap. Eu (isMe) apare primul. Cand un
// membru nou intra in lista, doar el animeaza pop-in (key=userId). Daca
// `walking` e true, fiecare chip face si bobbing — folosit pe scena de co-walk
// activa pentru senzatia ca grupul "merge".
export function AvatarStack({
  members,
  walking,
}: {
  members: AvatarChipMember[];
  walking?: boolean;
}) {
  return (
    <View style={styles.stack}>
      {members.map((m, i) => (
        <View
          key={m.userId}
          style={{ marginLeft: i === 0 ? 0 : -OVERLAP }}
        >
          <AvatarChip
            member={m}
            zIndex={members.length - i}
            bobIndex={walking ? i : undefined}
          />
        </View>
      ))}
    </View>
  );
}

const OVERLAP = 18;

const styles = StyleSheet.create({
  stack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
  },
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  svgWrap: {
    width: SIZE - 8,
    height: SIZE - 8,
    borderRadius: (SIZE - 8) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.cardAlt,
  },
  fallback: {
    backgroundColor: colors.accentDim,
  },
  fallbackText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  checkBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  checkText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
