// World pack pt darth-vader — galaxie intunecata cu asteroizi, statii stelare,
// lasere in fundal. Foloseste de registry doar daca PetSpecies.slug e
// "darth-vader" — altfel pet-ul vede DEFAULT_WORLD.

import Svg, { Circle, Polygon, Rect } from 'react-native-svg';
import { registerWorld } from './registry';
import { shade } from './util';
import type { WorldPack } from './types';

const PACK: WorldPack = {
  slug: 'darth-vader',
  name: 'Galaxia intunecata',
  biomes: [
    {
      key: 'deep-space',
      name: 'Spatiul adanc',
      skyColor: '#0A0E2A',
      midColor: '#1F1A3E',
      groundColor: '#100B26',
      accent: '#E74C3C',
      celestial: { shape: 'planet', color: '#8B4F8C', position: [0.72, 0.18], size: 110 },
    },
    {
      key: 'nebula',
      name: 'Nebuloasa stelara',
      skyColor: '#2A1240',
      midColor: '#3D1F5C',
      groundColor: '#1B0E2E',
      accent: '#9B59FF',
      celestial: { shape: 'moon', color: '#E8DFFF', position: [0.65, 0.12], size: 70 },
    },
  ],
  obstacles: [
    {
      key: 'asteroid',
      render: ({ width: W, height: H, color }) => {
        const dark = shade(color, -0.35);
        return (
          <Svg width={W} height={H}>
            <Polygon
              points={`${W * 0.5},${H * 0.05} ${W * 0.85},${H * 0.2} ${W * 0.95},${H * 0.55} ${W * 0.75},${H * 0.9} ${W * 0.35},${H * 0.95} ${W * 0.08},${H * 0.6} ${W * 0.12},${H * 0.25}`}
              fill={dark}
            />
            <Circle cx={W * 0.35} cy={H * 0.4} r={W * 0.08} fill={shade(color, -0.5)} />
            <Circle cx={W * 0.65} cy={H * 0.6} r={W * 0.05} fill={shade(color, -0.5)} />
          </Svg>
        );
      },
    },
    {
      key: 'satellite',
      render: ({ width: W, height: H, color }) => {
        const dark = shade(color, -0.35);
        return (
          <Svg width={W} height={H}>
            <Rect x={W * 0.35} y={H * 0.3} width={W * 0.3} height={H * 0.4} fill={dark} />
            <Rect x={W * 0.05} y={H * 0.45} width={W * 0.3} height={H * 0.1} fill={color} />
            <Rect x={W * 0.65} y={H * 0.45} width={W * 0.3} height={H * 0.1} fill={color} />
            <Circle cx={W * 0.5} cy={H * 0.5} r={W * 0.08} fill={shade(color, 0.3)} />
          </Svg>
        );
      },
    },
    {
      key: 'energybarrier',
      render: ({ width: W, height: H, color }) => (
        <Svg width={W} height={H}>
          <Rect x={W * 0.45} y={H * 0.1} width={W * 0.1} height={H * 0.9} fill={shade(color, -0.2)} />
          <Rect x={W * 0.3} y={H * 0.2} width={W * 0.4} height={H * 0.7} fill={color} opacity={0.55} />
          <Rect x={W * 0.35} y={H * 0.3} width={W * 0.3} height={H * 0.5} fill={color} opacity={0.85} />
        </Svg>
      ),
    },
  ],
  ambient: [
    // Stele care licaresc in fundal.
    {
      key: 'star',
      layer: 'back',
      density: 8,
      yRange: [0.05, 0.6],
      sizeRange: [2, 4],
      speedRange: [-15, -8],
      render: ({ size }) => (
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="#FFFFFF" opacity={0.9} />
        </Svg>
      ),
    },
    // Stele cazatoare ocazionale.
    {
      key: 'shooting-star',
      layer: 'mid',
      density: 0.5,
      yRange: [0.05, 0.4],
      sizeRange: [30, 50],
      speedRange: [-220, -160],
      render: ({ size }) => (
        <Svg width={size} height={size * 0.2}>
          <Polygon
            points={`0,${size * 0.1} ${size * 0.85},0 ${size},${size * 0.1} ${size * 0.85},${size * 0.2}`}
            fill="#FFE3A8"
            opacity={0.75}
          />
          <Circle cx={size * 0.92} cy={size * 0.1} r={size * 0.08} fill="#FFFFFF" />
        </Svg>
      ),
    },
    // "Praf cosmic" — particule mici care plutesc aproape.
    {
      key: 'cosmic-dust',
      layer: 'fore',
      density: 5,
      yRange: [0.5, 0.85],
      sizeRange: [3, 6],
      speedRange: [-90, -40],
      render: ({ size }) => (
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="#9B59FF" opacity={0.5} />
        </Svg>
      ),
    },
  ],
  // "Dealuri" = munti zdrentuiti pe o planeta moarta. Silueta seamless: incepe
  // si se termina la H*0.55 (back) si H*0.78 (front).
  renderMidLayer: ({ width: W, height: H, color }) => {
    const darker = shade(color, -0.2);
    const backTopY = H * 0.55;
    const frontTopY = H * 0.78;
    return (
      <Svg width={W} height={H} style={{ overflow: 'visible' }}>
        <Polygon
          points={[
            `0,${H}`,
            `0,${backTopY}`,
            `${W * 0.15},${H * 0.32}`,
            `${W * 0.3},${H * 0.5}`,
            `${W * 0.45},${H * 0.2}`,
            `${W * 0.58},${H * 0.45}`,
            `${W * 0.75},${H * 0.28}`,
            `${W * 0.88},${H * 0.48}`,
            `${W},${backTopY}`,
            `${W},${H}`,
          ].join(' ')}
          fill={darker}
        />
        <Polygon
          points={[
            `0,${H}`,
            `0,${frontTopY}`,
            `${W * 0.18},${H * 0.58}`,
            `${W * 0.35},${H * 0.72}`,
            `${W * 0.52},${H * 0.55}`,
            `${W * 0.7},${H * 0.7}`,
            `${W * 0.85},${H * 0.6}`,
            `${W},${frontTopY}`,
            `${W},${H}`,
          ].join(' ')}
          fill={color}
        />
      </Svg>
    );
  },
  renderGroundLayer: ({ width: W, height: H, color }) => {
    const lighter = shade(color, 0.15);
    const darker = shade(color, -0.3);
    return (
      <Svg width={W} height={H}>
        <Rect x={0} y={0} width={W} height={H} fill={color} />
        {/* Cratere pe pamantul lunar */}
        <Circle cx={W * 0.18} cy={H * 0.5} r={9} fill={darker} />
        <Circle cx={W * 0.18} cy={H * 0.45} r={6} fill={lighter} opacity={0.6} />
        <Circle cx={W * 0.42} cy={H * 0.7} r={6} fill={darker} />
        <Circle cx={W * 0.6} cy={H * 0.45} r={11} fill={darker} />
        <Circle cx={W * 0.6} cy={H * 0.4} r={7} fill={lighter} opacity={0.6} />
        <Circle cx={W * 0.82} cy={H * 0.65} r={5} fill={darker} />
      </Svg>
    );
  },
  // Back layer — galaxie spirala departe, foarte stilizat.
  renderBackLayer: ({ width: W, height: H }) => {
    return (
      <Svg width={W} height={H} style={{ overflow: 'visible' }}>
        {/* Silueta planeta gigant pe orizont */}
        <Polygon
          points={[
            `0,${H}`,
            `0,${H * 0.7}`,
            `${W * 0.15},${H * 0.5}`,
            `${W * 0.3},${H * 0.65}`,
            `${W * 0.45},${H * 0.55}`,
            `${W * 0.65},${H * 0.6}`,
            `${W * 0.85},${H * 0.45}`,
            `${W},${H * 0.7}`,
            `${W},${H}`,
          ].join(' ')}
          fill="#1A1230"
          opacity={0.7}
        />
      </Svg>
    );
  },
  // Cloud layer = nebuloasa stilizata.
  renderCloudsLayer: ({ width: W }) => {
    const H = 80;
    return (
      <Svg width={W} height={H}>
        <Circle cx={W * 0.2} cy={30} r={28} fill="#5B3D8C" opacity={0.35} />
        <Circle cx={W * 0.28} cy={42} r={20} fill="#7E4FC4" opacity={0.3} />
        <Circle cx={W * 0.55} cy={28} r={24} fill="#9B59FF" opacity={0.25} />
        <Circle cx={W * 0.62} cy={40} r={18} fill="#5B3D8C" opacity={0.35} />
        <Circle cx={W * 0.82} cy={32} r={22} fill="#7E4FC4" opacity={0.3} />
      </Svg>
    );
  },
};

registerWorld(PACK);
