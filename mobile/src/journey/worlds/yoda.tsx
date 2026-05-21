// Yoda — mlastina mistica cu ruine antice si licurici. Vibe: linistit,
// misterios, atemporal. Cetate prin ceata + lumini ezitante.

import Svg, { Circle, Polygon, Rect } from 'react-native-svg';
import { registerWorld } from './registry';
import { shade } from './util';
import type { WorldPack } from './types';

const PACK: WorldPack = {
  slug: 'yoda',
  name: 'Mlastina antica',
  biomes: [
    {
      key: 'mist',
      name: 'Templul in ceata',
      skyColor: '#7E8B7E',
      midColor: '#3B4A3B',
      groundColor: '#2E3A2E',
      accent: '#C9D17B',
      celestial: { shape: 'sun', color: '#D8E0B0', position: [0.65, 0.2], size: 75 },
    },
    {
      key: 'firefly-night',
      name: 'Noaptea licuricilor',
      skyColor: '#1F2A2F',
      midColor: '#2A3A30',
      groundColor: '#1E2A1E',
      accent: '#B8FF6B',
      celestial: { shape: 'moon', color: '#E8F5D8', position: [0.7, 0.13], size: 85 },
    },
  ],
  obstacles: [
    {
      key: 'ancient_pillar',
      render: ({ width: W, height: H, color }) => {
        const stone = '#7A7560';
        const dark = shade(stone, -0.2);
        return (
          <Svg width={W} height={H}>
            <Rect x={W * 0.2} y={H * 0.85} width={W * 0.6} height={H * 0.15} fill={dark} />
            <Rect x={W * 0.3} y={H * 0.1} width={W * 0.4} height={H * 0.78} fill={stone} />
            <Rect x={W * 0.32} y={H * 0.2} width={W * 0.05} height={H * 0.6} fill={dark} opacity={0.4} />
            <Rect x={W * 0.63} y={H * 0.2} width={W * 0.05} height={H * 0.6} fill={dark} opacity={0.4} />
            <Rect x={W * 0.15} y={H * 0.05} width={W * 0.7} height={H * 0.08} fill={dark} />
            <Circle cx={W * 0.5} cy={H * 0.4} r={W * 0.06} fill={color} opacity={0.7} />
          </Svg>
        );
      },
    },
    {
      key: 'root',
      render: ({ width: W, height: H }) => {
        const brown = '#4A3826';
        const dark = shade(brown, -0.2);
        return (
          <Svg width={W} height={H}>
            <Polygon
              points={`${W * 0.05},${H} ${W * 0.15},${H * 0.55} ${W * 0.4},${H * 0.4} ${W * 0.6},${H * 0.5} ${W * 0.8},${H * 0.55} ${W * 0.95},${H}`}
              fill={brown}
            />
            <Rect x={W * 0.35} y={H * 0.45} width={W * 0.05} height={H * 0.5} fill={dark} opacity={0.5} />
            <Rect x={W * 0.55} y={H * 0.55} width={W * 0.05} height={H * 0.4} fill={dark} opacity={0.5} />
            <Circle cx={W * 0.5} cy={H * 0.45} r={W * 0.08} fill={dark} />
          </Svg>
        );
      },
    },
    {
      key: 'holocron',
      render: ({ width: W, height: H, color }) => {
        const bright = shade(color, 0.3);
        return (
          <Svg width={W} height={H}>
            <Polygon
              points={`${W * 0.5},${H * 0.15} ${W * 0.85},${H * 0.4} ${W * 0.85},${H * 0.75} ${W * 0.5},${H} ${W * 0.15},${H * 0.75} ${W * 0.15},${H * 0.4}`}
              fill={color}
              opacity={0.7}
            />
            <Polygon
              points={`${W * 0.5},${H * 0.15} ${W * 0.85},${H * 0.4} ${W * 0.5},${H * 0.55} ${W * 0.15},${H * 0.4}`}
              fill={bright}
              opacity={0.85}
            />
            <Circle cx={W * 0.5} cy={H * 0.55} r={W * 0.08} fill="#FFFFFF" opacity={0.9} />
          </Svg>
        );
      },
    },
  ],
  ambient: [
    // Pete de ceata care plutesc in fundal.
    {
      key: 'mist',
      layer: 'back',
      density: 3,
      yRange: [0.3, 0.6],
      sizeRange: [60, 110],
      speedRange: [-25, -10],
      render: ({ size }) => (
        <Svg width={size} height={size * 0.4}>
          <Circle cx={size * 0.3} cy={size * 0.2} r={size * 0.2} fill="rgba(255,255,255,0.18)" />
          <Circle cx={size * 0.55} cy={size * 0.18} r={size * 0.25} fill="rgba(255,255,255,0.18)" />
          <Circle cx={size * 0.75} cy={size * 0.22} r={size * 0.18} fill="rgba(255,255,255,0.18)" />
        </Svg>
      ),
    },
    // Licurici verzi care zboara mediu.
    {
      key: 'firefly',
      layer: 'mid',
      density: 6,
      yRange: [0.3, 0.7],
      sizeRange: [4, 8],
      speedRange: [-50, -20],
      render: ({ size }) => (
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="#B8FF6B" opacity={0.9} />
          <Circle cx={size / 2} cy={size / 2} r={size / 4} fill="#FFFFFF" />
        </Svg>
      ),
    },
    // Frunze cazand din copaci (aproape).
    {
      key: 'leaf',
      layer: 'fore',
      density: 2,
      yRange: [0.45, 0.7],
      sizeRange: [10, 16],
      speedRange: [-80, -50],
      render: ({ size }) => (
        <Svg width={size} height={size}>
          <Polygon
            points={`${size * 0.5},0 ${size * 0.85},${size * 0.4} ${size * 0.5},${size} ${size * 0.15},${size * 0.4}`}
            fill="#5C7A3D"
            opacity={0.85}
          />
        </Svg>
      ),
    },
  ],
  // Mid layer = ruine antice prin ceata. Coloane sparte + arcuri.
  renderMidLayer: ({ width: W, height: H, color }) => {
    const darker = shade(color, -0.18);
    const stone = shade(color, 0.05);
    const backTopY = H * 0.55;
    const frontTopY = H * 0.78;
    return (
      <Svg width={W} height={H} style={{ overflow: 'visible' }}>
        {/* Dealuri mlastinoase in spate */}
        <Polygon
          points={[
            `0,${H}`,
            `0,${backTopY}`,
            `${W * 0.2},${H * 0.35}`,
            `${W * 0.4},${H * 0.5}`,
            `${W * 0.6},${H * 0.32}`,
            `${W * 0.8},${H * 0.48}`,
            `${W},${backTopY}`,
            `${W},${H}`,
          ].join(' ')}
          fill={darker}
        />
        {/* Ruine antice — coloane sparte, ca silueta */}
        <Rect x={W * 0.15} y={H * 0.5} width={W * 0.04} height={H * 0.25} fill={stone} opacity={0.6} />
        <Rect x={W * 0.4} y={H * 0.45} width={W * 0.05} height={H * 0.3} fill={stone} opacity={0.6} />
        <Rect x={W * 0.42} y={H * 0.43} width={W * 0.18} height={H * 0.03} fill={stone} opacity={0.6} />
        <Rect x={W * 0.6} y={H * 0.5} width={W * 0.04} height={H * 0.25} fill={stone} opacity={0.6} />
        <Rect x={W * 0.78} y={H * 0.55} width={W * 0.05} height={H * 0.2} fill={stone} opacity={0.6} />
        {/* Vegetatie in fata */}
        <Polygon
          points={[
            `0,${H}`,
            `0,${frontTopY}`,
            `${W * 0.25},${H * 0.62}`,
            `${W * 0.5},${H * 0.72}`,
            `${W * 0.75},${H * 0.6}`,
            `${W},${frontTopY}`,
            `${W},${H}`,
          ].join(' ')}
          fill={color}
        />
      </Svg>
    );
  },
  // Sol = muschi cu ciuperci.
  renderGroundLayer: ({ width: W, height: H, color }) => {
    const lighter = shade(color, 0.15);
    return (
      <Svg width={W} height={H}>
        <Rect x={0} y={0} width={W} height={H} fill={color} />
        {/* Ciuperci */}
        <Rect x={W * 0.18} y={H * 0.6} width={4} height={8} fill="#E8DCC5" />
        <Circle cx={W * 0.19} cy={H * 0.58} r={6} fill="#A85850" />
        <Rect x={W * 0.42} y={H * 0.7} width={3} height={6} fill="#E8DCC5" />
        <Circle cx={W * 0.435} cy={H * 0.68} r={4} fill="#A85850" />
        <Rect x={W * 0.72} y={H * 0.62} width={4} height={8} fill="#E8DCC5" />
        <Circle cx={W * 0.74} cy={H * 0.6} r={5} fill="#A85850" />
        {/* Muschi luminos */}
        <Circle cx={W * 0.32} cy={H * 0.5} r={4} fill={lighter} />
        <Circle cx={W * 0.58} cy={H * 0.55} r={5} fill={lighter} />
      </Svg>
    );
  },
  // Back layer — silueta munti foarte departe, ploata in ceata.
  renderBackLayer: ({ width: W, height: H, color }) => {
    const distant = shade(color, -0.05);
    return (
      <Svg width={W} height={H} style={{ overflow: 'visible' }}>
        <Polygon
          points={[
            `0,${H}`,
            `0,${H * 0.75}`,
            `${W * 0.18},${H * 0.45}`,
            `${W * 0.35},${H * 0.6}`,
            `${W * 0.55},${H * 0.4}`,
            `${W * 0.75},${H * 0.55}`,
            `${W * 0.9},${H * 0.5}`,
            `${W},${H * 0.75}`,
            `${W},${H}`,
          ].join(' ')}
          fill={distant}
          opacity={0.55}
        />
      </Svg>
    );
  },
  // Cloud layer = ceata densa sus.
  renderCloudsLayer: ({ width: W }) => {
    const H = 90;
    return (
      <Svg width={W} height={H}>
        <Circle cx={W * 0.18} cy={40} r={32} fill="rgba(200,210,200,0.35)" />
        <Circle cx={W * 0.3} cy={50} r={26} fill="rgba(200,210,200,0.35)" />
        <Circle cx={W * 0.52} cy={35} r={36} fill="rgba(200,210,200,0.3)" />
        <Circle cx={W * 0.65} cy={48} r={28} fill="rgba(200,210,200,0.3)" />
        <Circle cx={W * 0.82} cy={40} r={30} fill="rgba(200,210,200,0.35)" />
      </Svg>
    );
  },
};

registerWorld(PACK);
