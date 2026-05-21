// Randeaza un corp ceresc (soare, luna, planeta) in functie de config.
// Folosit de Scene cu opacity crossfade cand biome-ul se transforma.

import Svg, { Circle, Ellipse, Rect } from 'react-native-svg';
import { shade } from './worlds/util';
import type { CelestialConfig } from './worlds/types';

export function Celestial({ config }: { config: CelestialConfig }) {
  const { shape, color, size } = config;
  const dark = shade(color, -0.25);

  switch (shape) {
    case 'sun':
      return (
        <Svg width={size} height={size}>
          {/* 3 inele cu opacitate descrescatoare — simuleaza halou */}
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={color} opacity={0.22} />
          <Circle cx={size / 2} cy={size / 2} r={size * 0.4} fill={color} opacity={0.55} />
          <Circle cx={size / 2} cy={size / 2} r={size * 0.32} fill={color} />
        </Svg>
      );

    case 'moon':
      return (
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={color} opacity={0.18} />
          <Circle cx={size / 2} cy={size / 2} r={size * 0.4} fill={color} />
          {/* Cratere subtile */}
          <Circle cx={size * 0.4} cy={size * 0.4} r={size * 0.06} fill={dark} opacity={0.5} />
          <Circle cx={size * 0.55} cy={size * 0.5} r={size * 0.04} fill={dark} opacity={0.5} />
          <Circle cx={size * 0.45} cy={size * 0.58} r={size * 0.05} fill={dark} opacity={0.5} />
        </Svg>
      );

    case 'planet':
      return (
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={color} opacity={0.18} />
          <Circle cx={size / 2} cy={size / 2} r={size * 0.4} fill={color} />
          {/* Banda */}
          <Rect x={size * 0.1} y={size * 0.45} width={size * 0.8} height={size * 0.08} fill={dark} opacity={0.55} />
          {/* Inele */}
          <Ellipse
            cx={size / 2}
            cy={size / 2}
            rx={size * 0.5}
            ry={size * 0.1}
            stroke={color}
            strokeWidth={2}
            fill="none"
            opacity={0.6}
          />
        </Svg>
      );
  }
}
