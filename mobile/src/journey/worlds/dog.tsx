// Dog — parc urban familiar. Cer albastru, banci, hidranti, garduri, panza
// orasului in spate. Vibe: prietenos, jucaus, "dupa scoala".

import Svg, { Circle, Polygon, Rect } from 'react-native-svg';
import { registerWorld } from './registry';
import { shade } from './util';
import type { WorldPack } from './types';

const PACK: WorldPack = {
  slug: 'dog',
  name: 'Parcul orasului',
  biomes: [
    {
      key: 'noon',
      name: 'Dupa-amiaza in parc',
      skyColor: '#87CEEB',
      midColor: '#6B8B5A',
      groundColor: '#5A8A4A',
      accent: '#FF6B6B',
    },
    {
      key: 'evening',
      name: 'Apus in parc',
      skyColor: '#FFB07A',
      midColor: '#4A5A50',
      groundColor: '#4A6A3A',
      accent: '#FFD93D',
    },
  ],
  obstacles: [
    {
      key: 'hydrant',
      render: ({ width: W, height: H, color }) => {
        const dark = shade(color, -0.2);
        const cap = shade(color, -0.4);
        return (
          <Svg width={W} height={H}>
            <Rect x={W * 0.32} y={H * 0.25} width={W * 0.36} height={H * 0.7} fill={color} />
            <Rect x={W * 0.28} y={H * 0.2} width={W * 0.44} height={H * 0.1} fill={dark} />
            <Circle cx={W * 0.5} cy={H * 0.15} r={W * 0.12} fill={cap} />
            <Rect x={W * 0.15} y={H * 0.45} width={W * 0.17} height={H * 0.12} fill={dark} />
            <Rect x={W * 0.68} y={H * 0.45} width={W * 0.17} height={H * 0.12} fill={dark} />
            <Circle cx={W * 0.5} cy={H * 0.5} r={W * 0.05} fill={dark} />
          </Svg>
        );
      },
    },
    {
      key: 'bench',
      render: ({ width: W, height: H, color }) => {
        const wood = '#8B6B4A';
        const metal = shade(color, -0.4);
        return (
          <Svg width={W} height={H}>
            <Rect x={W * 0.1} y={H * 0.55} width={W * 0.8} height={H * 0.08} fill={wood} />
            <Rect x={W * 0.1} y={H * 0.7} width={W * 0.8} height={H * 0.08} fill={wood} />
            <Rect x={W * 0.1} y={H * 0.85} width={W * 0.8} height={H * 0.08} fill={wood} />
            <Rect x={W * 0.15} y={H * 0.55} width={W * 0.06} height={H * 0.45} fill={metal} />
            <Rect x={W * 0.79} y={H * 0.55} width={W * 0.06} height={H * 0.45} fill={metal} />
          </Svg>
        );
      },
    },
    {
      key: 'fence',
      render: ({ width: W, height: H }) => {
        const wood = '#A88A60';
        const dark = shade(wood, -0.25);
        return (
          <Svg width={W} height={H}>
            <Rect x={W * 0.05} y={H * 0.55} width={W * 0.9} height={H * 0.04} fill={wood} />
            <Rect x={W * 0.05} y={H * 0.75} width={W * 0.9} height={H * 0.04} fill={wood} />
            <Polygon points={`${W * 0.1},${H * 0.4} ${W * 0.18},${H * 0.32} ${W * 0.26},${H * 0.4} ${W * 0.26},${H * 0.95} ${W * 0.1},${H * 0.95}`} fill={dark} />
            <Polygon points={`${W * 0.3},${H * 0.4} ${W * 0.38},${H * 0.32} ${W * 0.46},${H * 0.4} ${W * 0.46},${H * 0.95} ${W * 0.3},${H * 0.95}`} fill={dark} />
            <Polygon points={`${W * 0.5},${H * 0.4} ${W * 0.58},${H * 0.32} ${W * 0.66},${H * 0.4} ${W * 0.66},${H * 0.95} ${W * 0.5},${H * 0.95}`} fill={dark} />
            <Polygon points={`${W * 0.7},${H * 0.4} ${W * 0.78},${H * 0.32} ${W * 0.86},${H * 0.4} ${W * 0.86},${H * 0.95} ${W * 0.7},${H * 0.95}`} fill={dark} />
          </Svg>
        );
      },
    },
    {
      key: 'trashbin',
      render: ({ width: W, height: H }) => {
        const metal = '#5A6B6F';
        const dark = shade(metal, -0.25);
        return (
          <Svg width={W} height={H}>
            <Polygon
              points={`${W * 0.25},${H * 0.2} ${W * 0.75},${H * 0.2} ${W * 0.8},${H * 0.95} ${W * 0.2},${H * 0.95}`}
              fill={metal}
            />
            <Rect x={W * 0.2} y={H * 0.15} width={W * 0.6} height={H * 0.08} fill={dark} />
            <Rect x={W * 0.3} y={H * 0.35} width={W * 0.04} height={H * 0.5} fill={dark} opacity={0.5} />
            <Rect x={W * 0.5} y={H * 0.35} width={W * 0.04} height={H * 0.5} fill={dark} opacity={0.5} />
            <Rect x={W * 0.7} y={H * 0.35} width={W * 0.04} height={H * 0.5} fill={dark} opacity={0.5} />
          </Svg>
        );
      },
    },
  ],
  ambient: [
    // Pasari care zboara peste oras.
    {
      key: 'bird',
      layer: 'back',
      density: 2,
      yRange: [0.12, 0.3],
      sizeRange: [12, 20],
      speedRange: [-55, -28],
      render: ({ size }) => (
        <Svg width={size} height={size * 0.4}>
          <Polygon
            points={`0,${size * 0.3} ${size * 0.25},${size * 0.1} ${size * 0.5},${size * 0.25} ${size * 0.75},${size * 0.1} ${size},${size * 0.3}`}
            fill="rgba(45, 42, 74, 0.65)"
          />
        </Svg>
      ),
    },
    // Frunze galbene cazand.
    {
      key: 'leaf',
      layer: 'fore',
      density: 3,
      yRange: [0.45, 0.7],
      sizeRange: [10, 16],
      speedRange: [-65, -35],
      render: ({ size }) => (
        <Svg width={size} height={size}>
          <Polygon
            points={`${size * 0.5},0 ${size * 0.85},${size * 0.4} ${size * 0.5},${size} ${size * 0.15},${size * 0.4}`}
            fill="#E8A848"
            opacity={0.9}
          />
        </Svg>
      ),
    },
    // Mingi/baloane care zboara — element de joaca.
    {
      key: 'ball',
      layer: 'mid',
      density: 1,
      yRange: [0.3, 0.55],
      sizeRange: [14, 22],
      speedRange: [-90, -50],
      render: ({ size }) => (
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="#FF6B6B" opacity={0.9} />
          <Circle cx={size * 0.35} cy={size * 0.35} r={size * 0.18} fill="rgba(255,255,255,0.5)" />
        </Svg>
      ),
    },
  ],
  // Mid layer = silueta oras + copaci de parc in fata.
  renderMidLayer: ({ width: W, height: H, color }) => {
    const buildings = shade(color, -0.35);
    const window_glow = '#FFE3A8';
    const backTopY = H * 0.45;
    const frontTopY = H * 0.78;
    return (
      <Svg width={W} height={H} style={{ overflow: 'visible' }}>
        {/* Silueta oras in spate — incepe/termina la backTopY */}
        <Polygon
          points={[
            `0,${H}`,
            `0,${backTopY}`,
            `${W * 0.08},${backTopY}`,
            `${W * 0.08},${H * 0.3}`,
            `${W * 0.18},${H * 0.3}`,
            `${W * 0.18},${H * 0.2}`,
            `${W * 0.25},${H * 0.2}`,
            `${W * 0.25},${H * 0.35}`,
            `${W * 0.4},${H * 0.35}`,
            `${W * 0.4},${H * 0.15}`,
            `${W * 0.5},${H * 0.15}`,
            `${W * 0.5},${H * 0.35}`,
            `${W * 0.62},${H * 0.35}`,
            `${W * 0.62},${H * 0.25}`,
            `${W * 0.72},${H * 0.25}`,
            `${W * 0.72},${H * 0.3}`,
            `${W * 0.85},${H * 0.3}`,
            `${W * 0.85},${backTopY}`,
            `${W},${backTopY}`,
            `${W},${H}`,
          ].join(' ')}
          fill={buildings}
        />
        {/* Geamuri luminate */}
        <Rect x={W * 0.1} y={H * 0.32} width={3} height={3} fill={window_glow} />
        <Rect x={W * 0.14} y={H * 0.36} width={3} height={3} fill={window_glow} />
        <Rect x={W * 0.42} y={H * 0.18} width={3} height={3} fill={window_glow} />
        <Rect x={W * 0.46} y={H * 0.22} width={3} height={3} fill={window_glow} />
        <Rect x={W * 0.65} y={H * 0.28} width={3} height={3} fill={window_glow} />
        {/* Iarba parc in fata */}
        <Polygon
          points={[
            `0,${H}`,
            `0,${frontTopY}`,
            `${W * 0.3},${H * 0.62}`,
            `${W * 0.55},${H * 0.72}`,
            `${W * 0.8},${H * 0.62}`,
            `${W},${frontTopY}`,
            `${W},${H}`,
          ].join(' ')}
          fill={color}
        />
      </Svg>
    );
  },
  renderGroundLayer: ({ width: W, height: H, color }) => {
    const path = '#B8A878';
    const flower = '#FFC9D9';
    return (
      <Svg width={W} height={H}>
        <Rect x={0} y={0} width={W} height={H} fill={color} />
        {/* Cararea de parc */}
        <Rect x={0} y={H * 0.45} width={W} height={H * 0.18} fill={path} opacity={0.7} />
        {/* Florile */}
        <Circle cx={W * 0.18} cy={H * 0.75} r={3} fill={flower} />
        <Circle cx={W * 0.42} cy={H * 0.78} r={3} fill={flower} />
        <Circle cx={W * 0.6} cy={H * 0.75} r={3} fill={flower} />
        <Circle cx={W * 0.78} cy={H * 0.8} r={3} fill={flower} />
      </Svg>
    );
  },
  renderCloudsLayer: ({ width: W }) => {
    const H = 70;
    return (
      <Svg width={W} height={H}>
        <Circle cx={W * 0.2} cy={26} r={22} fill="rgba(255,255,255,0.8)" />
        <Circle cx={W * 0.3} cy={36} r={18} fill="rgba(255,255,255,0.8)" />
        <Circle cx={W * 0.55} cy={22} r={20} fill="rgba(255,255,255,0.75)" />
        <Circle cx={W * 0.64} cy={32} r={24} fill="rgba(255,255,255,0.75)" />
        <Circle cx={W * 0.82} cy={28} r={20} fill="rgba(255,255,255,0.8)" />
      </Svg>
    );
  },
};

registerWorld(PACK);
