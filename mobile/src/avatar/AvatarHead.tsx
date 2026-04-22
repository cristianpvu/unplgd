import { useEffect, useState } from 'react';
import { ActivityIndicator, View, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { fetchAvatarSvg, picksToOptions } from './dicebear';
import type { AvatarPicks } from './catalog';
import { colors } from '../theme/colors';

type Props = {
  picks: AvatarPicks;
  size?: number;
  style?: ViewStyle;
};

export function AvatarHead({ picks, size = 200, style }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    fetchAvatarSvg(picksToOptions(picks))
      .then((s) => {
        if (!cancelled) setSvg(s);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [picks]);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
        },
        style,
      ]}
    >
      {!svg && !error && <ActivityIndicator color={colors.accent} />}
      {svg && <SvgXml xml={svg} width={size} height={size} />}
    </View>
  );
}
