import { ActivityIndicator, View, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors } from '../theme/colors';

type Props = {
  svg: string | null | undefined;
  size?: number;
  style?: ViewStyle;
};

// Pure renderer. SVG comes from the server (cached on the Avatar row).
// No DiceBear calls happen on the device — we only display what's stored.
export function AvatarHead({ svg, size = 200, style }: Props) {
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
      {svg ? (
        <SvgXml xml={svg} width={size} height={size} />
      ) : (
        <ActivityIndicator color={colors.accent} />
      )}
    </View>
  );
}
