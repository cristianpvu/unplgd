// groot — padure alien luxurianta, bioluminescenta noaptea. Copaci uriasi cu
// trunchiuri inalte si canopy stratificat, ferigi, plante stralucitoare.
// Forme organice cu curbe smooth (Path) si gradienturi.

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

const PACK: WorldPack = {
  slug: 'groot',
  name: 'Padurea bioluminescenta',
  biomes: [
    {
      key: 'day',
      name: 'Padurea adanca',
      skyColor: '#8FCFC2',
      midColor: '#4A8C3A',
      groundColor: '#2E5C28',
      accent: '#FF6B9D',
    },
    {
      key: 'night',
      name: 'Padurea stralucitoare',
      skyColor: '#162A3A',
      midColor: '#23503E',
      groundColor: '#19281E',
      accent: '#9BFFB8',
    },
  ],
  obstacles: [
    {
      key: 'giant_root',
      render: ({ width: W, height: H, color }) => {
        const wood = '#6B4A2A';
        return (
          <Svg width={W} height={H}>
            <Defs>
              <LinearGradient id="grRoot" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={shade(wood, 0.18)} />
                <Stop offset="1" stopColor={shade(wood, -0.22)} />
              </LinearGradient>
            </Defs>
            {/* Radacina arcuita care iese si reintra in pamant */}
            <Path
              d={`M${W * 0.05},${H} Q${W * 0.15},${H * 0.3} ${W * 0.5},${H * 0.28} Q${W * 0.85},${H * 0.3} ${W * 0.95},${H} L${W * 0.78},${H} Q${W * 0.7},${H * 0.5} ${W * 0.5},${H * 0.48} Q${W * 0.3},${H * 0.5} ${W * 0.22},${H} Z`}
              fill="url(#grRoot)"
            />
            {/* Noduri */}
            <Ellipse cx={W * 0.5} cy={H * 0.36} rx={W * 0.06} ry={W * 0.04} fill={shade(wood, -0.3)} />
            <Circle cx={W * 0.3} cy={H * 0.62} r={W * 0.03} fill={shade(wood, -0.3)} />
          </Svg>
        );
      },
    },
    {
      key: 'mushroom',
      render: ({ width: W, height: H, color }) => {
        const cap = color;
        const stem = '#EDE3CC';
        return (
          <Svg width={W} height={H}>
            <Defs>
              <LinearGradient id="grCap" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={shade(cap, 0.22)} />
                <Stop offset="1" stopColor={shade(cap, -0.12)} />
              </LinearGradient>
            </Defs>
            {/* Picior */}
            <Path d={`M${W * 0.4},${H * 0.45} Q${W * 0.38},${H * 0.9} ${W * 0.42},${H} L${W * 0.58},${H} Q${W * 0.62},${H * 0.9} ${W * 0.6},${H * 0.45} Z`} fill={stem} />
            {/* Palarie boltita */}
            <Path d={`M${W * 0.12},${H * 0.46} Q${W * 0.5},${H * 0.0} ${W * 0.88},${H * 0.46} Q${W * 0.5},${H * 0.56} ${W * 0.12},${H * 0.46} Z`} fill="url(#grCap)" />
            {/* Buline */}
            <Circle cx={W * 0.35} cy={H * 0.3} r={W * 0.05} fill={shade(cap, 0.35)} />
            <Circle cx={W * 0.55} cy={H * 0.24} r={W * 0.045} fill={shade(cap, 0.35)} />
            <Circle cx={W * 0.68} cy={H * 0.34} r={W * 0.04} fill={shade(cap, 0.35)} />
          </Svg>
        );
      },
    },
    {
      key: 'vine',
      render: ({ width: W, height: H, color }) => {
        const leaf = color;
        const stem = shade('#3A6B2A', 0);
        return (
          <Svg width={W} height={H}>
            {/* Liana care atarna serpuit */}
            <Path d={`M${W * 0.5},0 Q${W * 0.3},${H * 0.3} ${W * 0.55},${H * 0.5} Q${W * 0.78},${H * 0.72} ${W * 0.45},${H}`} stroke={stem} strokeWidth={W * 0.04} fill="none" strokeLinecap="round" />
            {/* Frunze in forma de inima de-a lungul */}
            <Path d={`M${W * 0.4},${H * 0.28} q-${W * 0.08},-${W * 0.06} 0,-${W * 0.12} q${W * 0.08},${W * 0.06} 0,${W * 0.12} Z`} fill={leaf} />
            <Path d={`M${W * 0.6},${H * 0.5} q${W * 0.08},-${W * 0.06} 0,-${W * 0.12} q-${W * 0.08},${W * 0.06} 0,${W * 0.12} Z`} fill={leaf} />
            <Path d={`M${W * 0.55},${H * 0.74} q-${W * 0.08},-${W * 0.06} 0,-${W * 0.12} q${W * 0.08},${W * 0.06} 0,${W * 0.12} Z`} fill={leaf} />
          </Svg>
        );
      },
    },
    {
      key: 'bloom',
      render: ({ width: W, height: H, color }) => {
        const petal = color;
        const stem = '#3A6B2A';
        return (
          <Svg width={W} height={H}>
            <Defs>
              <LinearGradient id="grBloom" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={shade(petal, 0.2)} />
                <Stop offset="1" stopColor={shade(petal, -0.1)} />
              </LinearGradient>
            </Defs>
            {/* Tulpina */}
            <Rect x={W * 0.46} y={H * 0.5} width={W * 0.08} height={H * 0.5} fill={stem} />
            {/* 5 petale via elipse rotite in jurul centrului */}
            {[0, 72, 144, 216, 288].map((a) => {
              const rad = (a * Math.PI) / 180;
              const cx = W * 0.5 + Math.cos(rad) * W * 0.18;
              const cy = H * 0.38 + Math.sin(rad) * W * 0.18;
              return <Ellipse key={a} cx={cx} cy={cy} rx={W * 0.13} ry={W * 0.08} fill="url(#grBloom)" />;
            })}
            <Circle cx={W * 0.5} cy={H * 0.38} r={W * 0.1} fill={shade(petal, 0.35)} />
          </Svg>
        );
      },
    },
  ],
  ambient: [
    {
      key: 'spore',
      layer: 'back',
      density: 6,
      yRange: [0.15, 0.5],
      sizeRange: [4, 8],
      speedRange: [-24, -10],
      render: ({ size }) => (
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="rgba(255,255,255,0.45)" />
          <Circle cx={size / 2} cy={size / 2} r={size / 3} fill="rgba(207,255,207,0.7)" />
        </Svg>
      ),
    },
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
    {
      key: 'butterfly',
      layer: 'fore',
      density: 2,
      yRange: [0.5, 0.7],
      sizeRange: [16, 24],
      speedRange: [-65, -35],
      render: ({ size }) => (
        <Svg width={size} height={size}>
          <Ellipse cx={size * 0.32} cy={size * 0.45} rx={size * 0.22} ry={size * 0.28} fill="#FF6BC9" opacity={0.85} />
          <Ellipse cx={size * 0.68} cy={size * 0.45} rx={size * 0.22} ry={size * 0.28} fill="#9BFFC9" opacity={0.85} />
          <Rect x={size * 0.47} y={size * 0.3} width={size * 0.06} height={size * 0.5} fill="#3A2A4A" rx={2} />
        </Svg>
      ),
    },
  ],
  // Cloud layer = ceata verzuie sus, blanda.
  renderCloudsLayer: ({ width: W }) => {
    const H = 70;
    return (
      <Svg width={W} height={H}>
        <Ellipse cx={W * 0.22} cy={32} rx={40} ry={18} fill="rgba(180,220,200,0.4)" />
        <Ellipse cx={W * 0.55} cy={26} rx={44} ry={20} fill="rgba(180,220,200,0.35)" />
        <Ellipse cx={W * 0.84} cy={32} rx={36} ry={16} fill="rgba(180,220,200,0.4)" />
      </Svg>
    );
  },
  // FARA back layer separat — brazii sunt in mid layer (ancorati de aceeasi
  // linie iarba ca si copacii) ca sa nu mai pluteasca.
  // Mid layer = padure DENSA. Brazi in 3 trepte (clasic) in spate + copaci
  // clasici (trunchi subtire + coroana mare) in fata. Toti ancorati de baseY.
  renderMidLayer: ({ width: W, height: H, color }) => {
    const canopy = color;
    const trunk = '#5A3E22';
    const baseY = H * 0.95;
    const firColor = shade(canopy, -0.28);
    const firLight = shade(canopy, -0.18);

    // 12 brazi in spate, distribuiti dens, in 3 trepte (silueta clasica).
    const firs = [
      { x: 0.04, h: 0.5 },
      { x: 0.12, h: 0.55 },
      { x: 0.2, h: 0.46 },
      { x: 0.28, h: 0.6 },
      { x: 0.36, h: 0.48 },
      { x: 0.44, h: 0.54 },
      { x: 0.52, h: 0.5 },
      { x: 0.6, h: 0.58 },
      { x: 0.68, h: 0.46 },
      { x: 0.76, h: 0.55 },
      { x: 0.84, h: 0.5 },
      { x: 0.94, h: 0.52 },
    ];

    // 7 copaci in fata — trunchi SUBTIRE (1.2% din W) + coroana MARE (raza
    // 0.22-0.3 din H, mult mai mare ca trunchiul).
    const trees = [
      { x: 0.08, trunkH: 0.32, crownR: 0.22 },
      { x: 0.22, trunkH: 0.38, crownR: 0.26 },
      { x: 0.36, trunkH: 0.34, crownR: 0.24 },
      { x: 0.5, trunkH: 0.4, crownR: 0.28 },
      { x: 0.64, trunkH: 0.32, crownR: 0.22 },
      { x: 0.78, trunkH: 0.4, crownR: 0.28 },
      { x: 0.92, trunkH: 0.34, crownR: 0.24 },
    ];

    // Brad in 3 trepte: trei triunghiuri stivuite, fiecare suprapus peste
    // urmatorul cu 30%. trunkH = mic la baza.
    const renderFir = (cx: number, totalH: number, key: string) => {
      const trunkH = totalH * 0.08;
      const tipY = baseY - totalH;
      const t1Y = tipY + totalH * 0.45;
      const t2Y = tipY + totalH * 0.72;
      const treeBase = baseY - trunkH;
      const half1 = totalH * 0.16; // tier sus, ingust
      const half2 = totalH * 0.22; // tier mediu
      const half3 = totalH * 0.28; // tier jos, lat
      return [
        // tier 3 (jos, cel mai lat)
        <Path
          key={`${key}-3`}
          d={`M${cx},${t1Y} L${cx - half3},${treeBase} L${cx + half3},${treeBase} Z`}
          fill={firColor}
        />,
        // tier 2 (mijloc)
        <Path
          key={`${key}-2`}
          d={`M${cx},${tipY + totalH * 0.22} L${cx - half2},${t2Y} L${cx + half2},${t2Y} Z`}
          fill={firLight}
        />,
        // tier 1 (sus, varful)
        <Path
          key={`${key}-1`}
          d={`M${cx},${tipY} L${cx - half1},${tipY + totalH * 0.45} L${cx + half1},${tipY + totalH * 0.45} Z`}
          fill={firColor}
        />,
        // trunchi mic
        <Rect
          key={`${key}-t`}
          x={cx - W * 0.005}
          y={treeBase}
          width={W * 0.01}
          height={trunkH}
          fill={trunk}
        />,
      ];
    };

    return (
      <Svg width={W} height={H} style={{ overflow: 'visible' }}>
        <Defs>
          <LinearGradient id="grLeaf" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={shade(canopy, 0.18)} />
            <Stop offset="1" stopColor={shade(canopy, -0.2)} />
          </LinearGradient>
        </Defs>

        {/* Brazi in spate */}
        {firs.flatMap((f, i) => renderFir(W * f.x, H * f.h, `f-${i}`))}

        {/* Copaci in fata */}
        {trees.flatMap((t, i) => {
          const cx = W * t.x;
          const trunkH = H * t.trunkH;
          const r = H * t.crownR;
          const trunkTopY = baseY - trunkH;
          // Coroana se suprapune cu varful trunchiului (cy putin sub topY)
          // ca trunchiul sa pareca infipt in coroana, nu separat.
          const crownCy = trunkTopY - r * 0.45;
          // Trunchi SUBTIRE — sa fie clar mai ingust decat coroana.
          const trunkW = W * 0.013;
          return [
            <Rect
              key={`tr-${i}`}
              x={cx - trunkW / 2}
              y={trunkTopY}
              width={trunkW}
              height={trunkH}
              fill={trunk}
            />,
            <Circle key={`cr-${i}`} cx={cx} cy={crownCy} r={r} fill="url(#grLeaf)" />,
          ];
        })}

        {/* Banda iarba in fata, acopera bazele */}
        <Rect x={0} y={baseY - 2} width={W} height={H - baseY + 2} fill={shade(canopy, -0.2)} />
      </Svg>
    );
  },
  // Sol = muschi + plante stralucitoare + ferigi.
  renderGroundLayer: ({ width: W, height: H, color }) => {
    const moss = color;
    const glow = '#9BFFB8';
    return (
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="grGround" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={shade(moss, 0.12)} />
            <Stop offset="1" stopColor={shade(moss, -0.12)} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill="url(#grGround)" />
        {/* Ferigi mici (arce) */}
        <Path d={`M${W * 0.1},${H * 0.85} Q${W * 0.13},${H * 0.5} ${W * 0.18},${H * 0.55}`} stroke={shade(moss, 0.2)} strokeWidth={2} fill="none" />
        <Path d={`M${W * 0.1},${H * 0.85} Q${W * 0.08},${H * 0.55} ${W * 0.04},${H * 0.6}`} stroke={shade(moss, 0.2)} strokeWidth={2} fill="none" />
        {/* Plante stralucitoare */}
        <Circle cx={W * 0.3} cy={H * 0.55} r={4} fill={glow} opacity={0.7} />
        <Circle cx={W * 0.55} cy={H * 0.68} r={5} fill={glow} opacity={0.7} />
        <Circle cx={W * 0.78} cy={H * 0.5} r={4} fill={glow} opacity={0.7} />
      </Svg>
    );
  },
};

registerWorld(PACK);
