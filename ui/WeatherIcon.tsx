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
 * Colour is ours, not Apple's, and this is the part worth explaining. SF Symbols'
 * multicolour rendering draws the cloud layer white — right on navy, nearly
 * invisible on cream — and the moon a pale blue. So any glyph with a cloud, a sun or
 * a moon in it uses `palette` rendering instead: one consistent grey for every
 * cloud, sun and moon both yellow, rain blue, snow pale and lightning amber, so a
 * row of mixed conditions reads as one set. The cloud tone and the tokens behind the
 * other layers follow the appearance, so the set works in both themes.
 *
 * The exceptions are the glyphs with nothing we have an opinion about — `cloud.fill`
 * and `cloud.fog.fill`, which `symbolIsMulticolor` already excludes and which are
 * drawn monochrome in the cloud grey, and `snowflake`. Getting the rest wrong put
 * the sun out twice: first grey, then, with one colour supplied for a symbol iOS
 * draws in more layers than that, blue. The rule is per-layer now, from the symbol's
 * own name, so neither can recur.
 *
 * The sun and the moon are the same yellow, and it is a glyph colour rather than the
 * `--val-sun` text token. That token is a deep orange on light, chosen to be read as
 * a number on cream; used on a glyph it made the sun behind a cloud orange while the
 * sun on its own — multicolour, drawn by iOS — stayed yellow, so two suns in one
 * column did not match. This yellow is the one iOS draws.
 *
 * Where there *is* a cloud, `symbolLayers` says which layer is which, because it
 * varies: `cloud.sun.fill` leads with a cloud, `cloud.bolt.rain.fill` has three.
 *
 * The same mapping drives the SwiftUI widget, so the two cannot disagree.
 */
import { SymbolView } from 'expo-symbols';
import { Platform } from 'react-native';
import { useTheme } from '../theme';
import {
  symbolIsMulticolor, symbolLayers, wmoCondition, wmoSymbol,
  type ConditionKey, type LayerRole,
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

/** The yellow iOS itself draws `sun.max.fill` in, so a sun behind a cloud and a sun
 *  on its own are the same colour. The moon shares it: a moon is lit by the sun, and
 *  a white one is invisible on cream. */
const SUN_GLYPH = '#FFCC00';

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
  const roles = symbolLayers(code, day);
  // Any glyph with parts we have an opinion about is drawn from the palette, in both
  // appearances. It was light-only, on the reasoning that multicolour's white cloud
  // is the problem and white is only invisible on cream. But that left the night
  // glyphs to Apple in the dark theme, where its multicolour moon is a pale blue —
  // so a moon was yellow by day and blue by night, which is not a rule anyone could
  // have guessed. One set of colours, both themes; the cloud tone and the tokens
  // behind rain, snow and lightning already follow the appearance themselves.
  const usePalette =
    !forced &&
    symbolIsMulticolor(code) &&
    (roles.includes('cloud') || roles.includes('moon') || roles.includes('sun'));
  const multicolor = !forced && !usePalette && symbolIsMulticolor(code);

  const layers = usePalette
    ? roles.map((role) => layerColor(role, palette, cloud))
    : undefined;

  return (
    <SymbolView
      name={wmoSymbol(code, day) as never}
      size={size}
      type={multicolor ? 'multicolor' : usePalette ? 'palette' : 'monochrome'}
      colors={layers}
      tintColor={multicolor || usePalette ? undefined : color ?? cloud}
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

/** One layer's colour, by what it depicts. */
function layerColor(
  role: LayerRole,
  palette: ReturnType<typeof useTheme>['palette'],
  cloud: string
): string {
  switch (role) {
    case 'cloud':
      return cloud;
    case 'sun':
      return SUN_GLYPH;
    // The same yellow as the sun: it is the same light, and it keeps a night glyph
    // from being two greys.
    case 'moon':
      return SUN_GLYPH;
    case 'precip':
      return palette.sky;
    case 'snow':
      return palette.skySoft;
    case 'storm':
      return palette.valTemp;
  }
}
