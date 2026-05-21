// stitch — plaja tropicala. Ocean cu gradient + valuri, palmieri curbati cu
// frunze ce cad, insule in zare, nisip cu scoici. Forme cu curbe smooth (Path)
// si gradienturi, palmier cazut realist.

import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { registerWorld } from './registry';
import { shade } from './util';
import type { WorldPack } from './types';

// Coroana de palmier — frunze curbate care cad in jurul unui punct.
function palmCrown(cx: number, cy: number, r: number, color: string) {
  const dark = shade(color, -0.2);
  const frond = (angle: number, len: number, c: string) => {
    const rad = (angle * Math.PI) / 180;
    const ex = cx + Math.cos(rad) * len;
    const ey = cy + Math.sin(rad) * len;
    // Punct de control care lasa frunza sa se arcuiasca in jos.
    const mx = cx + Math.cos(rad) * len * 0.5;
    const my = cy + Math.sin(rad) * len * 0.5 - len * 0.25;
    return `M${cx},${cy} Q${mx},${my} ${ex},${ey}`;
  };
  return (
    <>
      <Path d={frond(200, r, color)} stroke={color} strokeWidth={r * 0.28} fill="none" strokeLinecap="round" />
      <Path d={frond(160, r, color)} stroke={color} strokeWidth={r * 0.28} fill="none" strokeLinecap="round" />
      <Path d={frond(235, r * 0.9, dark)} stroke={dark} strokeWidth={r * 0.26} fill="none" strokeLinecap="round" />
      <Path d={frond(305, r * 0.9, dark)} stroke={dark} strokeWidth={r * 0.26} fill="none" strokeLinecap="round" />
      <Path d={frond(270, r * 0.7, color)} stroke={color} strokeWidth={r * 0.24} fill="none" strokeLinecap="round" />
      <Circle cx={cx} cy={cy} r={r * 0.16} fill={dark} />
    </>
  );
}

const PACK: WorldPack = {
  slug: 'stitch',
  name: 'Insula tropicala',
  biomes: [
    {
      key: 'noon',
      name: 'Plaja insorita',
      skyColor: '#6CC5E8',
      midColor: '#2E9C6A',
      groundColor: '#EACF86',
      accent: '#FF6B9D',
    },
    {
      key: 'sunset',
      name: 'Apus pe plaja',
      skyColor: '#FF9F6A',
      midColor: '#1F6A48',
      groundColor: '#D2A862',
      accent: '#FFEB6B',
    },
  ],
  obstacles: [
    {
      key: 'coconut',
      render: ({ width: W, height: H, color }) => {
        const husk = '#7A4A28';
        return (
          <Svg width={W} height={H}>
            <Defs>
              <LinearGradient id="stCoco" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={shade(husk, 0.18)} />
                <Stop offset="1" stopColor={shade(husk, -0.2)} />
              </LinearGradient>
            </Defs>
            <Circle cx={W * 0.5} cy={H * 0.6} r={W * 0.33} fill="url(#stCoco)" />
            {/* Cele 3 puncte */}
            <Circle cx={W * 0.42} cy={H * 0.52} r={W * 0.05} fill={shade(husk, -0.35)} />
            <Circle cx={W * 0.56} cy={H * 0.55} r={W * 0.05} fill={shade(husk, -0.35)} />
            <Circle cx={W * 0.48} cy={H * 0.66} r={W * 0.05} fill={shade(husk, -0.35)} />
            {/* Reflexie */}
            <Ellipse cx={W * 0.4} cy={H * 0.45} rx={W * 0.07} ry={W * 0.04} fill="rgba(255,255,255,0.3)" />
          </Svg>
        );
      },
    },
    {
      key: 'palm_log',
      render: ({ width: W, height: H, color }) => {
        const trunk = '#9A6B3C';
        return (
          <Svg width={W} height={H}>
            <Defs>
              <LinearGradient id="stTrunk" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={shade(trunk, 0.15)} />
                <Stop offset="1" stopColor={shade(trunk, -0.2)} />
              </LinearGradient>
            </Defs>
            {/* Trunchi cazut, usor curbat */}
            <Path
              d={`M${W * 0.02},${H * 0.72} Q${W * 0.5},${H * 0.55} ${W * 0.98},${H * 0.7} L${W * 0.98},${H * 0.86} Q${W * 0.5},${H * 0.7} ${W * 0.02},${H * 0.88} Z`}
              fill="url(#stTrunk)"
            />
            {/* Inele de scoarta */}
            <Path d={`M${W * 0.3},${H * 0.63} L${W * 0.3},${H * 0.81}`} stroke={shade(trunk, -0.3)} strokeWidth={2} opacity={0.5} />
            <Path d={`M${W * 0.55},${H * 0.61} L${W * 0.55},${H * 0.79}`} stroke={shade(trunk, -0.3)} strokeWidth={2} opacity={0.5} />
            {/* Coroana la capatul drept */}
            {palmCrown(W * 0.92, H * 0.6, W * 0.22, '#2E9C6A')}
          </Svg>
        );
      },
    },
    {
      key: 'surfboard',
      render: ({ width: W, height: H, color }) => {
        const board = color;
        return (
          <Svg width={W} height={H}>
            <Defs>
              <LinearGradient id="stBoard" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={shade(board, 0.2)} />
                <Stop offset="1" stopColor={shade(board, -0.15)} />
              </LinearGradient>
            </Defs>
            {/* Placa infipta in nisip, forma de migdala */}
            <Path
              d={`M${W * 0.5},${H * 0.04} Q${W * 0.72},${H * 0.4} ${W * 0.58},${H * 0.96} L${W * 0.42},${H * 0.96} Q${W * 0.28},${H * 0.4} ${W * 0.5},${H * 0.04} Z`}
              fill="url(#stBoard)"
            />
            {/* Dunga centrala */}
            <Path d={`M${W * 0.5},${H * 0.1} L${W * 0.5},${H * 0.92}`} stroke={shade(board, 0.35)} strokeWidth={2.5} opacity={0.7} />
          </Svg>
        );
      },
    },
    {
      key: 'crab',
      render: ({ width: W, height: H, color }) => {
        const body = color;
        const dark = shade(body, -0.25);
        return (
          <Svg width={W} height={H}>
            <Defs>
              <LinearGradient id="stCrab" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={shade(body, 0.18)} />
                <Stop offset="1" stopColor={shade(body, -0.18)} />
              </LinearGradient>
            </Defs>
            {/* Picioare */}
            <Path d={`M${W * 0.3},${H * 0.7} L${W * 0.12},${H * 0.6} M${W * 0.32},${H * 0.78} L${W * 0.14},${H * 0.78} M${W * 0.7},${H * 0.7} L${W * 0.88},${H * 0.6} M${W * 0.68},${H * 0.78} L${W * 0.86},${H * 0.78}`} stroke={dark} strokeWidth={3} strokeLinecap="round" />
            {/* Clesti */}
            <Circle cx={W * 0.16} cy={H * 0.5} r={W * 0.09} fill={dark} />
            <Circle cx={W * 0.84} cy={H * 0.5} r={W * 0.09} fill={dark} />
            {/* Corp */}
            <Ellipse cx={W * 0.5} cy={H * 0.62} rx={W * 0.3} ry={W * 0.22} fill="url(#stCrab)" />
            {/* Ochi */}
            <Circle cx={W * 0.42} cy={H * 0.46} r={W * 0.06} fill="#FFF" />
            <Circle cx={W * 0.58} cy={H * 0.46} r={W * 0.06} fill="#FFF" />
            <Circle cx={W * 0.42} cy={H * 0.46} r={W * 0.025} fill="#000" />
            <Circle cx={W * 0.58} cy={H * 0.46} r={W * 0.025} fill="#000" />
          </Svg>
        );
      },
    },
  ],
  ambient: [
    {
      key: 'seagull',
      layer: 'back',
      density: 2,
      yRange: [0.1, 0.28],
      sizeRange: [14, 22],
      speedRange: [-55, -30],
      render: ({ size }) => (
        <Svg width={size} height={size * 0.4}>
          <Path
            d={`M0,${size * 0.3} Q${size * 0.25},${size * 0.03} ${size * 0.5},${size * 0.28} Q${size * 0.75},${size * 0.03} ${size},${size * 0.3}`}
            stroke="rgba(255,255,255,0.85)"
            strokeWidth={2.5}
            fill="none"
          />
        </Svg>
      ),
    },
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
          <Circle cx={size * 0.5} cy={size * 0.5} r={size * 0.13} fill="#FFEB6B" />
        </Svg>
      ),
    },
    {
      key: 'sparkle',
      layer: 'mid',
      density: 5,
      yRange: [0.46, 0.56],
      sizeRange: [3, 6],
      speedRange: [-26, -12],
      render: ({ size }) => (
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="rgba(255,255,255,0.9)" />
        </Svg>
      ),
    },
  ],
  // Cloud layer = nori tropicali pufosi.
  renderCloudsLayer: ({ width: W }) => {
    const H = 70;
    return (
      <Svg width={W} height={H}>
        <Ellipse cx={W * 0.22} cy={32} rx={42} ry={20} fill="rgba(255,255,255,0.85)" />
        <Ellipse cx={W * 0.3} cy={38} rx={30} ry={16} fill="rgba(255,255,255,0.8)" />
        <Ellipse cx={W * 0.62} cy={28} rx={38} ry={18} fill="rgba(255,255,255,0.8)" />
        <Ellipse cx={W * 0.82} cy={34} rx={32} ry={16} fill="rgba(255,255,255,0.85)" />
      </Svg>
    );
  },
  // Back layer = alte insule + ocean orizont, foarte pale.
  renderBackLayer: ({ width: W, height: H }) => {
    const ocean = '#3DA9C7';
    const isle = '#4E8C6A';
    return (
      <Svg width={W} height={H} style={{ overflow: 'visible' }}>
        <Defs>
          <LinearGradient id="stOcean" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={shade(ocean, 0.15)} />
            <Stop offset="1" stopColor={shade(ocean, -0.1)} />
          </LinearGradient>
        </Defs>
        {/* Banda de ocean */}
        <Rect x={0} y={H * 0.55} width={W} height={H * 0.45} fill="url(#stOcean)" opacity={0.6} />
        {/* Insule mici */}
        <Path d={`M${W * 0.12},${H * 0.6} Q${W * 0.22},${H * 0.32} ${W * 0.34},${H * 0.6} Z`} fill={isle} opacity={0.5} />
        <Path d={`M${W * 0.62},${H * 0.6} Q${W * 0.74},${H * 0.38} ${W * 0.86},${H * 0.6} Z`} fill={isle} opacity={0.5} />
      </Svg>
    );
  },
  // Mid layer = jungla + palmieri curbati. SVG-ul se extinde IN SUS cu extraTop
  // (overflow visible pe wrapper) ca varful coroanelor sa NU se mai taie sus.
  // Coordonatele continue sa fie raportate la H = slot original; lucram intr-un
  // sistem mai inalt, dar pozitia top a Svg-ului e shiftata in sus cu extraTop.
  renderMidLayer: ({ width: W, height: H, color }) => {
    const jungle = color;
    const trunk = '#8A5E34';
    const frontTopY = H * 0.78;
    // Cat sa extindem in sus. H * 0.6 e suficient sa cuprinda coroanele.
    const extraTop = H * 0.6;
    const svgH = H + extraTop;
    // Helper care shifteaza y-ul cu extraTop, ca toate coordonatele de mai jos
    // sa fie raportate la SVG-ul extins.
    const Y = (y: number) => y + extraTop;
    return (
      <View style={{ width: W, height: H, overflow: 'visible' }}>
        <Svg
          width={W}
          height={svgH}
          style={{ position: 'absolute', top: -extraTop, left: 0 }}
        >
          <Defs>
            <LinearGradient id="stJungle" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={shade(jungle, 0.15)} />
              <Stop offset="1" stopColor={shade(jungle, -0.15)} />
            </LinearGradient>
          </Defs>
          {/* Palmier stanga — trunchi curbat + coroana sus, complet vizibila */}
          <Path d={`M${W * 0.1},${Y(H)} Q${W * 0.06},${Y(H * 0.5)} ${W * 0.14},${Y(H * 0.28)}`} stroke={trunk} strokeWidth={W * 0.025} fill="none" strokeLinecap="round" />
          {palmCrown(W * 0.14, Y(H * 0.26), W * 0.13, jungle)}
          {/* Palmier dreapta */}
          <Path d={`M${W * 0.86},${Y(H)} Q${W * 0.92},${Y(H * 0.5)} ${W * 0.84},${Y(H * 0.3)}`} stroke={trunk} strokeWidth={W * 0.025} fill="none" strokeLinecap="round" />
          {palmCrown(W * 0.84, Y(H * 0.28), W * 0.12, jungle)}
          {/* Tufa de jungla in fata (seamless) */}
          <Path
            d={`M0,${Y(H)} L0,${Y(frontTopY)} Q${W * 0.25},${Y(H * 0.6)} ${W * 0.5},${Y(H * 0.76)} Q${W * 0.72},${Y(H * 0.88)} ${W},${Y(frontTopY)} L${W},${Y(H)} Z`}
            fill="url(#stJungle)"
          />
        </Svg>
      </View>
    );
  },
  // Sol = nisip + linie de apa umeda + scoici.
  renderGroundLayer: ({ width: W, height: H, color }) => {
    const sand = color;
    return (
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="stSand" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={shade(sand, 0.1)} />
            <Stop offset="1" stopColor={shade(sand, -0.12)} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill="url(#stSand)" />
        {/* Linie de apa umeda sus, cu spuma */}
        <Path d={`M0,${H * 0.16} Q${W * 0.25},${H * 0.1} ${W * 0.5},${H * 0.16} T${W},${H * 0.16}`} stroke="rgba(255,255,255,0.5)" strokeWidth={3} fill="none" />
        <Rect x={0} y={0} width={W} height={H * 0.13} fill={shade(sand, -0.08)} opacity={0.4} />
        {/* Scoici */}
        <Path d={`M${W * 0.2},${H * 0.55} q${W * 0.04},-${W * 0.04} ${W * 0.08},0 Z`} fill="#FFE3D6" />
        <Circle cx={W * 0.45} cy={H * 0.68} r={4} fill="#FFE3D6" />
        <Circle cx={W * 0.7} cy={H * 0.5} r={5} fill={shade(sand, 0.18)} />
        <Circle cx={W * 0.85} cy={H * 0.7} r={3.5} fill="#FFE3D6" />
      </Svg>
    );
  },
};

registerWorld(PACK);
