/**
 * Weather condition glyph, drawn with native SF Symbols.
 *
 * A deliberate deviation from design rule 6 ("Phosphor for the iOS app"), agreed
 * with the client: Phosphor stays for every other icon, and only the condition
 * glyph is native. SF Symbols draws distinctions Phosphor cannot — drizzle against
 * heavy rain, a shower against steady rain, sleet against snow — so the mapping
 * covers the full WMO set index.html reports rather than collapsing it.
 *
 * Day and night are separate symbols rather than a tint, so the glyph reads as
 * weather rather than as a UI icon.
 *
 * Every colour here is ours. Nothing is left to SF Symbols' `multicolor` rendering,
 * which was the source of a long run of colour bugs: it draws the cloud layer white
 * and the moon pale blue, and it applied to fifty of the fifty-six icon variants in
 * the dark theme — colours nobody working on this code could see or look up. So each
 * glyph is drawn with `palette` rendering and one stated colour per layer.
 *
 * The set is the same in both appearances except the cloud, which lifts on navy:
 *
 *   cloud   #B7C3D1 on light, #C9D6E4 on dark
 *   sun     #FFCC00      moon    #FFCC00, the same light
 *   rain    #3FC1EF      snow    the cloud tone, so a snow glyph reads as one object
 *   bolt    #D9871F
 *
 * Which layer is which comes from `symbolLayers`, which reads the symbol's own name.
 * The widget shares the symbol *names* through the same module, but draws them with
 * `.symbolRenderingMode(.multicolor)` in Swift — so its colours are Apple's, not
 * these. Worth knowing before comparing the two side by side.
 */
import { SymbolView } from 'expo-symbols';
import { Platform } from 'react-native';
import { useTheme } from '../theme';
import {
  glyphCloud, glyphRendering, wmoCondition, wmoSymbol,
  type ConditionKey,
} from '../core/model/conditions';
import { Icon } from './Icon';

export type { ConditionKey };
export { wmoCondition, wmoSymbol };

export interface WeatherIconProps {
  wmo?: number;
  isDay?: 0 | 1 | boolean;
  size?: number;
  /** Force a colour instead of the symbol's own rendering. */
  color?: string;
}

/** Non-Apple platforms have no SF Symbols, so Phosphor remains the fallback. */
const PHOSPHOR_FALLBACK: Record<ConditionKey, string> = {
  clear: 'sun',
  'mostly-clear': 'sun',
  'partly-cloudy': 'cloud-sun',
  cloudy: 'cloud',
  fog: 'cloud-fog',
  drizzle: 'cloud-rain',
  'freezing-drizzle': 'cloud-rain',
  rain: 'cloud-rain',
  'heavy-rain': 'cloud-rain',
  'freezing-rain': 'cloud-rain',
  snow: 'cloud-snow',
  'heavy-snow': 'cloud-snow',
  showers: 'cloud-rain',
  'heavy-showers': 'cloud-rain',
  'snow-showers': 'cloud-snow',
  thunderstorm: 'cloud-lightning',
  'thunderstorm-hail': 'cloud-lightning',
};

export function WeatherIcon({ wmo = 3, isDay = 1, size = 34, color }: WeatherIconProps) {
  const { appearance } = useTheme();
  const day = isDay === 1 || isDay === true;
  const code = wmo;
  const cloud = glyphCloud(appearance);

  if (Platform.OS !== 'ios') {
    const key = wmoCondition(code);
    return (
      <Icon
        name={PHOSPHOR_FALLBACK[key]}
        size={size}
        color={color ?? cloud}
        weight="fill"
      />
    );
  }

  // Which mode and which colours, including the single-layer case that expo-symbols
  // would otherwise drop. See `glyphRendering`.
  const render = glyphRendering(code, day, appearance, color);

  return (
    <SymbolView
      name={wmoSymbol(code, day) as never}
      size={size}
      type={render.type}
      colors={render.colors}
      tintColor={render.tintColor}
      // Never leave a hole in a row if a symbol is missing on this iOS version.
      fallback={
        <Icon
          name={PHOSPHOR_FALLBACK[wmoCondition(code)]}
          size={size}
          color={color ?? cloud}
          weight="fill"
        />
      }
      resizeMode="scaleAspectFit"
      style={{ width: size, height: size }}
    />
  );
}
