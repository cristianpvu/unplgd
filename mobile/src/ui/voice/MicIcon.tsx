import Svg, { Path, Rect } from 'react-native-svg';
import type { OrbPhase } from './Orb';

// Icoane SVG curate pt butonul de mic. Inlocuiesc emoji-urile (🎤 ⏹ ⏸) care
// arata inconsistent intre platforme si nu pot fi colorate. Toate sunt
// concepute pe viewBox 24x24, line-style, stroke alb pe fundal accent.

export type MicIconProps = {
  phase: OrbPhase;
  size?: number;
  color?: string;
};

export function MicIcon({ phase, size = 36, color = '#FFFFFF' }: MicIconProps) {
  if (phase === 'listening') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Rect x={6} y={6} width={12} height={12} rx={2.5} fill={color} />
      </Svg>
    );
  }
  if (phase === 'speaking') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Rect x={6.5} y={5} width={3.5} height={14} rx={1.5} fill={color} />
        <Rect x={14} y={5} width={3.5} height={14} rx={1.5} fill={color} />
      </Svg>
    );
  }
  // idle / thinking — desenam mic. Pe thinking componenta de mai sus suprascrie
  // cu dots, deci asta apare doar la idle.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3.5a3 3 0 0 0-3 3v5.5a3 3 0 0 0 6 0V6.5a3 3 0 0 0-3-3z"
        fill={color}
      />
      <Path
        d="M6 11.5a6 6 0 0 0 12 0"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M12 17.5v3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}
