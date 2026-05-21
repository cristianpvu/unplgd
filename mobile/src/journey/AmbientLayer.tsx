// Strat de entitati ambient — pasari, stele, fluturi, praf cosmic. Fiecare
// `AmbientEntity` din WorldPack genereaza `density` instante care plutesc prin
// scena (de la dreapta la stanga sau invers, dupa semnul speed-ului) si la
// finalul trecerii se respawn-uiesc cu noi y/marime/viteza.
//
// Folosim Animated.Value pe translateX (useNativeDriver) — fara setState in
// loop, deci totul ruleaza pe UI thread.

import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import type { AmbientEntity } from './worlds/types';

type Props = {
  entities: AmbientEntity[];
  screenW: number;
  screenH: number;
};

export function AmbientLayer({ entities, screenW, screenH }: Props) {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {entities.map((entity) =>
        // O instanta per "slot" — density rotunjit in jos.
        Array.from({ length: Math.max(1, Math.round(entity.density)) }).map((_, i) => (
          <AmbientEntityInstance
            key={`${entity.key}-${i}`}
            entity={entity}
            screenW={screenW}
            screenH={screenH}
            // Stagger pornirea pe slot ca sa nu intre toate odata.
            staggerMs={i * (3000 / Math.max(1, entity.density))}
          />
        )),
      )}
    </View>
  );
}

function AmbientEntityInstance({
  entity,
  screenW,
  screenH,
  staggerMs,
}: {
  entity: AmbientEntity;
  screenW: number;
  screenH: number;
  staggerMs: number;
}) {
  const x = useRef(new Animated.Value(-9999)).current;
  const y = useRef(new Animated.Value(0)).current;
  // Marimea variaza la fiecare respawn — o tinem in ref si fortam o
  // re-render minora schimband nodul render. In practica, schimbam o cheie.
  const sizeRef = useRef(
    entity.sizeRange[0] + Math.random() * (entity.sizeRange[1] - entity.sizeRange[0]),
  );

  useEffect(() => {
    let cancelled = false;

    const spawn = () => {
      if (cancelled) return;
      const speed =
        entity.speedRange[0] + Math.random() * (entity.speedRange[1] - entity.speedRange[0]);
      const goingLeft = speed < 0;
      // Bordurile cu 80px buffer ca elementele mari sa nu apara/dispara brusc.
      const startX = goingLeft ? screenW + 80 : -80;
      const endX = goingLeft ? -80 : screenW + 80;
      const newY =
        entity.yRange[0] + Math.random() * (entity.yRange[1] - entity.yRange[0]);
      const newSize =
        entity.sizeRange[0] + Math.random() * (entity.sizeRange[1] - entity.sizeRange[0]);
      sizeRef.current = newSize;
      const distance = Math.abs(endX - startX);
      const duration = (distance / Math.abs(speed)) * 1000;

      y.setValue(newY * screenH);
      x.setValue(startX);

      Animated.timing(x, {
        toValue: endX,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !cancelled) {
          // Mic respite ca sa fie distantate in timp.
          setTimeout(spawn, Math.random() * 2500);
        }
      });
    };

    // Stagger initial — fiecare slot porneste cu un mic decalaj.
    const timer = setTimeout(spawn, staggerMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      x.stopAnimation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenW, screenH]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        transform: [{ translateX: x }, { translateY: y }],
      }}
      pointerEvents="none"
    >
      {entity.render({ size: sizeRef.current })}
    </Animated.View>
  );
}
