import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { Peer } from '../ble/presence';
import { colors } from '../theme/colors';

// Card de loader pentru fereastra dintre "BLE pornit" si "sesiune confirmata".
// Inlocuieste vidul anterior pe nearby cand engine-ul cauta sau face handshake.
//
// Patru stari, in ordinea fluxului real:
//   starting   — engine pornit dar BLE nu e PoweredOn (waiting permissions/BT)
//   scanning   — engine activ, nici un peer in scanare inca
//   detecting  — vad peer-i dar nu sunt rezolvati la useri (token in API)
//   handshake  — vad prieten in raza, asteptam mutual visibility pe backend
//
// La handshake afisam si numele prietenilor — copilul vede direct "se conecteaza
// cu Andrei" si stie ca telefonul lucreaza, nu e blocat.

export type HandshakeStage = 'starting' | 'scanning' | 'detecting' | 'handshake';

export function HandshakeCard({
  stage,
  unresolvedCount,
  friendsInRange,
}: {
  stage: HandshakeStage;
  unresolvedCount: number;
  friendsInRange: Peer[];
}) {
  const title = (() => {
    switch (stage) {
      case 'starting':
        return 'Pornesc Bluetooth...';
      case 'scanning':
        return 'Caut prieteni in apropiere';
      case 'detecting':
        return `Detectez dispozitive (${unresolvedCount})`;
      case 'handshake': {
        if (friendsInRange.length === 0) return 'Sincronizez...';
        if (friendsInRange.length === 1) {
          return `Ma conectez cu ${friendsInRange[0]!.name ?? 'prietenul tau'}`;
        }
        return `Ma conectez cu ${friendsInRange.length} prieteni`;
      }
    }
  })();

  const hint = (() => {
    switch (stage) {
      case 'starting':
        return 'Verific permisiunile si pornesc semnalul.';
      case 'scanning':
        return 'Tine telefonul aproape de un prieten care are aplicatia deschisa.';
      case 'detecting':
        return 'Identific cine sunt — dureaza cateva secunde.';
      case 'handshake':
        return 'Confirm ca amandoi sunteti aproape si pornesc co-walk-ul.';
    }
  })();

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Spinner color={stage === 'handshake' ? colors.accent : colors.textMuted} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.hint}>{hint}</Text>
        </View>
      </View>

      {stage === 'handshake' && (
        <View style={styles.dotsRow}>
          <ProgressDots />
        </View>
      )}
    </View>
  );
}

function Spinner({ color }: { color: string }) {
  const rotate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [rotate]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.spinner,
        { borderTopColor: color, transform: [{ rotate: spin }] },
      ]}
    />
  );
}

// Trei dots care pulseaza in cascada — semnal vizibil ca "se intampla ceva
// activ". Folosit pe stage='handshake' unde delay-ul real (pana la 25s din
// HEARTBEAT_INTERVAL) cere reasigurare suplimentara.
function ProgressDots() {
  return (
    <>
      <Dot delay={0} />
      <Dot delay={180} />
      <Dot delay={360} />
    </>
  );
}

function Dot({ delay }: { delay: number }) {
  const v = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0.3,
          duration: 380,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);

  const scale = v.interpolate({ inputRange: [0.3, 1], outputRange: [0.7, 1] });
  return (
    <Animated.View
      style={[styles.dot, { opacity: v, transform: [{ scale }] }]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  spinner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: 'rgba(45, 42, 74, 0.12)',
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
});
