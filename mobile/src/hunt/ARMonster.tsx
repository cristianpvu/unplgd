import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
// import direct din build/Renderer: barrel-ul expo-three trage loaders
// (AssimpLoader etc.) care nu mai există în three >= 0.166 și pică bundle-ul de release
import Renderer from 'expo-three/build/Renderer';
import { DeviceMotion } from 'expo-sensors';
import * as THREE from 'three';
import { bearingDegrees, distanceMeters } from './geo';

type Props = {
  myCoords: { lat: number; lng: number };
  monsterCoords: { lat: number; lng: number };
  monsterColor: string;
  bubbleText?: string | null;
};

// AR ancorat pe busola+GPS: monstrul are pozitie fixa in lume calculata din
// bearing + distanta GPS. Cand misti telefonul, camera (PerspectiveCamera din
// Three.js) se roteste dupa orientarea reala a device-ului — monstrul "ramane"
// la pozitia lui in spatiu. Nu folosim modele GLB pe RN (Blob nu suporta
// ArrayBuffer pt texturi embedded). Construim monstrul procedural din
// primitive: corp egg-shape + 2 ochi cartoon care urmaresc camera + corniculete
// + halo pe sol. Arata clar a creatura, nu a sfera.
const PHONE_HEIGHT_M = 1.5;
const RENDER_DIST_CAP_M = 6;
const RENDER_DIST_MIN_M = 2;

export function ARMonster({ myCoords, monsterCoords, monsterColor, bubbleText }: Props) {
  const orientationRef = useRef({ alpha: 0, beta: 0, gamma: 0 });
  const rafRef = useRef<number | null>(null);
  const { width: screenW, height: screenH } = useWindowDimensions();
  // Pozitia bula pe ecran — scrisa la 60fps in ref din loop-ul de randare,
  // citita la 20Hz in setState ca sa nu spamam React. Suficient de smooth
  // pentru o bula care urmareste un object aproape stationar.
  const bubblePosRef = useRef<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });
  const arrowPosRef = useRef<{ x: number; y: number; angle: number; visible: boolean }>({
    x: 0,
    y: 0,
    angle: 0,
    visible: false,
  });
  const [bubble, setBubble] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });
  const [arrow, setArrow] = useState<{ x: number; y: number; angle: number; visible: boolean }>({
    x: 0,
    y: 0,
    angle: 0,
    visible: false,
  });

  useEffect(() => {
    const id = setInterval(() => {
      const b = bubblePosRef.current;
      setBubble((prev) =>
        prev.x === b.x && prev.y === b.y && prev.visible === b.visible
          ? prev
          : { ...b },
      );
      const a = arrowPosRef.current;
      setArrow((prev) =>
        prev.x === a.x &&
        prev.y === a.y &&
        prev.angle === a.angle &&
        prev.visible === a.visible
          ? prev
          : { ...a },
      );
    }, 50);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    (async () => {
      const perm = await DeviceMotion.requestPermissionsAsync();
      if (!perm.granted) return;
      DeviceMotion.setUpdateInterval(33);
      sub = DeviceMotion.addListener((data) => {
        if (data.rotation) {
          orientationRef.current = {
            alpha: data.rotation.alpha,
            beta: data.rotation.beta,
            gamma: data.rotation.gamma,
          };
        }
      });
    })();
    return () => {
      sub?.remove();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    const renderer = new Renderer({ gl, alpha: true });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      65,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.05,
      500,
    );
    camera.position.set(0, 0, 0);

    const colorObj = new THREE.Color(monsterColor);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 0.95);
    sun.position.set(2, 6, 3);
    scene.add(sun);
    const rim = new THREE.PointLight(colorObj, 1.4, 8, 2);
    rim.position.set(0, 1, 2);
    scene.add(rim);

    // Pozitia monstrului in scena pe baza GPS bearing + distanta.
    const realDist = distanceMeters(myCoords, monsterCoords);
    const renderDist = Math.max(
      RENDER_DIST_MIN_M,
      Math.min(realDist || RENDER_DIST_MIN_M, RENDER_DIST_CAP_M),
    );
    const bearing = bearingDegrees(myCoords, monsterCoords);
    const bearingRad = (bearing * Math.PI) / 180;
    const monsterX = Math.sin(bearingRad) * renderDist;
    const monsterZ = -Math.cos(bearingRad) * renderDist;

    const monsterGroup = new THREE.Group();
    const groundY = -PHONE_HEIGHT_M + 0.4;
    monsterGroup.position.set(monsterX, groundY, monsterZ);
    scene.add(monsterGroup);

    // Corp: icosahedron alungit pe Y (egg/blob-shape).
    const bodyGeo = new THREE.IcosahedronGeometry(0.4, 2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: colorObj,
      emissive: colorObj.clone().multiplyScalar(0.3),
      flatShading: true,
      roughness: 0.5,
      metalness: 0.1,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.scale.set(1.0, 1.25, 1.0);
    monsterGroup.add(body);

    // Ochii — sclera alba + pupila neagra. Pe fata corpului (+Z).
    const scleraGeo = new THREE.SphereGeometry(0.13, 16, 16);
    const scleraMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x111111,
      roughness: 0.3,
    });
    const pupilGeo = new THREE.SphereGeometry(0.07, 12, 12);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0a0a14 });

    const leftEye = new THREE.Mesh(scleraGeo, scleraMat);
    leftEye.position.set(-0.16, 0.12, 0.32);
    const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    leftPupil.position.set(0, 0, 0.08);
    leftEye.add(leftPupil);
    monsterGroup.add(leftEye);

    const rightEye = new THREE.Mesh(scleraGeo, scleraMat);
    rightEye.position.set(0.16, 0.12, 0.32);
    const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    rightPupil.position.set(0, 0, 0.08);
    rightEye.add(rightPupil);
    monsterGroup.add(rightEye);

    // Doua corniculete cone in spate.
    const hornGeo = new THREE.ConeGeometry(0.06, 0.18, 8);
    const hornMat = new THREE.MeshStandardMaterial({
      color: colorObj.clone().multiplyScalar(0.6),
      flatShading: true,
      roughness: 0.6,
    });
    const leftHorn = new THREE.Mesh(hornGeo, hornMat);
    leftHorn.position.set(-0.18, 0.42, -0.05);
    leftHorn.rotation.z = -0.3;
    monsterGroup.add(leftHorn);
    const rightHorn = new THREE.Mesh(hornGeo, hornMat);
    rightHorn.position.set(0.18, 0.42, -0.05);
    rightHorn.rotation.z = 0.3;
    monsterGroup.add(rightHorn);

    // Halo + aura pe sol — anchor visual.
    const haloGeo = new THREE.TorusGeometry(0.65, 0.03, 8, 48);
    const haloMat = new THREE.MeshBasicMaterial({
      color: colorObj,
      transparent: true,
      opacity: 0.7,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = -0.45;
    monsterGroup.add(halo);

    const halo2Geo = new THREE.TorusGeometry(0.95, 0.02, 8, 48);
    const halo2Mat = new THREE.MeshBasicMaterial({
      color: colorObj,
      transparent: true,
      opacity: 0.4,
    });
    const halo2 = new THREE.Mesh(halo2Geo, halo2Mat);
    halo2.rotation.x = Math.PI / 2;
    halo2.position.y = -0.45;
    monsterGroup.add(halo2);

    // q1 = -90deg around X — face camera sa "iasa" prin spatele telefonului.
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
    const euler = new THREE.Euler();
    const bubbleAnchor = new THREE.Vector3();
    const camSpace = new THREE.Vector3();

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const t = Date.now();

      // Breathing: scale Y oscileaza intre 1.20 si 1.30.
      body.scale.y = 1.25 + Math.sin(t / 600) * 0.05;
      // Float subtle pe intregul grup.
      monsterGroup.position.y = groundY + Math.sin(t / 700) * 0.06;
      halo.rotation.z += 0.005;
      halo2.rotation.z -= 0.003;

      // Orientare camera din senzori.
      const { alpha, beta, gamma } = orientationRef.current;
      euler.set(beta, alpha, -gamma, 'YXZ');
      camera.quaternion.setFromEuler(euler).multiply(q1);

      // Monstrul intoarce fata catre user — atan2 pe diferenta XZ. Asa ochii
      // sunt mereu vizibili cand te uiti la el din lateral.
      const dx = camera.position.x - monsterGroup.position.x;
      const dz = camera.position.z - monsterGroup.position.z;
      monsterGroup.rotation.y = Math.atan2(dx, dz);

      // Proiectie pozitie deasupra capului. Pentru bula folosim NDC (Normalized
      // Device Coords) dupa project(). Pentru directia sagetii, daca monstrul
      // e in afara cadrului, folosim camera-space ca sa stim sigur in ce parte
      // sa intoarca user-ul telefonul (chiar si cand e in spate).
      bubbleAnchor.set(
        monsterGroup.position.x,
        monsterGroup.position.y + 1.0,
        monsterGroup.position.z,
      );
      camSpace.copy(bubbleAnchor).applyMatrix4(camera.matrixWorldInverse);
      const inFront = camSpace.z < 0; // Three.js camera priveste catre -Z
      bubbleAnchor.project(camera);
      const onScreen =
        inFront &&
        bubbleAnchor.x > -1 &&
        bubbleAnchor.x < 1 &&
        bubbleAnchor.y > -1 &&
        bubbleAnchor.y < 1;

      if (onScreen) {
        bubblePosRef.current = {
          x: (bubbleAnchor.x * 0.5 + 0.5) * screenW,
          y: (-bubbleAnchor.y * 0.5 + 0.5) * screenH,
          visible: true,
        };
        arrowPosRef.current = { ...arrowPosRef.current, visible: false };
      } else {
        // Calculam directia: in fata folosim NDC, in spate folosim camera-space
        // (NDC inverteaza semnele cand punctul e in spate).
        let dx: number;
        let dy: number;
        if (inFront) {
          dx = bubbleAnchor.x;
          dy = -bubbleAnchor.y;
        } else {
          dx = camSpace.x;
          dy = -camSpace.y;
          if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
            dx = 1; // direct in spate fix — default catre dreapta
          }
        }
        const angle = Math.atan2(dy, dx);
        // Punem sageata pe marginea ecranului (clamped la rectangle cu marja).
        const margin = 70;
        const halfW = screenW / 2 - margin;
        const halfH = screenH / 2 - margin;
        const ax = Math.cos(angle);
        const ay = Math.sin(angle);
        const tx = ax !== 0 ? halfW / Math.abs(ax) : Infinity;
        const ty = ay !== 0 ? halfH / Math.abs(ay) : Infinity;
        const t = Math.min(tx, ty);
        arrowPosRef.current = {
          x: screenW / 2 + ax * t,
          y: screenH / 2 + ay * t,
          angle,
          visible: true,
        };
        bubblePosRef.current = { ...bubblePosRef.current, visible: false };
      }

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate();
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      {bubbleText && bubble.visible && (
        <View
          style={[
            styles.bubble,
            {
              left: bubble.x - BUBBLE_W / 2,
              top: bubble.y - BUBBLE_OFFSET_Y,
            },
          ]}
        >
          <Text style={styles.bubbleText}>{bubbleText}</Text>
          <View style={styles.bubbleTail} />
        </View>
      )}
      {bubbleText && arrow.visible && (
        <View
          style={[
            styles.arrowWrap,
            {
              left: arrow.x - ARROW_BOX / 2,
              top: arrow.y - ARROW_BOX / 2,
              transform: [{ rotate: `${arrow.angle}rad` }],
            },
          ]}
        >
          <View style={[styles.arrowTriangle, { borderLeftColor: monsterColor }]} />
        </View>
      )}
    </View>
  );
}

const BUBBLE_W = 240;
const BUBBLE_OFFSET_Y = 110;
const ARROW_BOX = 56;
const ARROW_TIP = 26; // dimensiunea triunghiului

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: BUBBLE_W,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    alignItems: 'center',
  },
  bubbleText: {
    color: '#1a1a24',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 20,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -12,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.96)',
  },
  // Wrapper-ul are dimensiune patrata fixa ca rotirea sa pivoteze pe centru.
  // Triunghiul ia 0 width/height + border-uri colorate (CSS triangle pattern).
  // Default: tip catre dreapta — angle=0 inseamna sageata catre est, urmeaza
  // unghiul calculat in animate.
  arrowWrap: {
    position: 'absolute',
    width: ARROW_BOX,
    height: ARROW_BOX,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  arrowTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: ARROW_TIP / 2,
    borderBottomWidth: ARROW_TIP / 2,
    borderLeftWidth: ARROW_TIP,
    borderRightWidth: 0,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    // borderLeftColor injectat per-instance (= culoarea monstrului)
    borderRightColor: 'transparent',
  },
});
