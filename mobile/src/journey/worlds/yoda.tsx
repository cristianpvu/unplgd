// baby-yoda — desertul Tatooine. Dune line, sori gemeni (binary sunset iconic),
// mesa-uri stancoase in zare, vaporizatoare de umiditate, schelet de krayt
// dragon. Forme cu curbe smooth (Path Q) si gradienturi, nu poligoane crude.

import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { registerWorld } from './registry';
import { shade } from './util';
import type { WorldPack } from './types';

const PACK: WorldPack = {
  // Trebuie sa coincida cu PetSpecies.slug din DB ('baby-yoda').
  slug: 'baby-yoda',
  name: 'Desertul Tatooine',
  biomes: [
    {
      key: 'day',
      name: 'Desertul in arsita',
      skyColor: '#CFD8D0',
      midColor: '#C99A5B',
      groundColor: '#E0B873',
      accent: '#E67E22',
    },
    {
      key: 'binary-sunset',
      name: 'Apusul celor doi sori',
      skyColor: '#F0A35A',
      midColor: '#8A5A3C',
      groundColor: '#C28A4E',
      accent: '#FFD93D',
    },
  ],
  obstacles: [
    {
      key: 'boulder',
      render: ({ width: W, height: H, color }) => {
        const rock = '#B07A45';
        return (
          <Svg width={W} height={H}>
            <Defs>
              <LinearGradient id="tatBoulder" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={shade(rock, 0.18)} />
                <Stop offset="1" stopColor={shade(rock, -0.22)} />
              </LinearGradient>
            </Defs>
            {/* Bolovan rotunjit cu varf neted */}
            <Path
              d={`M${W * 0.12},${H} Q${W * 0.04},${H * 0.55} ${W * 0.28},${H * 0.32} Q${W * 0.5},${H * 0.12} ${W * 0.72},${H * 0.3} Q${W * 0.96},${H * 0.5} ${W * 0.88},${H} Z`}
              fill="url(#tatBoulder)"
            />
            {/* Crapaturi subtile */}
            <Path d={`M${W * 0.45},${H * 0.3} L${W * 0.4},${H * 0.7}`} stroke={shade(rock, -0.35)} strokeWidth={2} fill="none" opacity={0.5} />
            <Path d={`M${W * 0.6},${H * 0.4} L${W * 0.66},${H * 0.75}`} stroke={shade(rock, -0.35)} strokeWidth={1.5} fill="none" opacity={0.4} />
          </Svg>
        );
      },
    },
    {
      key: 'vaporator',
      render: ({ width: W, height: H, color }) => {
        const metal = '#9A9488';
        return (
          <Svg width={W} height={H}>
            <Defs>
              <LinearGradient id="tatVap" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={shade(metal, -0.2)} />
                <Stop offset="0.5" stopColor={shade(metal, 0.15)} />
                <Stop offset="1" stopColor={shade(metal, -0.25)} />
              </LinearGradient>
            </Defs>
            {/* Coloana centrala a vaporizatorului de umiditate */}
            <Rect x={W * 0.43} y={H * 0.18} width={W * 0.14} height={H * 0.78} rx={W * 0.04} fill="url(#tatVap)" />
            {/* Capac conic */}
            <Path d={`M${W * 0.4},${H * 0.2} L${W * 0.5},${H * 0.06} L${W * 0.6},${H * 0.2} Z`} fill={shade(metal, 0.1)} />
            {/* Aripioare verticale (tije) */}
            <Rect x={W * 0.34} y={H * 0.28} width={W * 0.03} height={H * 0.55} fill={shade(metal, -0.1)} />
            <Rect x={W * 0.63} y={H * 0.28} width={W * 0.03} height={H * 0.55} fill={shade(metal, -0.1)} />
            {/* Inele */}
            <Rect x={W * 0.4} y={H * 0.4} width={W * 0.2} height={H * 0.03} fill={shade(metal, -0.3)} />
            <Rect x={W * 0.4} y={H * 0.62} width={W * 0.2} height={H * 0.03} fill={shade(metal, -0.3)} />
          </Svg>
        );
      },
    },
    {
      key: 'bones',
      render: ({ width: W, height: H, color }) => {
        const bone = '#E8DFC8';
        const dark = shade(bone, -0.2);
        return (
          <Svg width={W} height={H}>
            {/* Coaste de krayt dragon — arce osoase iesind din nisip */}
            <Path d={`M${W * 0.2},${H} Q${W * 0.1},${H * 0.35} ${W * 0.32},${H * 0.25}`} stroke={bone} strokeWidth={W * 0.07} fill="none" strokeLinecap="round" />
            <Path d={`M${W * 0.4},${H} Q${W * 0.32},${H * 0.25} ${W * 0.5},${H * 0.15}`} stroke={bone} strokeWidth={W * 0.08} fill="none" strokeLinecap="round" />
            <Path d={`M${W * 0.6},${H} Q${W * 0.68},${H * 0.25} ${W * 0.5},${H * 0.15}`} stroke={bone} strokeWidth={W * 0.08} fill="none" strokeLinecap="round" />
            <Path d={`M${W * 0.8},${H} Q${W * 0.9},${H * 0.35} ${W * 0.68},${H * 0.25}`} stroke={dark} strokeWidth={W * 0.07} fill="none" strokeLinecap="round" />
            {/* Coloana */}
            <Path d={`M${W * 0.32},${H * 0.25} L${W * 0.68},${H * 0.25}`} stroke={bone} strokeWidth={W * 0.05} strokeLinecap="round" />
          </Svg>
        );
      },
    },
  ],
  ambient: [
    // Pasare de prada (ca un dewback flying) departe in cer.
    {
      key: 'raptor',
      layer: 'back',
      density: 1,
      yRange: [0.12, 0.28],
      sizeRange: [16, 24],
      speedRange: [-40, -22],
      render: ({ size }) => (
        <Svg width={size} height={size * 0.4}>
          <Path
            d={`M0,${size * 0.3} Q${size * 0.25},${size * 0.02} ${size * 0.5},${size * 0.28} Q${size * 0.75},${size * 0.02} ${size},${size * 0.3}`}
            stroke="rgba(80,60,40,0.7)"
            strokeWidth={2.5}
            fill="none"
          />
        </Svg>
      ),
    },
    // Praf de nisip purtat de vant aproape de sol.
    {
      key: 'sand',
      layer: 'fore',
      density: 6,
      yRange: [0.6, 0.85],
      sizeRange: [3, 7],
      speedRange: [-110, -60],
      render: ({ size }) => (
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="rgba(220,190,140,0.6)" />
        </Svg>
      ),
    },
    // Valuri de caldura (heat shimmer) — cercuri palide care plutesc lent.
    {
      key: 'haze',
      layer: 'mid',
      density: 3,
      yRange: [0.5, 0.65],
      sizeRange: [40, 80],
      speedRange: [-20, -8],
      render: ({ size }) => (
        <Svg width={size} height={size * 0.3}>
          <Ellipse cx={size / 2} cy={size * 0.15} rx={size / 2} ry={size * 0.12} fill="rgba(255,240,210,0.15)" />
        </Svg>
      ),
    },
  ],
  // Cloud layer = sorii gemeni + cer cu haze. Tatooine n-are nori grei.
  renderCloudsLayer: ({ width: W }) => {
    const H = 120;
    return (
      <Svg width={W} height={H}>
        <Defs>
          <RadialGradient id="tatSunA" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFF3C8" stopOpacity="1" />
            <Stop offset="0.6" stopColor="#FFD27A" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#FFB04A" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="tatSunB" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFE0A0" stopOpacity="1" />
            <Stop offset="0.6" stopColor="#FF9A52" stopOpacity="0.85" />
            <Stop offset="1" stopColor="#FF7A3A" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {/* Soarele mare */}
        <Circle cx={W * 0.66} cy={H * 0.42} r={52} fill="url(#tatSunA)" />
        <Circle cx={W * 0.66} cy={H * 0.42} r={28} fill="#FFF6D8" />
        {/* Al doilea soare, mai mic, langa */}
        <Circle cx={W * 0.78} cy={H * 0.58} r={34} fill="url(#tatSunB)" />
        <Circle cx={W * 0.78} cy={H * 0.58} r={16} fill="#FFE7B0" />
      </Svg>
    );
  },
  // Back layer = mesa-uri (butte cu varf plat) in zare, cu gradient de distanta.
  renderBackLayer: ({ width: W, height: H }) => {
    const mesa = '#B98A5A';
    return (
      <Svg width={W} height={H} style={{ overflow: 'visible' }}>
        <Defs>
          <LinearGradient id="tatMesa" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={shade(mesa, 0.1)} />
            <Stop offset="1" stopColor={shade(mesa, -0.15)} />
          </LinearGradient>
        </Defs>
        {/* Mesa stanga (varf plat) */}
        <Path
          d={`M0,${H} L0,${H * 0.62} L${W * 0.06},${H * 0.5} L${W * 0.22},${H * 0.5} L${W * 0.27},${H * 0.66} L${W * 0.34},${H} Z`}
          fill="url(#tatMesa)"
          opacity={0.85}
        />
        {/* Mesa dreapta, mai joasa */}
        <Path
          d={`M${W * 0.55},${H} L${W * 0.6},${H * 0.7} L${W * 0.72},${H * 0.62} L${W * 0.86},${H * 0.62} L${W * 0.9},${H * 0.72} L${W * 0.96},${H} Z`}
          fill="url(#tatMesa)"
          opacity={0.7}
        />
      </Svg>
    );
  },
  // Mid layer = dune line smooth (Path Q) + un vaporizator silueta + cupola homestead.
  renderMidLayer: ({ width: W, height: H, color }) => {
    const dune = color;
    return (
      <Svg width={W} height={H} style={{ overflow: 'visible' }}>
        <Defs>
          <LinearGradient id="tatDuneBack" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={shade(dune, 0.12)} />
            <Stop offset="1" stopColor={shade(dune, -0.1)} />
          </LinearGradient>
          <LinearGradient id="tatDuneFront" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={shade(dune, 0.05)} />
            <Stop offset="1" stopColor={shade(dune, -0.2)} />
          </LinearGradient>
        </Defs>
        {/* Dune din spate — curbe smooth, seamless la y constant (H*0.6) */}
        <Path
          d={`M0,${H} L0,${H * 0.6} Q${W * 0.2},${H * 0.4} ${W * 0.4},${H * 0.55} Q${W * 0.6},${H * 0.68} ${W * 0.78},${H * 0.5} Q${W * 0.9},${H * 0.42} ${W},${H * 0.6} L${W},${H} Z`}
          fill="url(#tatDuneBack)"
        />
        {/* Cupola homestead (casa Lars) pe creasta din spate */}
        <Path d={`M${W * 0.12},${H * 0.55} a${W * 0.05},${W * 0.05} 0 0 1 ${W * 0.1},0 Z`} fill={shade(dune, -0.25)} opacity={0.7} />
        {/* Vaporizator silueta departe */}
        <Rect x={W * 0.7} y={H * 0.34} width={W * 0.015} height={H * 0.2} fill={shade(dune, -0.3)} opacity={0.6} />
        {/* Dune din fata — seamless la y constant (H*0.8) */}
        <Path
          d={`M0,${H} L0,${H * 0.8} Q${W * 0.25},${H * 0.62} ${W * 0.5},${H * 0.78} Q${W * 0.72},${H * 0.9} ${W * 0.88},${H * 0.72} Q${W * 0.95},${H * 0.66} ${W},${H * 0.8} L${W},${H} Z`}
          fill="url(#tatDuneFront)"
        />
      </Svg>
    );
  },
  // Sol = nisip cu ondulatii (ripple) si pietricele.
  renderGroundLayer: ({ width: W, height: H, color }) => {
    const sand = color;
    return (
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="tatSand" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={shade(sand, 0.08)} />
            <Stop offset="1" stopColor={shade(sand, -0.12)} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill="url(#tatSand)" />
        {/* Ondulatii de nisip — linii curbe subtiri */}
        <Path d={`M0,${H * 0.35} Q${W * 0.25},${H * 0.28} ${W * 0.5},${H * 0.35} T${W},${H * 0.35}`} stroke={shade(sand, -0.12)} strokeWidth={1.5} fill="none" opacity={0.5} />
        <Path d={`M0,${H * 0.6} Q${W * 0.3},${H * 0.52} ${W * 0.6},${H * 0.6} T${W},${H * 0.6}`} stroke={shade(sand, -0.12)} strokeWidth={1.5} fill="none" opacity={0.4} />
        {/* Pietricele */}
        <Circle cx={W * 0.2} cy={H * 0.75} r={3} fill={shade(sand, -0.2)} />
        <Circle cx={W * 0.55} cy={H * 0.82} r={4} fill={shade(sand, -0.2)} />
        <Circle cx={W * 0.82} cy={H * 0.72} r={2.5} fill={shade(sand, -0.2)} />
      </Svg>
    );
  },
};

registerWorld(PACK);
