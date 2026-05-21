// Scena vizuala — full-bleed. Primeste un WorldPack (= cum arata lumea
// pet-ului) si un Biome (= stadiul curent zi/noapte). Scene NU stie nimic
// specific despre pet — totul vine din pack.

import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop, RadialGradient } from 'react-native-svg';
import type { JourneyObstacle } from './mock';
import type { Biome, WorldPack } from './worlds/types';
import { AmbientLayer } from './AmbientLayer';
import { Celestial } from './Celestial';
import type { BiomeTransition } from './worlds/util';

const LAYER_W = 900;
const PET_LEFT_RATIO = 0.22;
const OBSTACLE_STOP_RATIO = 0.58;
const SCROLL_DURATION_MS = 22000;

type Props = {
  world: WorldPack;
  // Tranzitie completa (effective + from + to + t). Scene foloseste `effective`
  // pt culori si `from/to/t` pt crossfade-ul celestial.
  transition: BiomeTransition;
  petImageUrl: string | null;
  obstacle: JourneyObstacle | null;
  walking: boolean;
  onArrive: () => void;
};

export function Scene({ world, transition, petImageUrl, obstacle, walking, onArrive }: Props) {
  const biome = transition.effective;
  const { width, height } = useWindowDimensions();
  const groundY = height * 0.78;
  const petSize = Math.min(190, height * 0.42);
  const petLeft = width * PET_LEFT_RATIO;
  const obstacleStopX = width * OBSTACLE_STOP_RATIO;

  const scrollAnim = useRef(new Animated.Value(0)).current;
  const petBob = useRef(new Animated.Value(0)).current;
  const obstacleX = useRef(new Animated.Value(width + 100)).current;
  const obstacleShake = useRef(new Animated.Value(0)).current;
  // Pet reactions — mic "tilt" ocazional al capului, ca pet-ul ar fi observat
  // ceva. Random la 5-12s; spring back la 0.
  const petTilt = useRef(new Animated.Value(0)).current;
  // Mic "breath" al camerei — sine lent pe Y, ~3px amplitudine, perioada ~7s.
  // Da senzatia ca lumea respira, nu e statica ca o poza.
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 3500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 3500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);

  const breathY = breath.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });

  useEffect(() => {
    if (!walking) {
      scrollAnim.stopAnimation();
      return;
    }
    scrollAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(scrollAnim, {
        toValue: -LAYER_W,
        duration: SCROLL_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [walking, scrollAnim]);

  // Pet tilt ocazional — il declansam la intervale random, doar in walking.
  useEffect(() => {
    if (!walking) {
      petTilt.stopAnimation();
      Animated.timing(petTilt, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
      return;
    }
    let cancelled = false;
    const scheduleNext = () => {
      const delay = 5000 + Math.random() * 7000;
      const timer = setTimeout(() => {
        if (cancelled) return;
        const dir = Math.random() > 0.5 ? 1 : -1;
        Animated.sequence([
          Animated.timing(petTilt, {
            toValue: dir,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.delay(400),
          Animated.spring(petTilt, {
            toValue: 0,
            useNativeDriver: true,
            friction: 5,
            tension: 60,
          }),
        ]).start(() => {
          if (!cancelled) scheduleNext();
        });
      }, delay);
      return () => clearTimeout(timer);
    };
    const cleanup = scheduleNext();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [walking, petTilt]);

  useEffect(() => {
    if (!walking) {
      petBob.stopAnimation();
      Animated.timing(petBob, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(petBob, {
          toValue: 1,
          duration: 380,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(petBob, {
          toValue: 0,
          duration: 380,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [walking, petBob]);

  useEffect(() => {
    if (obstacle) {
      obstacleX.setValue(width + 100);
      Animated.spring(obstacleX, {
        toValue: obstacleStopX,
        useNativeDriver: true,
        friction: 9,
        tension: 28,
      }).start(({ finished }) => {
        if (finished) {
          Animated.sequence([
            Animated.timing(obstacleShake, {
              toValue: 1,
              duration: 90,
              useNativeDriver: true,
            }),
            Animated.timing(obstacleShake, {
              toValue: -1,
              duration: 90,
              useNativeDriver: true,
            }),
            Animated.timing(obstacleShake, {
              toValue: 0,
              duration: 90,
              useNativeDriver: true,
            }),
          ]).start();
          onArrive();
        }
      });
    } else {
      Animated.timing(obstacleX, {
        toValue: -200,
        duration: 700,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obstacle?.id, width]);

  const midTranslate = useMemo(
    () => scrollAnim.interpolate({ inputRange: [-LAYER_W, 0], outputRange: [-LAYER_W * 0.35, 0] }),
    [scrollAnim],
  );

  const cloudsTranslate = useMemo(
    () => scrollAnim.interpolate({ inputRange: [-LAYER_W, 0], outputRange: [-LAYER_W * 0.1, 0] }),
    [scrollAnim],
  );

  const backTranslate = useMemo(
    () => scrollAnim.interpolate({ inputRange: [-LAYER_W, 0], outputRange: [-LAYER_W * 0.18, 0] }),
    [scrollAnim],
  );

  const petTranslateY = petBob.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -5],
  });

  const petTiltDeg = petTilt.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-6deg', '0deg', '6deg'],
  });

  const obstacleRotate = obstacleShake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-4deg', '0deg', '4deg'],
  });

  const skyH = groundY;
  const midH = height * 0.32;
  const groundH = height - groundY;

  // Ambient entities split pe layer pt z-ordering corect.
  const ambientBack = world.ambient.filter((a) => a.layer === 'back');
  const ambientMid = world.ambient.filter((a) => a.layer === 'mid');
  const ambientFore = world.ambient.filter((a) => a.layer === 'fore');

  // Cauta shape-ul curent in world. Fallback la primul shape din lume daca
  // shapeKey nu se gaseste.
  const shapeNode = obstacle
    ? (world.obstacles.find((s) => s.key === obstacle.shapeKey) ?? world.obstacles[0])
    : null;

  // Crossfade celestial intre `from` si `to` pe baza progresului tranzitiei.
  // Cand t=0 vedem 100% from. Cand t=1 vedem 100% to. Random pe mijloc — ambele
  // partial vizibile, ceea ce arata ca "soarele apune si rasare luna".
  const fromCelestial = transition.from.celestial;
  const toCelestial = transition.to.celestial;

  return (
    <View style={[styles.scene, { backgroundColor: biome.skyColor }]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateY: breathY }] }]}
        pointerEvents="box-none"
      >
      {/* Sky gradient subtle — adauga adancime (mai luminat in jos pe orizont) */}
      <Svg
        width={width}
        height={skyH}
        style={{ position: 'absolute', top: 0, left: 0 }}
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={biome.skyColor} stopOpacity="0" />
            <Stop offset="1" stopColor={biome.skyColor} stopOpacity="0.4" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={skyH} fill="url(#skyGrad)" />
      </Svg>

      {/* Celestial body — soare/luna/planeta. Crossfade intre from si to. */}
      {fromCelestial && (
        <View
          style={{
            position: 'absolute',
            left: width * fromCelestial.position[0] - fromCelestial.size / 2,
            top: height * fromCelestial.position[1] - fromCelestial.size / 2,
            opacity: 1 - transition.t,
          }}
          pointerEvents="none"
        >
          <Celestial config={fromCelestial} />
        </View>
      )}
      {toCelestial && toCelestial !== fromCelestial && transition.t > 0 && (
        <View
          style={{
            position: 'absolute',
            left: width * toCelestial.position[0] - toCelestial.size / 2,
            top: height * toCelestial.position[1] - toCelestial.size / 2,
            opacity: transition.t,
          }}
          pointerEvents="none"
        >
          <Celestial config={toCelestial} />
        </View>
      )}

      {/* Ambient — strat din spate (stele, pasari departe) */}
      {ambientBack.length > 0 && (
        <AmbientLayer entities={ambientBack} screenW={width} screenH={height} />
      )}

      {/* Nori / nebuloasa — animat foarte lent */}
      {world.renderCloudsLayer && (
        <Animated.View
          style={[
            styles.cloudsLayer,
            {
              width: LAYER_W * 2,
              top: skyH * 0.18,
              transform: [{ translateX: cloudsTranslate }],
            },
          ]}
        >
          <View>{world.renderCloudsLayer({ width: LAYER_W, height: skyH })}</View>
          <View>{world.renderCloudsLayer({ width: LAYER_W, height: skyH })}</View>
        </Animated.View>
      )}

      {/* Strat parallax extra (munti distanti) — daca world-ul il defineste */}
      {world.renderBackLayer && (
        <Animated.View
          style={[
            styles.midLayer,
            {
              width: LAYER_W * 2,
              transform: [{ translateX: backTranslate }],
              bottom: groundH + midH * 0.4,
            },
          ]}
        >
          <View>
            {world.renderBackLayer({ width: LAYER_W, height: midH * 0.6, color: biome.midColor })}
          </View>
          <View>
            {world.renderBackLayer({ width: LAYER_W, height: midH * 0.6, color: biome.midColor })}
          </View>
        </Animated.View>
      )}

      {/* Ambient — strat mediu (stele cazatoare, fulgi) */}
      {ambientMid.length > 0 && (
        <AmbientLayer entities={ambientMid} screenW={width} screenH={height} />
      )}

      {/* Dealuri / munti / structuri */}
      <Animated.View
        style={[
          styles.midLayer,
          {
            width: LAYER_W * 2,
            transform: [{ translateX: midTranslate }],
            bottom: groundH,
          },
        ]}
      >
        <View>{world.renderMidLayer({ width: LAYER_W, height: midH, color: biome.midColor })}</View>
        <View>{world.renderMidLayer({ width: LAYER_W, height: midH, color: biome.midColor })}</View>
      </Animated.View>

      {/* Sol */}
      <Animated.View
        style={[
          styles.groundLayer,
          {
            width: LAYER_W * 2,
            height: groundH,
            transform: [{ translateX: scrollAnim }],
            top: groundY,
          },
        ]}
      >
        <View>
          {world.renderGroundLayer({ width: LAYER_W, height: groundH, color: biome.groundColor })}
        </View>
        <View>
          {world.renderGroundLayer({ width: LAYER_W, height: groundH, color: biome.groundColor })}
        </View>
      </Animated.View>

      {/* Obstacol */}
      {obstacle && shapeNode && (
        <Animated.View
          style={{
            position: 'absolute',
            top: groundY - 120,
            left: 0,
            transform: [{ translateX: obstacleX }, { rotate: obstacleRotate }],
          }}
          pointerEvents="none"
        >
          {shapeNode.render({ width: 100, height: 120, color: biome.accent })}
        </Animated.View>
      )}

      {/* Pet */}
      <Animated.View
        style={{
          position: 'absolute',
          left: petLeft - petSize / 2,
          top: groundY - petSize * 0.92,
          width: petSize,
          height: petSize,
          transform: [{ translateY: petTranslateY }, { rotate: petTiltDeg }],
        }}
        pointerEvents="none"
      >
        {petImageUrl ? (
          <Image
            source={{ uri: petImageUrl }}
            style={{ width: petSize, height: petSize }}
            resizeMode="contain"
          />
        ) : (
          <View
            style={{
              width: petSize,
              height: petSize,
              backgroundColor: 'rgba(0,0,0,0.15)',
              borderRadius: petSize / 2,
            }}
          />
        )}
      </Animated.View>

      {/* Ambient — strat fata (praf, fluturi) */}
      {ambientFore.length > 0 && (
        <AmbientLayer entities={ambientFore} screenW={width} screenH={height} />
      )}
      </Animated.View>

      {/* Vignette — colturi mai inchise, look cinematic. Out of breath wrap. */}
      <Svg
        width={width}
        height={height}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient id="vignette" cx="50%" cy="50%" rx="70%" ry="70%">
            <Stop offset="0.6" stopColor="#000000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.35" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#vignette)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  cloudsLayer: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
  },
  midLayer: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
  },
  groundLayer: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
  },
});
