// Stitch — extraterestru pe insula tropicala (Hawaii). Plaja cu palmieri,
// vulcani in spate, ocean orizont. Vibe: jucaus, soare, valuri.

import Svg, { Circle, Polygon, Rect } from 'react-native-svg';
import { registerWorld } from './registry';
import { shade } from './util';
import type { WorldPack } from './types';

const PACK: WorldPack = {
  slug: 'stitch',
  name: 'Insula tropicala',
  biomes: [
    {
      key: 'noon',
      name: 'Plaja insorita',
      skyColor: '#5BC0EB',
      midColor: '#2D8C5F',
      groundColor: '#E8C97A',
      accent: '#FF6B9D',
      celestial: { shape: 'sun', color: '#FFEB6B', position: [0.72, 0.12], size: 90 },
    },
    {
      key: 'sunset',
      name: 'Apus pe plaja',
      skyColor: '#FF9B6A',
      midColor: '#1F5A3F',
      groundColor: '#C9A55F',
      accent: '#FFEB6B',
      celestial: { shape: 'sun', color: '#FF5A3F', position: [0.88, 0.5], size: 110 },
    },
  ],
  obstacles: [
    {
      key: 'coconut',
      render: ({ width: W, height: H, color }) => {
        const dark = shade('#5C3A1F', -0.1);
        return (
          <Svg width={W} height={H}>
            <Circle cx={W * 0.5} cy={H * 0.55} r={W * 0.32} fill={dark} />
            <Circle cx={W * 0.4} cy={H * 0.45} r={W * 0.06} fill={shade(dark, -0.2)} />
            <Circle cx={W * 0.55} cy={H * 0.55} r={W * 0.06} fill={shade(dark, -0.2)} />
            <Circle cx={W * 0.48} cy={H * 0.65} r={W * 0.06} fill={shade(dark, -0.2)} />
            <Rect x={W * 0.45} y={H * 0.15} width={W * 0.1} height={H * 0.15} fill={color} opacity={0.7} />
          </Svg>
        );
      },
    },
    {
      key: 'palm_log',
      render: ({ width: W, height: H, color }) => {
        const dark = shade('#6B4A2A', -0.1);
        return (
          <Svg width={W} height={H}>
            <Rect x={W * 0.05} y={H * 0.5} width={W * 0.9} height={H * 0.4} rx={H * 0.1} fill={dark} />
            <Rect x={W * 0.1} y={H * 0.6} width={W * 0.8} height={H * 0.05} fill={shade(dark, 0.15)} opacity={0.7} />
            <Rect x={W * 0.1} y={H * 0.75} width={W * 0.8} height={H * 0.05} fill={shade(dark, 0.15)} opacity={0.7} />
            <Circle cx={W * 0.3} cy={H * 0.4} r={W * 0.12} fill={color} />
            <Circle cx={W * 0.5} cy={H * 0.35} r={W * 0.14} fill={color} />
            <Circle cx={W * 0.7} cy={H * 0.4} r={W * 0.12} fill={color} />
          </Svg>
        );
      },
    },
    {
      key: 'surfboard',
      render: ({ width: W, height: H, color }) => {
        const stripe = shade(color, 0.3);
        return (
          <Svg width={W} height={H}>
            <Polygon
              points={`${W * 0.5},${H * 0.05} ${W * 0.65},${H * 0.2} ${W * 0.65},${H * 0.9} ${W * 0.5},${H} ${W * 0.35},${H * 0.9} ${W * 0.35},${H * 0.2}`}
              fill={color}
            />
            <Rect x={W * 0.48} y={H * 0.15} width={W * 0.04} height={H * 0.8} fill={stripe} opacity={0.7} />
          </Svg>
        );
      },
    },
    {
      key: 'crab',
      render: ({ width: W, height: H, color }) => {
        const dark = shade(color, -0.2);
        return (
          <Svg width={W} height={H}>
            <Polygon points={`${W * 0.1},${H * 0.7} ${W * 0.25},${H * 0.55}`} stroke={dark} strokeWidth={3} fill="none" />
            <Polygon points={`${W * 0.9},${H * 0.7} ${W * 0.75},${H * 0.55}`} stroke={dark} strokeWidth={3} fill="none" />
            <Circle cx={W * 0.5} cy={H * 0.65} r={W * 0.32} fill={color} />
            <Circle cx={W * 0.4} cy={H * 0.58} r={W * 0.05} fill="#FFFFFF" />
            <Circle cx={W * 0.6} cy={H * 0.58} r={W * 0.05} fill="#FFFFFF" />
            <Circle cx={W * 0.4} cy={H * 0.58} r={W * 0.02} fill="#000" />
            <Circle cx={W * 0.6} cy={H * 0.58} r={W * 0.02} fill="#000" />
            <Polygon points={`${W * 0.15},${H * 0.5} ${W * 0.25},${H * 0.6} ${W * 0.2},${H * 0.65}`} fill={dark} />
            <Polygon points={`${W * 0.85},${H * 0.5} ${W * 0.75},${H * 0.6} ${W * 0.8},${H * 0.65}`} fill={dark} />
          </Svg>
        );
      },
    },
  ],
  ambient: [
    // Pescarusi care planeaza peste mare.
    {
      key: 'seagull',
      layer: 'back',
      density: 2,
      yRange: [0.1, 0.3],
      sizeRange: [14, 22],
      speedRange: [-55, -30],
      render: ({ size }) => (
        <Svg width={size} height={size * 0.4}>
          <Polygon
            points={`0,${size * 0.3} ${size * 0.25},${size * 0.1} ${size * 0.5},${size * 0.25} ${size * 0.75},${size * 0.1} ${size},${size * 0.3}`}
            fill="#FFFFFF"
            stroke="rgba(0,0,0,0.4)"
            strokeWidth={1}
          />
        </Svg>
      ),
    },
    // Petale de hibiscus care plutesc.
    {
      key: 'petal',
      layer: 'fore',
      density: 3,
      yRange: [0.4, 0.7],
      sizeRange: [10, 16],
      speedRange: [-70, -35],
      render: ({ size }) => (
        <Svg width={size} height={size}>
          <Circle cx={size * 0.5} cy={size * 0.3} r={size * 0.22} fill="#FF6B9D" opacity={0.85} />
          <Circle cx={size * 0.3} cy={size * 0.5} r={size * 0.22} fill="#FF6B9D" opacity={0.85} />
          <Circle cx={size * 0.7} cy={size * 0.5} r={size * 0.22} fill="#FF6B9D" opacity={0.85} />
          <Circle cx={size * 0.5} cy={size * 0.5} r={size * 0.15} fill="#FFEB6B" />
        </Svg>
      ),
    },
    // Strop sclipitor de la valuri (departe in spate).
    {
      key: 'sparkle',
      layer: 'mid',
      density: 4,
      yRange: [0.45, 0.55],
      sizeRange: [3, 6],
      speedRange: [-30, -15],
      render: ({ size }) => (
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="#FFFFFF" opacity={0.9} />
        </Svg>
      ),
    },
  ],
  // Mid layer = vulcani + ocean orizont. Seamless: incepe/se termina la H*0.65 (back) si H*0.85 (front).
  renderMidLayer: ({ width: W, height: H, color }) => {
    const darker = shade(color, -0.2);
    const backTopY = H * 0.65;
    const frontTopY = H * 0.85;
    // Linia oceanului — orizont alb-albastru in spatele vulcanilor.
    const oceanColor = '#3DA9C7';
    return (
      <Svg width={W} height={H} style={{ overflow: 'visible' }}>
        {/* Ocean stripe in spate */}
        <Rect x={0} y={H * 0.7} width={W} height={H * 0.1} fill={oceanColor} opacity={0.5} />
        {/* Vulcani in spate */}
        <Polygon
          points={[
            `0,${H}`,
            `0,${backTopY}`,
            `${W * 0.2},${H * 0.4}`,
            `${W * 0.32},${H * 0.2}`,
            `${W * 0.45},${H * 0.42}`,
            `${W * 0.62},${H * 0.25}`,
            `${W * 0.78},${H * 0.5}`,
            `${W},${backTopY}`,
            `${W},${H}`,
          ].join(' ')}
          fill={darker}
        />
        {/* Jungla in fata */}
        <Polygon
          points={[
            `0,${H}`,
            `0,${frontTopY}`,
            `${W * 0.15},${H * 0.65}`,
            `${W * 0.3},${H * 0.78}`,
            `${W * 0.5},${H * 0.6}`,
            `${W * 0.7},${H * 0.72}`,
            `${W * 0.88},${H * 0.62}`,
            `${W},${frontTopY}`,
            `${W},${H}`,
          ].join(' ')}
          fill={color}
        />
      </Svg>
    );
  },
  // Sol = nisip + scoici. Decoratiuni in 12%-85%.
  renderGroundLayer: ({ width: W, height: H, color }) => {
    const lighter = shade(color, 0.12);
    const seashell = '#FFE3D6';
    return (
      <Svg width={W} height={H}>
        <Rect x={0} y={0} width={W} height={H} fill={color} />
        {/* Valuri pe nisip umed */}
        <Rect x={0} y={0} width={W} height={H * 0.15} fill={shade(color, -0.08)} opacity={0.5} />
        {/* Scoici */}
        <Circle cx={W * 0.18} cy={H * 0.5} r={5} fill={seashell} />
        <Circle cx={W * 0.4} cy={H * 0.65} r={4} fill={seashell} />
        <Circle cx={W * 0.6} cy={H * 0.45} r={6} fill={seashell} />
        <Circle cx={W * 0.78} cy={H * 0.6} r={5} fill={lighter} />
      </Svg>
    );
  },
  // Back layer — alte insule pe orizont, foarte mici si pale.
  renderBackLayer: ({ width: W, height: H }) => {
    return (
      <Svg width={W} height={H} style={{ overflow: 'visible' }}>
        {/* Insula 1 */}
        <Polygon
          points={`${W * 0.1},${H} ${W * 0.13},${H * 0.7} ${W * 0.2},${H * 0.5} ${W * 0.3},${H * 0.55} ${W * 0.35},${H * 0.78} ${W * 0.4},${H}`}
          fill="#3A6A8A"
          opacity={0.45}
        />
        {/* Insula 2 */}
        <Polygon
          points={`${W * 0.55},${H} ${W * 0.6},${H * 0.65} ${W * 0.7},${H * 0.45} ${W * 0.78},${H * 0.5} ${W * 0.85},${H * 0.7} ${W * 0.88},${H}`}
          fill="#3A6A8A"
          opacity={0.45}
        />
      </Svg>
    );
  },
  renderCloudsLayer: ({ width: W }) => {
    const H = 70;
    // Nori grasi tropicali.
    return (
      <Svg width={W} height={H}>
        <Circle cx={W * 0.18} cy={28} r={22} fill="rgba(255,255,255,0.85)" />
        <Circle cx={W * 0.27} cy={36} r={18} fill="rgba(255,255,255,0.85)" />
        <Circle cx={W * 0.5} cy={22} r={20} fill="rgba(255,255,255,0.8)" />
        <Circle cx={W * 0.58} cy={32} r={24} fill="rgba(255,255,255,0.8)" />
        <Circle cx={W * 0.82} cy={26} r={20} fill="rgba(255,255,255,0.85)" />
      </Svg>
    );
  },
};

registerWorld(PACK);
