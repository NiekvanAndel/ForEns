/**
 * Wind arrow.
 *
 * `winddirection_10m` is meteorological: the direction the wind comes *from*. 0° is
 * a northerly, which blows toward the south. So the arrow — which points where the
 * air is going, the thing a reader actually cares about — is the bearing turned
 * half a circle. The port had been rotating an up-arrow by the bearing itself,
 * which pointed every wind back at where it came from.
 *
 * `index.html` does the same half turn everywhere it draws one (`degToArrow`), so
 * this is parity as well as correctness.
 */
import { View } from 'react-native';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { windHeading } from '../core/i18n';

export function WindArrow({
  deg, size = 15, color,
}: { deg: number | null | undefined; size?: number; color?: string }) {
  const { palette } = useTheme();
  if (deg == null) return null;
  return (
    <View style={{ transform: [{ rotate: `${windHeading(deg)}deg` }] }}>
      <Icon name="arrow-up" size={size} color={color ?? palette.inkHeading} weight="bold" />
    </View>
  );
}
