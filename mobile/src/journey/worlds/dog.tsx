// dog — parc urban cu loc de joaca. Blocuri cu geamuri in zare, tobogan +
// leagan + balansoar in plan mediu, alee + iarba + flori. Forme rafinate cu
// gradienturi, nu crude.

import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
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
      skyColor: '#9FD4E8',
      midColor: '#6FAE54',
      groundColor: '#6BA84A',
      accent: '#FF6B6B',
    },
    {
      key: 'evening',
      name: 'Apus in parc',
      skyColor: '#FFB174',
      midColor: '#5A7A4A',
      groundColor: '#577A3C',
      accent: '#FFD93D',
    },
  ],
  obstacles: [
    {
      key: 'hydrant',
      render: ({ width: W, height: H, color }) => {
        const red = color;
        return (
          <Svg width={W} height={H}>
            <Defs>
              <LinearGradient id="dogHyd" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={shade(red, -0.2)} />
                <Stop offset="0.5" stopColor={shade(red, 0.18)} />
                <Stop offset="1" stopColor={shade(red, -0.25)} />
              </LinearGradient>
            </Defs>
            {/* Corp hidrant rotunjit */}
            <Path
              d={`M${W * 0.34},${H * 0.95} L${W * 0.34},${H * 0.4} Q${W * 0.34},${H * 0.24} ${W * 0.5},${H * 0.24} Q${W * 0.66},${H * 0.24} ${W * 0.66},${H * 0.4} L${W * 0.66},${H * 0.95} Z`}
              fill="url(#dogHyd)"
            />
            {/* Capac dom */}
            <Path d={`M${W * 0.4},${H * 0.26} Q${W * 0.5},${H * 0.1} ${W * 0.6},${H * 0.26} Z`} fill={shade(red, -0.3)} />
            <Circle cx={W * 0.5} cy={H * 0.16} r={W * 0.05} fill={shade(red, 0.1)} />
            {/* Brate laterale */}
            <Rect x={W * 0.16} y={H * 0.46} width={W * 0.2} height={H * 0.12} rx={H * 0.04} fill={shade(red, -0.15)} />
            <Rect x={W * 0.64} y={H * 0.46} width={W * 0.2} height={H * 0.12} rx={H * 0.04} fill={shade(red, -0.15)} />
            {/* Baza */}
            <Rect x={W * 0.28} y={H * 0.92} width={W * 0.44} height={H * 0.08} rx={3} fill={shade(red, -0.35)} />
          </Svg>
        );
      },
    },
    {
      key: 'bench',
      render: ({ width: W, height: H, color }) => {
        const wood = '#A6743C';
        const metal = '#4A5560';
        return (
          <Svg width={W} height={H}>
            <Defs>
              <LinearGradient id="dogWood" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={shade(wood, 0.15)} />
                <Stop offset="1" stopColor={shade(wood, -0.15)} />
              </LinearGradient>
            </Defs>
            {/* Spatar */}
            <Rect x={W * 0.1} y={H * 0.4} width={W * 0.8} height={H * 0.1} rx={4} fill="url(#dogWood)" />
            <Rect x={W * 0.1} y={H * 0.54} width={W * 0.8} height={H * 0.1} rx={4} fill="url(#dogWood)" />
            {/* Sezut */}
            <Rect x={W * 0.1} y={H * 0.68} width={W * 0.8} height={H * 0.1} rx={4} fill="url(#dogWood)" />
            {/* Picioare */}
            <Rect x={W * 0.16} y={H * 0.4} width={W * 0.05} height={H * 0.55} fill={metal} />
            <Rect x={W * 0.79} y={H * 0.4} width={W * 0.05} height={H * 0.55} fill={metal} />
          </Svg>
        );
      },
    },
    {
      key: 'fence',
      render: ({ width: W, height: H, color }) => {
        const wood = '#B08A52';
        const dark = shade(wood, -0.22);
        const picket = (x: number) => (
          <Path
            key={x}
            d={`M${x},${H * 0.95} L${x},${H * 0.4} L${x + W * 0.06},${H * 0.3} L${x + W * 0.12},${H * 0.4} L${x + W * 0.12},${H * 0.95} Z`}
            fill={wood}
            stroke={dark}
            strokeWidth={1}
          />
        );
        return (
          <Svg width={W} height={H}>
            {picket(W * 0.06)}
            {picket(W * 0.28)}
            {picket(W * 0.5)}
            {picket(W * 0.72)}
            {/* Sipci orizontale */}
            <Rect x={0} y={H * 0.55} width={W} height={H * 0.06} fill={dark} opacity={0.85} />
            <Rect x={0} y={H * 0.78} width={W} height={H * 0.06} fill={dark} opacity={0.85} />
          </Svg>
        );
      },
    },
    {
      key: 'trashbin',
      render: ({ width: W, height: H, color }) => {
        const metal = '#3E6B52';
        return (
          <Svg width={W} height={H}>
            <Defs>
              <LinearGradient id="dogBin" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={shade(metal, -0.2)} />
                <Stop offset="0.5" stopColor={shade(metal, 0.15)} />
                <Stop offset="1" stopColor={shade(metal, -0.25)} />
              </LinearGradient>
            </Defs>
            {/* Cos usor conic */}
            <Path
              d={`M${W * 0.28},${H * 0.28} L${W * 0.72},${H * 0.28} L${W * 0.78},${H * 0.95} L${W * 0.22},${H * 0.95} Z`}
              fill="url(#dogBin)"
            />
            {/* Capac */}
            <Rect x={W * 0.22} y={H * 0.2} width={W * 0.56} height={H * 0.1} rx={4} fill={shade(metal, -0.3)} />
            <Rect x={W * 0.46} y={H * 0.1} width={W * 0.08} height={H * 0.1} fill={shade(metal, -0.2)} />
            {/* Simbol reciclare */}
            <Path d={`M${W * 0.42},${H * 0.5} l${W * 0.08},0 l-${W * 0.04},${H * 0.08} Z`} fill={shade(metal, 0.3)} opacity={0.8} />
          </Svg>
        );
      },
    },
  ],
  ambient: [
    {
      key: 'bird',
      layer: 'back',
      density: 2,
      yRange: [0.12, 0.3],
      sizeRange: [12, 20],
      speedRange: [-50, -28],
      render: ({ size }) => (
        <Svg width={size} height={size * 0.4}>
          <Path
            d={`M0,${size * 0.3} Q${size * 0.25},${size * 0.05} ${size * 0.5},${size * 0.28} Q${size * 0.75},${size * 0.05} ${size},${size * 0.3}`}
            stroke="rgba(45,42,74,0.6)"
            strokeWidth={2.5}
            fill="none"
          />
        </Svg>
      ),
    },
    {
      key: 'leaf',
      layer: 'fore',
      density: 3,
      yRange: [0.45, 0.7],
      sizeRange: [10, 16],
      speedRange: [-65, -35],
      render: ({ size }) => (
        <Svg width={size} height={size}>
          <Path
            d={`M${size * 0.5},0 Q${size},${size * 0.3} ${size * 0.5},${size} Q0,${size * 0.3} ${size * 0.5},0 Z`}
            fill="#E8A848"
            opacity={0.9}
          />
        </Svg>
      ),
    },
    {
      key: 'balloon',
      layer: 'mid',
      density: 1,
      yRange: [0.2, 0.45],
      sizeRange: [16, 24],
      speedRange: [-40, -22],
      render: ({ size }) => (
        <Svg width={size} height={size * 1.3}>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="#FF6B6B" />
          <Circle cx={size * 0.36} cy={size * 0.36} r={size * 0.14} fill="rgba(255,255,255,0.5)" />
          <Line x1={size / 2} y1={size} x2={size / 2} y2={size * 1.3} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
        </Svg>
      ),
    },
  ],
  // Back layer = blocuri de locuinte cu geamuri aprinse. SVG-ul are height
  // MULT mai mare decat slot-ul stratului (cu position:absolute si overflow
  // visible pe wrapper) ca sa cladirile sa coboare clar in jos prin mid +
  // ground, nu sa ramana suspendate.
  renderBackLayer: ({ width: W, height: H }) => {
    const block = '#8C97A8';
    const win = '#FFE7A8';
    const blockColors = [shade(block, 0.05), shade(block, -0.1), shade(block, 0.12), shade(block, -0.05)];
    const blocks = [
      { x: 0.02, w: 0.16, h: 0.55, c: blockColors[0] },
      { x: 0.2, w: 0.13, h: 0.75, c: blockColors[1] },
      { x: 0.35, w: 0.15, h: 0.45, c: blockColors[2] },
      { x: 0.52, w: 0.14, h: 0.65, c: blockColors[3] },
      { x: 0.68, w: 0.16, h: 0.5, c: blockColors[0] },
      { x: 0.86, w: 0.12, h: 0.7, c: blockColors[1] },
    ];
    // SVG ocupa height + extensie in jos. Wrapper-ul View are overflow visible
    // si height = H (cat slot-ul) → SVG-ul depaseste si elementele de jos
    // raman vizibile pe deasupra straturilor de mai jos.
    const extraDown = H * 3.5;
    const svgH = H + extraDown;
    return (
      <View style={{ width: W, height: H, overflow: 'visible' }}>
        <Svg
          width={W}
          height={svgH}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {blocks.flatMap((b, i) => {
            const bx = W * b.x;
            const bw = W * b.w;
            const visibleH = H * b.h;
            const by = H - visibleH; // varful in interiorul slot-ului
            const totalH = visibleH + extraDown; // pana jos
            const elems = [
              <Rect
                key={`b-${i}`}
                x={bx}
                y={by}
                width={bw}
                height={totalH}
                fill={b.c}
                opacity={0.85}
              />,
            ];
            const cols = 3;
            const rows = Math.max(2, Math.round(b.h * 6));
            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < cols; c++) {
                const lit = (r + c + i) % 3 === 0;
                elems.push(
                  <Rect
                    key={`w-${i}-${r}-${c}`}
                    x={bx + bw * (0.18 + c * 0.28)}
                    y={by + visibleH * (0.1 + r * (0.85 / rows))}
                    width={bw * 0.14}
                    height={visibleH * (0.5 / rows)}
                    fill={lit ? win : 'rgba(40,50,70,0.4)'}
                    opacity={0.85}
                  />,
                );
              }
            }
            return elems;
          })}
        </Svg>
      </View>
    );
  },
  // Mid layer = loc de joaca: tobogan + leagan + balansoar, intre copaci.
  renderMidLayer: ({ width: W, height: H, color }) => {
    const grass = color;
    const metal = '#C0504D';
    const yellow = '#F2C14E';
    const blue = '#4E8FD6';
    const frontTopY = H * 0.82;
    return (
      <Svg width={W} height={H} style={{ overflow: 'visible' }}>
        <Defs>
          <LinearGradient id="dogTree" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={shade(grass, 0.2)} />
            <Stop offset="1" stopColor={shade(grass, -0.1)} />
          </LinearGradient>
        </Defs>

        {/* Copac stanga */}
        <Rect x={W * 0.04} y={H * 0.45} width={W * 0.03} height={H * 0.4} fill="#7A5232" />
        <Circle cx={W * 0.055} cy={H * 0.4} r={W * 0.07} fill="url(#dogTree)" />

        {/* TOBOGAN */}
        {/* scara */}
        <Rect x={W * 0.16} y={H * 0.42} width={W * 0.02} height={H * 0.42} fill={metal} />
        <Rect x={W * 0.215} y={H * 0.42} width={W * 0.02} height={H * 0.42} fill={metal} />
        <Line x1={W * 0.16} y1={H * 0.52} x2={W * 0.235} y2={H * 0.52} stroke={metal} strokeWidth={2} />
        <Line x1={W * 0.16} y1={H * 0.62} x2={W * 0.235} y2={H * 0.62} stroke={metal} strokeWidth={2} />
        <Line x1={W * 0.16} y1={H * 0.72} x2={W * 0.235} y2={H * 0.72} stroke={metal} strokeWidth={2} />
        {/* platforma sus */}
        <Rect x={W * 0.16} y={H * 0.4} width={W * 0.09} height={H * 0.03} fill={yellow} />
        {/* panta tobogan */}
        <Path d={`M${W * 0.235},${H * 0.43} L${W * 0.33},${H * 0.83} L${W * 0.3},${H * 0.83} L${W * 0.21},${H * 0.45} Z`} fill={blue} />

        {/* LEAGAN — cadru A pe ambele parti + bara orizontala sus */}
        {/* picioare stanga (V) spre coltul stang al barei */}
        <Line x1={W * 0.4} y1={H * 0.84} x2={W * 0.45} y2={H * 0.42} stroke={metal} strokeWidth={3} strokeLinecap="round" />
        <Line x1={W * 0.46} y1={H * 0.84} x2={W * 0.45} y2={H * 0.42} stroke={metal} strokeWidth={3} strokeLinecap="round" />
        {/* picioare dreapta (V) spre coltul drept al barei */}
        <Line x1={W * 0.6} y1={H * 0.84} x2={W * 0.55} y2={H * 0.42} stroke={metal} strokeWidth={3} strokeLinecap="round" />
        <Line x1={W * 0.54} y1={H * 0.84} x2={W * 0.55} y2={H * 0.42} stroke={metal} strokeWidth={3} strokeLinecap="round" />
        {/* bara orizontala de sus */}
        <Line x1={W * 0.44} y1={H * 0.42} x2={W * 0.56} y2={H * 0.42} stroke={metal} strokeWidth={3} strokeLinecap="round" />
        {/* doua lanturi care atarna din bara, centrate */}
        <Line x1={W * 0.485} y1={H * 0.42} x2={W * 0.485} y2={H * 0.66} stroke="#555" strokeWidth={1.5} />
        <Line x1={W * 0.515} y1={H * 0.42} x2={W * 0.515} y2={H * 0.66} stroke="#555" strokeWidth={1.5} />
        {/* scaun */}
        <Rect x={W * 0.475} y={H * 0.66} width={W * 0.05} height={H * 0.025} rx={2} fill={yellow} />

        {/* BALANSOAR */}
        <Circle cx={W * 0.72} cy={H * 0.78} r={W * 0.015} fill={metal} />
        <Rect x={W * 0.62} y={H * 0.7} width={W * 0.2} height={H * 0.025} rx={3} fill={blue} transform={`rotate(-8 ${W * 0.72} ${H * 0.71})`} />

        {/* Copac dreapta */}
        <Rect x={W * 0.92} y={H * 0.45} width={W * 0.03} height={H * 0.4} fill="#7A5232" />
        <Circle cx={W * 0.935} cy={H * 0.4} r={W * 0.08} fill="url(#dogTree)" />

        {/* Linie de iarba in fata (seamless la frontTopY) */}
        <Path
          d={`M0,${H} L0,${frontTopY} Q${W * 0.5},${H * 0.76} ${W},${frontTopY} L${W},${H} Z`}
          fill={shade(grass, -0.05)}
        />
      </Svg>
    );
  },
  // Sol = alee de parc + iarba + flori.
  renderGroundLayer: ({ width: W, height: H, color }) => {
    const grass = color;
    const path = '#C9B486';
    return (
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="dogGround" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={shade(grass, 0.1)} />
            <Stop offset="1" stopColor={shade(grass, -0.12)} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill="url(#dogGround)" />
        {/* Alee */}
        <Rect x={0} y={H * 0.4} width={W} height={H * 0.22} fill={path} opacity={0.85} />
        <Path d={`M0,${H * 0.51} L${W},${H * 0.51}`} stroke={shade(path, -0.12)} strokeWidth={1.5} strokeDasharray="10 8" opacity={0.5} />
        {/* Flori */}
        <Circle cx={W * 0.16} cy={H * 0.78} r={3.5} fill="#FFC9D9" />
        <Circle cx={W * 0.16} cy={H * 0.78} r={1.5} fill="#FFE876" />
        <Circle cx={W * 0.4} cy={H * 0.82} r={3.5} fill="#C9D9FF" />
        <Circle cx={W * 0.62} cy={H * 0.78} r={3.5} fill="#FFC9D9" />
        <Circle cx={W * 0.84} cy={H * 0.82} r={3.5} fill="#D9FFC9" />
      </Svg>
    );
  },
};

registerWorld(PACK);
