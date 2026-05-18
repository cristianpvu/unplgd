import Svg, { Path, Circle, Line, Polyline } from 'react-native-svg';

// Setul minim de iconite line-style (stroke-only) folosite in app.
// Toate accepta size + color; default 22 / currentColor-like (#FFFFFF).
// Conventie: viewBox 24x24, strokeWidth 2, linecap round.

type Props = { size?: number; color?: string };

function Base({ size = 22, children }: { size?: number; children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {children}
    </Svg>
  );
}

export function IconArrowLeft({ size, color = '#FFFFFF' }: Props) {
  return (
    <Base size={size}>
      <Line x1="19" y1="12" x2="5" y2="12" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Polyline points="12 19 5 12 12 5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Base>
  );
}

export function IconClose({ size, color = '#FFFFFF' }: Props) {
  return (
    <Base size={size}>
      <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Base>
  );
}

export function IconCheck({ size, color = '#FFFFFF' }: Props) {
  return (
    <Base size={size}>
      <Polyline points="20 6 9 17 4 12" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Base>
  );
}

export function IconLock({ size, color = '#FFFFFF' }: Props) {
  return (
    <Base size={size}>
      <Path
        d="M5 11h14v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M8 11V7a4 4 0 0 1 8 0v4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Base>
  );
}

export function IconPhoneCall({ size, color = '#FFFFFF' }: Props) {
  return (
    <Base size={size}>
      <Path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.86 19.86 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Base>
  );
}

export function IconUsers({ size, color = '#FFFFFF' }: Props) {
  return (
    <Base size={size}>
      <Path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="9" cy="7" r="4" stroke={color} strokeWidth={2} />
      <Path
        d="M23 21v-2a4 4 0 0 0-3-3.87"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M16 3.13a4 4 0 0 1 0 7.75"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Base>
  );
}

export function IconBluetooth({ size, color = '#FFFFFF' }: Props) {
  return (
    <Base size={size}>
      <Path
        d="M6 7l12 10-6 5V2l6 5L6 17"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Base>
  );
}

export function IconPlay({ size, color = '#FFFFFF' }: Props) {
  return (
    <Base size={size}>
      <Path d="M6 4l16 8-16 8V4z" fill={color} />
    </Base>
  );
}

export function IconFlag({ size, color = '#FFFFFF' }: Props) {
  return (
    <Base size={size}>
      <Path
        d="M4 22V4a1 1 0 0 1 .55-.89C7 1.7 10 1 13 4c2 2 5 1 6.45.39A1 1 0 0 1 21 5.27V14a1 1 0 0 1-.55.89C18 16.3 15 17 12 14c-2-2-5-1-6 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Base>
  );
}

export function IconTrophy({ size, color = '#FFFFFF' }: Props) {
  return (
    <Base size={size}>
      <Path
        d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 4H4v3a3 3 0 0 0 3 3M17 4h3v3a3 3 0 0 1-3 3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Base>
  );
}

export function IconPause({ size, color = '#FFFFFF' }: Props) {
  return (
    <Base size={size}>
      <Line x1="9" y1="5" x2="9" y2="19" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Line x1="15" y1="5" x2="15" y2="19" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </Base>
  );
}

export function IconChevronRight({ size, color = '#FFFFFF' }: Props) {
  return (
    <Base size={size}>
      <Polyline points="9 18 15 12 9 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Base>
  );
}

export function IconBox({ size, color = '#FFFFFF' }: Props) {
  return (
    <Base size={size}>
      <Path d="M3 7l9-4 9 4-9 4-9-4z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M3 7v10l9 4 9-4V7" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Line x1="12" y1="11" x2="12" y2="21" stroke={color} strokeWidth={2} />
    </Base>
  );
}

export function IconAlert({ size, color = '#FFFFFF' }: Props) {
  return (
    <Base size={size}>
      <Path d="M12 2L1 21h22L12 2z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Line x1="12" y1="9" x2="12" y2="13" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx="12" cy="17" r="0.9" fill={color} />
    </Base>
  );
}

export function IconFootsteps({ size, color = '#FFFFFF' }: Props) {
  return (
    <Base size={size}>
      <Path
        d="M8.5 9c0 2.5-1 4.5-1 6.5 0 1.4.6 2.5 2 2.5s2-1.1 2-2.5c0-2-1-4-1-6.5C10.5 7 9.7 6 8.5 6S6.5 7 6.5 9z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M15.5 5c0 2.5-1 4-1 6 0 1.4.6 2.5 2 2.5s2-1.1 2-2.5c0-2-1-3.5-1-6 0-1.5-.7-2.5-2-2.5s-2 1-2 2.5z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Base>
  );
}
