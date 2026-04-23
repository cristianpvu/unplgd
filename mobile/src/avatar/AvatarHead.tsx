import { ActivityIndicator, View, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors } from '../theme/colors';

const ASPECT_W = 762;
const ASPECT_H = 1400;

type Props = {
  svg: string | null | undefined;
  // `height` drives the rendered size; width is derived to preserve the
  // 200×340 viewBox ratio so the body never gets squished into a square.
  height?: number;
  style?: ViewStyle;
};

export function AvatarHead({ svg, height = 220, style }: Props) {
  const width = Math.round(height * (ASPECT_W / ASPECT_H));
  return (
    <View
      style={[
        {
          width,
          height,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
        },
        style,
      ]}
    >
      {svg ? (
        <SvgXml xml={svg} width={width} height={height} />
      ) : (
        <ActivityIndicator color={colors.accent} />
      )}
    </View>
  );
}
