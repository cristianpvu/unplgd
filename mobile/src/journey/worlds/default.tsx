// World pack default — fallback pt orice pet care nu are config dedicat.
// Vibe: padure linistita, dealuri rotunde, copaci, cristale.
//
// Toate siluetele incep si se termina la acelasi y la x=0 si x=W (seam-less).

import Svg, { Circle, Polygon, Rect } from 'react-native-svg';
import { shade } from './util';
import type { WorldPack } from './types';

export const DEFAULT_WORLD: WorldPack = {
  slug: 'default',
  name: 'Drumul senin',
  biomes: [
    {
      key: 'day',
      name: 'Padurea linistita',
      skyColor: '#A8D8F0',
      midColor: '#5BA67A',
      groundColor: '#3D7A56',
      accent: '#FF9F43',
    },
    {
      key: 'dusk',
      name: 'Padurea in amurg',
      skyColor: '#F2A37C',
      midColor: '#4A7A60',
      groundColor: '#2E5A40',
      accent: '#FFD93D',
    },
  ],
  obstacles: [
    {
      key: 'rock',
      render: ({ width: W, height: H, color }) => {
        const dark = shade(color, -0.25);
        return (
          <Svg width={W} height={H}>
            <Polygon
              points={`${W * 0.1},${H} ${W * 0.05},${H * 0.55} ${W * 0.3},${H * 0.25} ${W * 0.65},${H * 0.2} ${W * 0.92},${H * 0.5} ${W * 0.95},${H * 0.85} ${W * 0.75},${H}`}
              fill={dark}
            />
            <Polygon
              points={`${W * 0.2},${H * 0.92} ${W * 0.25},${H * 0.55} ${W * 0.45},${H * 0.35} ${W * 0.7},${H * 0.45} ${W * 0.78},${H * 0.85}`}
              fill={color}
              opacity={0.75}
            />
          </Svg>
        );
      },
    },
    {
      key: 'tree',
      render: ({ width: W, height: H, color }) => {
        const dark = shade(color, -0.25);
        return (
          <Svg width={W} height={H}>
            <Rect x={W * 0.42} y={H * 0.55} width={W * 0.16} height={H * 0.45} fill={dark} />
            <Circle cx={W * 0.5} cy={H * 0.4} r={W * 0.42} fill={color} />
            <Circle cx={W * 0.3} cy={H * 0.45} r={W * 0.25} fill={color} opacity={0.85} />
            <Circle cx={W * 0.72} cy={H * 0.45} r={W * 0.25} fill={color} opacity={0.85} />
          </Svg>
        );
      },
    },
    {
      key: 'crystal',
      render: ({ width: W, height: H, color }) => (
        <Svg width={W} height={H}>
          <Polygon
            points={`${W * 0.5},0 ${W * 0.9},${H * 0.35} ${W * 0.7},${H} ${W * 0.3},${H} ${W * 0.1},${H * 0.35}`}
            fill={color}
          />
          <Polygon
            points={`${W * 0.5},0 ${W * 0.9},${H * 0.35} ${W * 0.7},${H} ${W * 0.5},${H * 0.5}`}
            fill={shade(color, 0.2)}
          />
        </Svg>
      ),
    },
    {
      key: 'door',
      render: ({ width: W, height: H, color }) => {
        const dark = shade(color, -0.25);
        return (
          <Svg width={W} height={H}>
            <Rect x={W * 0.1} y={H * 0.05} width={W * 0.8} height={H * 0.95} rx={W * 0.1} fill={dark} />
            <Rect
              x={W * 0.18}
              y={H * 0.13}
              width={W * 0.64}
              height={H * 0.8}
              rx={W * 0.08}
              fill={color}
            />
            <Circle cx={W * 0.72} cy={H * 0.55} r={W * 0.06} fill={dark} />
          </Svg>
        );
      },
    },
  ],
  ambient: [
    // Pasari care planeaza prin cer.
    {
      key: 'bird',
      layer: 'back',
      density: 2,
      yRange: [0.1, 0.35],
      sizeRange: [12, 22],
      speedRange: [-50, -25],
      render: ({ size }) => (
        <Svg width={size} height={size * 0.5}>
          <Polygon
            points={`0,${size * 0.4} ${size * 0.25},${size * 0.15} ${size * 0.5},${size * 0.35} ${size * 0.75},${size * 0.15} ${size},${size * 0.4}`}
            fill="rgba(45, 42, 74, 0.7)"
          />
        </Svg>
      ),
    },
    // Fluturi colorati aproape de iarba.
    {
      key: 'butterfly',
      layer: 'fore',
      density: 1,
      yRange: [0.55, 0.75],
      sizeRange: [14, 20],
      speedRange: [-80, -40],
      render: ({ size }) => (
        <Svg width={size} height={size}>
          <Circle cx={size * 0.3} cy={size * 0.4} r={size * 0.25} fill="#FF7AB6" opacity={0.85} />
          <Circle cx={size * 0.7} cy={size * 0.4} r={size * 0.25} fill="#FFB840" opacity={0.85} />
          <Rect x={size * 0.47} y={size * 0.3} width={size * 0.06} height={size * 0.5} fill="#2D2A4A" />
        </Svg>
      ),
    },
  ],
  renderMidLayer: ({ width: W, height: H, color }) => {
    const darker = shade(color, -0.18);
    const backTopY = H * 0.5;
    const frontTopY = H * 0.75;
    return (
      <Svg width={W} height={H} style={{ overflow: 'visible' }}>
        <Polygon
          points={[
            `0,${H}`,
            `0,${backTopY}`,
            `${W * 0.22},${H * 0.28}`,
            `${W * 0.42},${H * 0.45}`,
            `${W * 0.62},${H * 0.22}`,
            `${W * 0.82},${H * 0.4}`,
            `${W},${backTopY}`,
            `${W},${H}`,
          ].join(' ')}
          fill={darker}
        />
        <Polygon
          points={[
            `0,${H}`,
            `0,${frontTopY}`,
            `${W * 0.28},${H * 0.55}`,
            `${W * 0.5},${H * 0.7}`,
            `${W * 0.72},${H * 0.5}`,
            `${W * 0.9},${H * 0.65}`,
            `${W},${frontTopY}`,
            `${W},${H}`,
          ].join(' ')}
          fill={color}
        />
      </Svg>
    );
  },
  renderGroundLayer: ({ width: W, height: H, color }) => {
    const lighter = shade(color, 0.12);
    return (
      <Svg width={W} height={H}>
        <Rect x={0} y={0} width={W} height={H} fill={color} />
        <Circle cx={W * 0.14} cy={H * 0.4} r={5} fill={lighter} />
        <Circle cx={W * 0.32} cy={H * 0.6} r={4} fill={lighter} />
        <Circle cx={W * 0.5} cy={H * 0.35} r={7} fill={lighter} />
        <Circle cx={W * 0.68} cy={H * 0.55} r={4} fill={lighter} />
        <Circle cx={W * 0.84} cy={H * 0.45} r={5} fill={lighter} />
      </Svg>
    );
  },
  renderCloudsLayer: ({ width: W }) => {
    const H = 70;
    return (
      <Svg width={W} height={H}>
        <Circle cx={W * 0.18} cy={20} r={18} fill="rgba(255,255,255,0.55)" />
        <Circle cx={W * 0.22} cy={28} r={14} fill="rgba(255,255,255,0.55)" />
        <Circle cx={W * 0.5} cy={14} r={14} fill="rgba(255,255,255,0.5)" />
        <Circle cx={W * 0.54} cy={20} r={18} fill="rgba(255,255,255,0.5)" />
        <Circle cx={W * 0.78} cy={30} r={11} fill="rgba(255,255,255,0.45)" />
        <Circle cx={W * 0.81} cy={24} r={14} fill="rgba(255,255,255,0.45)" />
      </Svg>
    );
  },
};
