// World pack pt darth-vader — galaxie intunecata cu asteroizi, statii stelare,
// lasere in fundal. Foloseste de registry doar daca PetSpecies.slug e
// "darth-vader" — altfel pet-ul vede DEFAULT_WORLD.

import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Line,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
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
    // Asteroid — roca volumetrica cu gradient radial (lumina sus-stanga, umbra
    // jos-dreapta), cratere clare cu inel mai deschis (rim) si glow rosietic
    // jos ca si cum arde de la coborare.
    {
      key: 'asteroid',
      render: ({ width: W, height: H }) => {
        const rock = '#7A6450';
        const dark = shade(rock, -0.25);
        const light = shade(rock, 0.18);
        // Crater = cerc inchis + arc deschis sus = volum.
        const crater = (cx: number, cy: number, r: number, k: string) => [
          <Circle key={`${k}-d`} cx={cx} cy={cy} r={r} fill={dark} />,
          <Path
            key={`${k}-r`}
            d={`M${cx - r},${cy} a${r},${r} 0 0 1 ${2 * r},0`}
            stroke={light}
            strokeWidth={r * 0.3}
            fill="none"
            opacity={0.6}
          />,
        ];
        return (
          <Svg width={W} height={H}>
            <Defs>
              <RadialGradient id="vAst" cx="35%" cy="35%" r="65%">
                <Stop offset="0" stopColor={light} />
                <Stop offset="0.55" stopColor={rock} />
                <Stop offset="1" stopColor={dark} />
              </RadialGradient>
              <RadialGradient id="vAstGlow" cx="50%" cy="100%" r="60%">
                <Stop offset="0" stopColor="#FF6A3A" stopOpacity="0.75" />
                <Stop offset="1" stopColor="#FF6A3A" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            {/* Halou de incalzire jos */}
            <Ellipse cx={W * 0.5} cy={H * 0.98} rx={W * 0.42} ry={H * 0.18} fill="url(#vAstGlow)" />
            {/* Corpul asteroidului — forma neregulata cu curbe smooth */}
            <Path
              d={`M${W * 0.5},${H * 0.08}
                  Q${W * 0.85},${H * 0.12} ${W * 0.92},${H * 0.4}
                  Q${W * 0.98},${H * 0.65} ${W * 0.78},${H * 0.88}
                  Q${W * 0.5},${H * 0.98} ${W * 0.28},${H * 0.86}
                  Q${W * 0.06},${H * 0.62} ${W * 0.1},${H * 0.36}
                  Q${W * 0.18},${H * 0.12} ${W * 0.5},${H * 0.08} Z`}
              fill="url(#vAst)"
            />
            {/* Cratere */}
            {crater(W * 0.34, H * 0.42, W * 0.09, 'c1')}
            {crater(W * 0.65, H * 0.55, W * 0.06, 'c2')}
            {crater(W * 0.5, H * 0.75, W * 0.04, 'c3')}
          </Svg>
        );
      },
    },

    // Satelit — clasic stil "Death Star messenger probe": corp central
    // hexagonal cu detalii + DOUA PANOURI SOLARE mari laterale (cu grid de
    // celule albastre) + antena parabolica sus.
    {
      key: 'satellite',
      render: ({ width: W, height: H }) => {
        const metal = '#B0B5C0';
        const dark = '#3F4452';
        const cell = '#2B5BB0';
        const cellHi = '#4A8BE8';
        // Grid de celule pentru un panou solar — cellRows x cellCols.
        const solarPanel = (
          x: number,
          y: number,
          pw: number,
          ph: number,
          key: string,
        ) => {
          const elems: React.ReactNode[] = [
            <Rect key={`${key}-bg`} x={x} y={y} width={pw} height={ph} fill={dark} />,
            <Rect
              key={`${key}-fr`}
              x={x}
              y={y}
              width={pw}
              height={ph}
              fill="none"
              stroke="#222"
              strokeWidth={1}
            />,
          ];
          const cols = 4;
          const rows = 2;
          const padX = pw * 0.06;
          const padY = ph * 0.1;
          const cw = (pw - padX * (cols + 1)) / cols;
          const ch = (ph - padY * (rows + 1)) / rows;
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              elems.push(
                <Rect
                  key={`${key}-${r}-${c}`}
                  x={x + padX + c * (cw + padX)}
                  y={y + padY + r * (ch + padY)}
                  width={cw}
                  height={ch}
                  fill={(r + c) % 2 === 0 ? cell : cellHi}
                />,
              );
            }
          }
          return elems;
        };
        return (
          <Svg width={W} height={H}>
            <Defs>
              <LinearGradient id="vSatBody" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={shade(metal, -0.25)} />
                <Stop offset="0.5" stopColor={shade(metal, 0.15)} />
                <Stop offset="1" stopColor={shade(metal, -0.3)} />
              </LinearGradient>
            </Defs>
            {/* Bratul antenei (sus) */}
            <Line x1={W * 0.5} y1={H * 0.18} x2={W * 0.5} y2={H * 0.32} stroke={dark} strokeWidth={3} />
            {/* Antena parabolica (cup) */}
            <Path
              d={`M${W * 0.36},${H * 0.18} Q${W * 0.5},${H * 0.02} ${W * 0.64},${H * 0.18} Q${W * 0.5},${H * 0.08} ${W * 0.36},${H * 0.18} Z`}
              fill={metal}
              stroke={dark}
              strokeWidth={1}
            />
            <Circle cx={W * 0.5} cy={H * 0.12} r={W * 0.025} fill={dark} />
            {/* Tija de la corp la antena */}
            {/* Panourile solare laterale + tije scurte */}
            <Rect x={W * 0.32} y={H * 0.48} width={W * 0.04} height={H * 0.04} fill={dark} />
            <Rect x={W * 0.64} y={H * 0.48} width={W * 0.04} height={H * 0.04} fill={dark} />
            {solarPanel(W * 0.03, H * 0.36, W * 0.3, H * 0.28, 'L')}
            {solarPanel(W * 0.67, H * 0.36, W * 0.3, H * 0.28, 'R')}
            {/* Corp central — cilindric cu margini */}
            <Rect x={W * 0.36} y={H * 0.32} width={W * 0.28} height={H * 0.46} rx={W * 0.04} fill="url(#vSatBody)" />
            <Rect x={W * 0.36} y={H * 0.38} width={W * 0.28} height={H * 0.04} fill={dark} opacity={0.6} />
            <Rect x={W * 0.36} y={H * 0.68} width={W * 0.28} height={H * 0.04} fill={dark} opacity={0.6} />
            {/* Lentila / fereastra centrala */}
            <Circle cx={W * 0.5} cy={H * 0.55} r={W * 0.06} fill={shade(cellHi, -0.1)} />
            <Circle cx={W * 0.48} cy={H * 0.53} r={W * 0.02} fill="#FFFFFF" opacity={0.7} />
            {/* Lumini de stare */}
            <Circle cx={W * 0.42} cy={H * 0.76} r={W * 0.012} fill="#FF4040" />
            <Circle cx={W * 0.58} cy={H * 0.76} r={W * 0.012} fill="#40FF80" />
          </Svg>
        );
      },
    },

    // Cristal kyber — prisma verticala cu fete reflectorizante si glow puternic
    // (halou + lumina centrala). Recognoscibil ca "cristal energetic".
    {
      key: 'energybarrier',
      render: ({ width: W, height: H, color }) => {
        const c = color;
        const dark = shade(c, -0.3);
        const light = shade(c, 0.35);
        return (
          <Svg width={W} height={H}>
            <Defs>
              <LinearGradient id="vCryst" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={dark} />
                <Stop offset="0.5" stopColor={light} />
                <Stop offset="1" stopColor={dark} />
              </LinearGradient>
              <RadialGradient id="vCrystGlow" cx="50%" cy="55%" r="55%">
                <Stop offset="0" stopColor={light} stopOpacity="0.9" />
                <Stop offset="0.6" stopColor={c} stopOpacity="0.45" />
                <Stop offset="1" stopColor={c} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            {/* Halou de energie */}
            <Circle cx={W * 0.5} cy={H * 0.55} r={W * 0.6} fill="url(#vCrystGlow)" />
            {/* Cristal hexagonal vertical: 6 puncte → forma diamant alungit */}
            <Polygon
              points={`${W * 0.5},${H * 0.05} ${W * 0.72},${H * 0.22} ${W * 0.72},${H * 0.78} ${W * 0.5},${H * 0.95} ${W * 0.28},${H * 0.78} ${W * 0.28},${H * 0.22}`}
              fill="url(#vCryst)"
              stroke={shade(c, 0.5)}
              strokeWidth={1.5}
            />
            {/* Reflexie centrala stralucitoare */}
            <Polygon
              points={`${W * 0.5},${H * 0.05} ${W * 0.5},${H * 0.95} ${W * 0.4},${H * 0.78} ${W * 0.4},${H * 0.22}`}
              fill={light}
              opacity={0.7}
            />
            {/* Punct super-bright in centru */}
            <Ellipse cx={W * 0.5} cy={H * 0.5} rx={W * 0.04} ry={W * 0.12} fill="#FFFFFF" opacity={0.85} />
          </Svg>
        );
      },
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
