import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
import { DeviceMotion } from 'expo-sensors';
import * as THREE from 'three';
import { bearingDegrees, distanceMeters } from './geo';

type Props = {
  myCoords: { lat: number; lng: number };
  monsterCoords: { lat: number; lng: number };
  monsterColor: string;
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

export function ARMonster({ myCoords, monsterCoords, monsterColor }: Props) {
  const orientationRef = useRef({ alpha: 0, beta: 0, gamma: 0 });
  const rafRef = useRef<number | null>(null);

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

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate();
  };

  return (
    <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
  );
}
