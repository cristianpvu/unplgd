import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { colors } from '../theme/colors';

// Ilustratia de scanare NFC a bratarii: telefonul (stanga) aluneca spre dreapta
// catre bratara (dreapta). Cand ajunge aproape, ies unde NFC ")))" intre ele.
// Cand `active`, merge mai repede. Cand NFC e indisponibil (`enabled=false`),
// ramane static estompat.
//
// Sursa unica pentru toate ecranele care cer apropierea bratarii (link-bracelet
// onboarding, scan-friend, co-create). Inlocuieste vechiul emoji 📡.
export function BraceletScanAnimation({
  active,
  enabled,
}: {
  active: boolean;
  enabled: boolean;
}) {
  // approach: 0 = telefon departe (stanga), 1 = aproape de bratara (dreapta).
  const approach = useRef(new Animated.Value(0)).current;
  const waves = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    if (!enabled) {
      approach.setValue(0.5);
      return;
    }
    const move = active ? 560 : 850;
    const hold = active ? 420 : 650;

    const phoneLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(approach, { toValue: 1, duration: move, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(hold),
        Animated.timing(approach, { toValue: 0, duration: move, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(active ? 200 : 500),
      ]),
    );
    phoneLoop.start();

    const wavePeriod = active ? 900 : 1400;
    const waveLoops = waves.map((w, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * (wavePeriod / 3)),
          Animated.timing(w, { toValue: 1, duration: wavePeriod, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(w, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    waveLoops.forEach((l) => l.start());

    return () => {
      phoneLoop.stop();
      waveLoops.forEach((l) => l.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, enabled]);

  // Telefonul aluneca ~46px spre dreapta (catre bratara).
  const phoneX = approach.interpolate({ inputRange: [0, 1], outputRange: [-46, 0] });
  // Undele apar doar cand telefonul e aproape (contact).
  const contact = approach.interpolate({ inputRange: [0, 0.65, 1], outputRange: [0, 0, 1] });

  return (
    <View style={styles.scanWrap}>
      {/* Telefon care aluneca spre dreapta */}
      <Animated.View style={[styles.phoneLayer, { transform: [{ translateX: phoneX }] }]} pointerEvents="none">
        <Phone enabled={enabled} />
      </Animated.View>

      {/* Unde NFC ")))" intre telefon si bratara, gated de contact */}
      {enabled &&
        waves.map((w, i) => {
          const translateX = w.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
          const opacity = Animated.multiply(
            w.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.7, 0] }),
            contact,
          );
          return (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[styles.waveArc, { left: 150 + i * 12, opacity, transform: [{ translateX }] }]}
            >
              <Svg width={26} height={70} viewBox="0 0 26 70">
                {/* arc ")" deschis spre stanga (telefon) */}
                <Path d="M6 8 Q22 35 6 62" stroke={colors.accent} strokeWidth={4} strokeLinecap="round" fill="none" />
              </Svg>
            </Animated.View>
          );
        })}

      {/* Bratara (dreapta, statica) */}
      <View style={styles.braceletLayer} pointerEvents="none">
        <Bracelet enabled={enabled} />
      </View>
    </View>
  );
}

// Telefon curat vazut din fata (ecran simplu, fara linii pe el).
function Phone({ enabled }: { enabled: boolean }) {
  return (
    <Svg width={104} height={168} viewBox="0 0 104 168">
      <Rect x={8} y={6} width={88} height={156} rx={20} fill={colors.card} stroke={colors.text} strokeWidth={3} />
      {/* ecran */}
      <Rect x={18} y={20} width={68} height={128} rx={10} fill={enabled ? '#F4EFFF' : colors.cardAlt} />
      {/* notch / difuzor */}
      <Rect x={42} y={12} width={20} height={4} rx={2} fill={colors.text} opacity={0.4} />
    </Svg>
  );
}

// Bratara reala: bangla (inel gros vertical, ca o bratara vazuta din lateral)
// cu un charm NFC pe partea dinspre telefon (stanga).
function Bracelet({ enabled }: { enabled: boolean }) {
  const band = enabled ? colors.secondary : colors.border;
  const charm = enabled ? colors.accent : colors.cardAlt;
  return (
    <Svg width={96} height={150} viewBox="0 0 96 150">
      {/* banda bratarii — inel vertical gros */}
      <Ellipse cx={54} cy={75} rx={28} ry={56} fill="none" stroke={band} strokeWidth={20} />
      {/* highlight subtil */}
      <Ellipse cx={54} cy={75} rx={28} ry={56} fill="none" stroke="#FFFFFF" strokeWidth={3} opacity={0.25} />
      {/* charm NFC pe marginea stanga (catre telefon) */}
      <Rect x={10} y={60} width={30} height={30} rx={9} fill={charm} stroke="#FFFFFF" strokeWidth={3} />
      <Circle cx={25} cy={75} r={5} fill="#FFFFFF" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  scanWrap: { width: 280, height: 220, alignItems: 'center', justifyContent: 'center' },
  phoneLayer: { position: 'absolute', left: 34, top: 26 },
  braceletLayer: { position: 'absolute', right: 42, top: 36 },
  // Cele 3 arce ")))" intre telefon si bratara (decalate orizontal).
  waveArc: { position: 'absolute', left: 138, top: 76 },
});
