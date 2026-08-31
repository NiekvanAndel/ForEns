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
 * Colour is by appearance, and this is the part worth explaining. SF Symbols'
 * multicolour rendering draws the cloud layer white, which is right on navy and
 * nearly invisible on cream. On light the glyphs therefore use `palette` rendering
 * instead: one consistent light grey for every cloud, and the symbol's own second
 * layer keeping sun yellow, rain blue, snow pale and lightning amber. Overcast and
 * fog have no second layer, so they are that same grey throughout — which is what
 * makes a row of mixed conditions read as one set rather than as one dark glyph
 * among lighter ones.
 *
 * The same mapping drives the SwiftUI widget, so the two cannot disagree.
 */
import { SymbolView } from 'expo-symbols';
import { Platform } from 'react-native';
import { useTheme } from '../theme';
import {
  symbolAccent, symbolIsMulticolor, wmoCondition, wmoSymbol,
  type ConditionKey, type SymbolAccent,
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

/** One grey for every cloud, in both appearances. Light enough to sit on cream
 *  without weighing a row down, dark enough to read against it. */
const CLOUD_LIGHT = '#B7C3D1';
const CLOUD_DARK = '#C9D6E4';

export function WeatherIcon({ wmo = 3, isDay = 1, size = 34, color }: WeatherIconProps) {
  const { palette, appearance } = useTheme();
  const day = isDay === 1 || isDay === true;
  const code = wmo;
  const cloud = appearance === 'dark' ? CLOUD_DARK : CLOUD_LIGHT;

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

  // A forced colour always wins: a row that tints its glyph means it.
  const forced = !!color;
  // Dark keeps multicolour, where a white cloud is exactly right. Light uses a
  // palette so the cloud layer can be grey instead.
  const multicolor = !forced && appearance === 'dark' && symbolIsMulticolor(code);
  const paletteMode = !forced && !multicolor && symbolIsMulticolor(code);

  const layers = paletteMode
    ? [cloud, accentColor(symbolAccent(code), palette, cloud)]
    : undefined;

  return (
    <SymbolView
      name={wmoSymbol(code, day) as never}
      size={size}
      type={multicolor ? 'multicolor' : paletteMode ? 'palette' : 'monochrome'}
      colors={layers}
      tintColor={multicolor || paletteMode ? undefined : color ?? cloud}
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

/** The second layer's colour: what is falling, or the sun behind the cloud. */
function accentColor(
  accent: SymbolAccent,
  palette: ReturnType<typeof useTheme>['palette'],
  cloud: string
): string {
  switch (accent) {
    case 'sun':
      return palette.valSun;
    case 'precip':
      return palette.sky;
    case 'snow':
      return palette.skySoft;
    case 'storm':
      return palette.valTemp;
    // Overcast and fog have no second layer; giving it the cloud grey keeps the
    // glyph one flat colour rather than letting a stray layer pick up a tint.
    case 'none':
      return cloud;
  }
}
