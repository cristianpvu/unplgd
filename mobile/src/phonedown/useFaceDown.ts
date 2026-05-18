import { useEffect, useRef, useState } from 'react';
import { DeviceMotion, type DeviceMotionMeasurement } from 'expo-sensors';
import {
  FACE_DOWN_HOLD_MS,
  FACE_DOWN_Z_RELEASE,
  FACE_DOWN_Z_THRESHOLD,
  SENSOR_INTERVAL_MS,
} from './constants';

// Detecteaza daca telefonul e cu fata in jos (ecran spre masa), folosind
// DeviceMotion.gravity (componenta gravitationala separata de acceleratia
// utilizatorului — mai stabila decat accelerometrul brut).
//
// Logica: daca gravity.z e foarte negativ (telefonul intors invers), pornim
// un timer; daca persista FACE_DOWN_HOLD_MS continuu, intram in "faceDown".
// Iesirea e instant cand z trece peste FACE_DOWN_Z_RELEASE (histeresis).

export function useFaceDown(enabled: boolean): boolean {
  const [faceDown, setFaceDown] = useState(false);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subRef = useRef<{ remove(): void } | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Cleanup la dezactivare — eliberam subscription-ul.
      subRef.current?.remove();
      subRef.current = null;
      if (enterTimer.current) {
        clearTimeout(enterTimer.current);
        enterTimer.current = null;
      }
      setFaceDown(false);
      return;
    }

    let cancelled = false;
    (async () => {
      const ok = await DeviceMotion.isAvailableAsync();
      if (!ok || cancelled) return;
      DeviceMotion.setUpdateInterval(SENSOR_INTERVAL_MS);
      const sub = DeviceMotion.addListener(handle);
      subRef.current = sub;
    })();

    function handle(m: DeviceMotionMeasurement) {
      // expo-sensors raporteaza gravity in m/s². Pe iOS si Android semnele
      // sunt unificate de RN: face-up = +z, face-down = -z.
      const z = m.accelerationIncludingGravity?.z ?? m.acceleration?.z ?? 0;
      if (z <= FACE_DOWN_Z_THRESHOLD) {
        if (!enterTimer.current) {
          enterTimer.current = setTimeout(() => {
            enterTimer.current = null;
            setFaceDown(true);
          }, FACE_DOWN_HOLD_MS);
        }
      } else if (z >= FACE_DOWN_Z_RELEASE) {
        if (enterTimer.current) {
          clearTimeout(enterTimer.current);
          enterTimer.current = null;
        }
        setFaceDown((prev) => (prev ? false : prev));
      }
    }

    return () => {
      cancelled = true;
      subRef.current?.remove();
      subRef.current = null;
      if (enterTimer.current) {
        clearTimeout(enterTimer.current);
        enterTimer.current = null;
      }
    };
  }, [enabled]);

  return faceDown;
}
