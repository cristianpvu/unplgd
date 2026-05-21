// Groot — padure alien luxurianta cu bioluminescenta. Copaci uriasi, plante
// stralucitoare, spori care plutesc. Vibe: verde adanc, magic, viu.

import Svg, { Circle, Polygon, Rect } from 'react-native-svg';
import { registerWorld } from './registry';
import { shade } from './util';
import type { WorldPack } from './types';

const PACK: WorldPack = {
  slug: 'groot',
  name: 'Padurea bioluminescenta',
  biomes: [
    {
      key: 'day',
      name: 'Padurea adanca',
      skyColor: '#87C9C5',
      midColor: '#4A8C3A',
      groundColor: '#2E5C28',
      accent: '#FF6B9D',
    },
    {
      key: 'night',
      name: 'Padurea stralucitoare',
      skyColor: '#1A2D3D',
      midColor: '#2E5A4A',
      groundColor: '#1F3025',
      accent: '#9BFFB8',
    },
  ],
  obstacles: [
    {
      key: 'giant_root',
      render: ({ width: W, height: H }) => {
        const wood = '#6B4A2A';
        const dark = shade(wood, -0.2);
        return (
          <Svg width={W} height={H}>
            <Polygon
              points={`${W * 0.05},${H} ${W * 0.1},${H * 0.6} ${W * 0.35},${H * 0.3} ${W * 0.65},${H * 0.3} ${W * 0.9},${H * 0.6} ${W * 0.95},${H}`}
              fill={wood}
            />
            <Polygon
              points={`${W * 0.25},${H * 0.95} ${W * 0.3},${H * 0.55} ${W * 0.5},${H * 0.4} ${W * 0.7},${H * 0.55} ${W * 0.75},${H * 0.95}`}
              fill={dark}
              opacity={0.6}
            />
            <Circle cx={W * 0.5} cy={H * 0.45} r={W * 0.06} fill="#1F3025" />
          </Svg>
        );
      },
    },
    {
      key: 'mushroom',
      render: ({ width: W, height: H, color }) => {
        const stem = '#E8DCC5';
        const bright = shade(color, 0.3);
        return (
          <Svg width={W} height={H}>
            <Rect x={W * 0.4} y={H * 0.4} width={W * 0.2} height={H * 0.6} fill={stem} />
            <Polygon
              points={`${W * 0.1},${H * 0.5} ${W * 0.5},${H * 0.05} ${W * 0.9},${H * 0.5} ${W * 0.7},${H * 0.5} ${W * 0.3},${H * 0.5}`}
              fill={color}
            />
            <Circle cx={W * 0.35} cy={H * 0.3} r={W * 0.06} fill={bright} />
            <Circle cx={W * 0.55} cy={H * 0.25} r={W * 0.05} fill={bright} />
            <Circle cx={W * 0.7} cy={H * 0.35} r={W * 0.05} fill={bright} />
          </Svg>
        );
      },
    },
    {
      key: 'vine',
      render: ({ width: W, height: H, color }) => {
        const dark = shade(color, -0.3);
        return (
          <Svg width={W} height={H}>
            <Polygon
              points={`${W * 0.5},${H * 0.05} ${W * 0.6},${H * 0.05} ${W * 0.4},${H * 0.3} ${W * 0.55},${H * 0.5} ${W * 0.35},${H * 0.7} ${W * 0.5},${H * 0.9} ${W * 0.4},${H * 0.9} ${W * 0.3},${H * 0.7} ${W * 0.45},${H * 0.5} ${W * 0.3},${H * 0.3}`}
              fill={dark}
            />
            <Circle cx={W * 0.4} cy={H * 0.3} r={W * 0.07} fill={color} />
            <Circle cx={W * 0.55} cy={H * 0.5} r={W * 0.08} fill={color} />
            <Circle cx={W * 0.35} cy={H * 0.7} r={W * 0.07} fill={color} />
          </Svg>
        );
      },
    },
    {
      key: 'bloom',
      render: ({ width: W, height: H, color }) => {
        const bright = shade(color, 0.3);
        const stem = '#3A6B2A';
        return (
          <Svg width={W} height={H}>
            <Rect x={W * 0.46} y={H * 0.5} width={W * 0.08} height={H * 0.5} fill={stem} />
            <Circle cx={W * 0.5} cy={H * 0.4} r={W * 0.25} fill={color} />
            <Circle cx={W * 0.3} cy={H * 0.35} r={W * 0.18} fill={color} />
            <Circle cx={W * 0.7} cy={H * 0.35} r={W * 0.18} fill={color} />
            <Circle cx={W * 0.35} cy={H * 0.55} r={W * 0.18} fill={color} />
            <Circle cx={W * 0.65} cy={H * 0.55} r={W * 0.18} fill={color} />
            <Circle cx={W * 0.5} cy={H * 0.42} r={W * 0.1} fill={bright} />
          </Svg>
        );
      },
    },
  ],
  ambient: [
    // Spori care plutesc lent prin aer.
    {
      key: 'spore',
      layer: 'back',
      density: 6,
      yRange: [0.15, 0.5],
      sizeRange: [4, 8],
      speedRange: [-25, -10],
      render: ({ size }) => (
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="#FFFFFF" opacity={0.5} />
          <Circle cx={size / 2} cy={size / 2} r={size / 3} fill="#CFFFCF" opacity={0.7} />
        </Svg>
      ),
    },
    // Licurici verzi-albastrii.
    {
      key: 'firefly',
      layer: 'mid',
      density: 5,
      yRange: [0.4, 0.7],
      sizeRange: [4, 7],
      speedRange: [-45, -20],
      render: ({ size }) => (
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="#9BFFB8" opacity={0.9} />
          <Circle cx={size / 2} cy={size / 2} r={size / 4} fill="#FFFFFF" />
        </Svg>
      ),
    },
    // Fluturi mari bioluminescenti.
    {
      key: 'butterfly',
      layer: 'fore',
      density: 2,
      yRange: [0.5, 0.7],
      sizeRange: [16, 24],
      speedRange: [-65, -35],
      render: ({ size }) => (
        <Svg width={size} height={size}>
          <Circle cx={size * 0.3} cy={size * 0.45} r={size * 0.25} fill="#FF6BC9" opacity={0.85} />
          <Circle cx={size * 0.7} cy={size * 0.45} r={size * 0.25} fill="#9BFFC9" opacity={0.85} />
          <Rect x={size * 0.47} y={size * 0.3} width={size * 0.06} height={size * 0.5} fill="#3A2A4A" />
          <Circle cx={size * 0.3} cy={size * 0.45} r={size * 0.08} fill="#FFFFFF" opacity={0.7} />
          <Circle cx={size * 0.7} cy={size * 0.45} r={size * 0.08} fill="#FFFFFF" opacity={0.7} />
        </Svg>
      ),
    },
  ],
  // Mid layer = copaci alien uriasi cu trunchiuri groase.
  renderMidLayer: ({ width: W, height: H, color }) => {
    const darker = shade(color, -0.2);
    const trunk = '#5C3A2A';
    const backTopY = H * 0.45;
    const frontTopY = H * 0.7;
    return (
      <Svg width={W} height={H} style={{ overflow: 'visible' }}>
        {/* Copaci uriasi in spate */}
        <Polygon
          points={[
            `0,${H}`,
            `0,${backTopY}`,
            `${W * 0.15},${H * 0.2}`,
            `${W * 0.3},${H * 0.35}`,
            `${W * 0.5},${H * 0.15}`,
            `${W * 0.7},${H * 0.4}`,
            `${W * 0.85},${H * 0.25}`,
            `${W},${backTopY}`,
            `${W},${H}`,
          ].join(' ')}
          fill={darker}
        />
        {/* Trunchiuri masive */}
        <Rect x={W * 0.18} y={H * 0.3} width={W * 0.06} height={H * 0.5} fill={trunk} opacity={0.7} />
        <Rect x={W * 0.55} y={H * 0.25} width={W * 0.08} height={H * 0.55} fill={trunk} opacity={0.7} />
        {/* Frunzis in fata */}
        <Polygon
          points={[
            `0,${H}`,
            `0,${frontTopY}`,
            `${W * 0.2},${H * 0.5}`,
            `${W * 0.45},${H * 0.62}`,
            `${W * 0.7},${H * 0.52}`,
            `${W * 0.88},${H * 0.6}`,
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
    const glow = '#9BFFB8';
    return (
      <Svg width={W} height={H}>
        <Rect x={0} y={0} width={W} height={H} fill={color} />
        {/* Plante stralucitoare */}
        <Circle cx={W * 0.16} cy={H * 0.5} r={5} fill={glow} opacity={0.7} />
        <Circle cx={W * 0.36} cy={H * 0.65} r={4} fill={glow} opacity={0.7} />
        <Circle cx={W * 0.56} cy={H * 0.55} r={6} fill={glow} opacity={0.7} />
        <Circle cx={W * 0.76} cy={H * 0.7} r={5} fill={glow} opacity={0.7} />
        {/* Iarba */}
        <Circle cx={W * 0.26} cy={H * 0.75} r={3} fill={lighter} />
        <Circle cx={W * 0.66} cy={H * 0.45} r={3} fill={lighter} />
      </Svg>
    );
  },
  renderCloudsLayer: ({ width: W }) => {
    const H = 70;
    return (
      <Svg width={W} height={H}>
        <Circle cx={W * 0.2} cy={28} r={20} fill="rgba(180,220,200,0.4)" />
        <Circle cx={W * 0.28} cy={36} r={16} fill="rgba(180,220,200,0.4)" />
        <Circle cx={W * 0.52} cy={22} r={22} fill="rgba(180,220,200,0.4)" />
        <Circle cx={W * 0.62} cy={32} r={18} fill="rgba(180,220,200,0.4)" />
        <Circle cx={W * 0.82} cy={28} r={20} fill="rgba(180,220,200,0.4)" />
      </Svg>
    );
  },
};

registerWorld(PACK);
