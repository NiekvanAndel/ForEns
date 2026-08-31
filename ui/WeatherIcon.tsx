/**
 * Weather condition glyph, drawn with native SF Symbols.
 *
 * A deliberate deviation from design rule 6 ("Phosphor for the iOS app"), agreed
 * with the client: Phosphor stays for every other icon, and only the condition
 * glyph is native. SF Symbols draws distinctions Phosphor cannot — drizzle against
 * heavy rain, a shower against steady rain, sleet against snow — so the mapping
 * covers the full WMO set index.html reports rather than collapsing it.
 *
 * Day and night are separate symbols rather than a tint, and multicolour rendering
 * gives sun its yellow and rain its blue, so the glyph reads as weather rather than
 * as a UI icon. Plain cloud has no colour of its own and takes the muted ink so it
 * stays quiet in a list.
 *
 * The same mapping drives the SwiftUI widget, so the two cannot disagree.
 */
import { SymbolView } from 'expo-symbols';
import { Platform } from 'react-native';
import { useTheme } from '../theme';
import { symbolIsMulticolor, wmoCondition, wmoSymbol, type ConditionKey } from '../core/model/conditions';
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
  const { palette } = useTheme();
  const day = isDay === 1 || isDay === true;
  const code = wmo;

  if (Platform.OS !== 'ios') {
    const key = wmoCondition(code);
    return (
      <Icon
        name={PHOSPHOR_FALLBACK[key]}
        size={size}
        color={color ?? palette.muted}
        weight="fill"
      />
    );
  }

  const multicolor = symbolIsMulticolor(code) && !color;

  return (
    <SymbolView
      name={wmoSymbol(code, day) as never}
      size={size}
      type={multicolor ? 'multicolor' : 'monochrome'}
      tintColor={multicolor ? undefined : color ?? palette.muted}
      // Never leave a hole in a row if a symbol is missing on this iOS version.
      fallback={
        <Icon
          name={PHOSPHOR_FALLBACK[wmoCondition(code)]}
          size={size}
          color={color ?? palette.muted}
          weight="fill"
        />
      }
      resizeMode="scaleAspectFit"
      style={{ width: size, height: size }}
    />
  );
}
