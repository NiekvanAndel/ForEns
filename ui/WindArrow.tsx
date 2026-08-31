/**
 * Wind arrow.
 *
 * Points where the wind is going, from a compass bearing — matching the design's
 * `WindArrow`, which rotates an up-arrow by the bearing directly.
 */
import { View } from 'react-native';
import { useTheme } from '../theme';
import { Icon } from './Icon';

export function WindArrow({
  deg, size = 15, color,
}: { deg: number | null | undefined; size?: number; color?: string }) {
  const { palette } = useTheme();
  if (deg == null) return null;
  return (
    <View style={{ transform: [{ rotate: `${deg}deg` }] }}>
      <Icon name="arrow-up" size={size} color={color ?? palette.inkHeading} weight="bold" />
    </View>
  );
}
