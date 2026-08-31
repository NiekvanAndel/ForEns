/**
 * WMO weather codes to SF Symbols.
 *
 * This replaces the Phosphor mapping, which was a deliberate deviation from design
 * rule 6 agreed with the client (see DEFERRED.md). Phosphor stays for every other
 * icon in the app; only the condition glyph is native.
 *
 * The mapping is deliberately *wider* than the Phosphor one it replaces. Phosphor
 * could not draw the difference between drizzle and heavy rain, so several WMO
 * codes collapsed onto one glyph; SF Symbols can, so the distinctions `index.html`
 * makes are restored rather than kept at the old resolution.
 *
 * Day and night are separate symbols, not a tint: SF Symbols has real `.moon`
 * variants, so night is drawn rather than merely coloured.
 *
 * Shared with the widget through `core/widget.ts`, so app and widget cannot show
 * different glyphs for the same weather.
 */

export interface ConditionSymbol {
  /** SF Symbol name. */
  name: string;
  /** Fallback for the rare code Apple has no symbol for. */
  fallback: string;
}

/**
 * The full WMO set index.html distinguishes, plus day/night variants.
 *
 * Codes follow WMO 4677 as Open-Meteo reports them.
 */
export function wmoSymbol(code: number, isDay: boolean = true): string {
  switch (code) {
    // Clear and cloud cover
    case 0: return isDay ? 'sun.max.fill' : 'moon.stars.fill';
    case 1: return isDay ? 'sun.max.fill' : 'moon.fill';
    case 2: return isDay ? 'cloud.sun.fill' : 'cloud.moon.fill';
    case 3: return 'cloud.fill';

    // Fog
    case 45: return 'cloud.fog.fill';
    case 48: return 'cloud.fog.fill';

    // Drizzle, by intensity
    case 51: return 'cloud.drizzle.fill';
    case 53: return 'cloud.drizzle.fill';
    case 55: return 'cloud.rain.fill';
    // Freezing drizzle
    case 56: return 'cloud.sleet.fill';
    case 57: return 'cloud.sleet.fill';

    // Rain, by intensity
    case 61: return 'cloud.rain.fill';
    case 63: return 'cloud.rain.fill';
    case 65: return 'cloud.heavyrain.fill';
    // Freezing rain
    case 66: return 'cloud.sleet.fill';
    case 67: return 'cloud.sleet.fill';

    // Snow
    case 71: return 'cloud.snow.fill';
    case 73: return 'cloud.snow.fill';
    case 75: return 'snowflake';
    case 77: return 'cloud.snow.fill';

    // Rain showers keep the sun or moon, which is what makes them showers
    case 80: return isDay ? 'cloud.sun.rain.fill' : 'cloud.moon.rain.fill';
    case 81: return isDay ? 'cloud.sun.rain.fill' : 'cloud.moon.rain.fill';
    case 82: return 'cloud.heavyrain.fill';

    // Snow showers
    case 85: return 'cloud.snow.fill';
    case 86: return 'snowflake';

    // Thunderstorm, and with hail
    case 95: return 'cloud.bolt.rain.fill';
    case 96: return 'cloud.bolt.rain.fill';
    case 99: return 'cloud.bolt.fill';

    default: return 'cloud.fill';
  }
}

/**
 * Whether a code should render in multicolour.
 *
 * Multicolour gives sun its yellow and rain its blue, which is what makes a glyph
 * read as weather rather than as a UI icon. Plain cloud has no colour of its own,
 * so it takes the palette's muted ink instead and stays quiet in a list.
 */
export function symbolIsMulticolor(code: number): boolean {
  return code !== 3 && code !== 45 && code !== 48;
}

/**
 * Which accent an SF Symbol's second layer wants, so a palette rendering can keep
 * the cloud one consistent grey while sun stays yellow and rain stays blue.
 *
 * SF Symbols' weather glyphs are layered cloud-first: layer one is the cloud (or,
 * for `sun.max`, the sun itself), layer two the thing falling out of it or the sun
 * behind it. Multicolour renders layer one white, which is right on navy and
 * invisible on cream — hence the palette path in light mode.
 */
export type SymbolAccent = 'sun' | 'precip' | 'snow' | 'storm' | 'none';

export function symbolAccent(code: number): SymbolAccent {
  const key = wmoCondition(code);
  switch (key) {
    case 'clear':
    case 'mostly-clear':
    case 'partly-cloudy':
      return 'sun';
    case 'cloudy':
    case 'fog':
      return 'none';
    case 'snow':
    case 'heavy-snow':
    case 'snow-showers':
      return 'snow';
    case 'thunderstorm':
    case 'thunderstorm-hail':
      return 'storm';
    default:
      return 'precip';
  }
}

/** A stable identifier for a condition, kept for tests and analytics. */
export type ConditionKey =
  | 'clear' | 'mostly-clear' | 'partly-cloudy' | 'cloudy' | 'fog'
  | 'drizzle' | 'freezing-drizzle' | 'rain' | 'heavy-rain' | 'freezing-rain'
  | 'snow' | 'heavy-snow' | 'showers' | 'heavy-showers' | 'snow-showers'
  | 'thunderstorm' | 'thunderstorm-hail';

export function wmoCondition(code: number): ConditionKey {
  if (code === 0) return 'clear';
  if (code === 1) return 'mostly-clear';
  if (code === 2) return 'partly-cloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code === 51 || code === 53 || code === 55) return 'drizzle';
  if (code === 56 || code === 57) return 'freezing-drizzle';
  if (code === 61 || code === 63) return 'rain';
  if (code === 65) return 'heavy-rain';
  if (code === 66 || code === 67) return 'freezing-rain';
  if (code === 71 || code === 73 || code === 77) return 'snow';
  if (code === 75) return 'heavy-snow';
  if (code === 80 || code === 81) return 'showers';
  if (code === 82) return 'heavy-showers';
  if (code === 85 || code === 86) return 'snow-showers';
  if (code === 96 || code === 99) return 'thunderstorm-hail';
  if (code >= 95) return 'thunderstorm';
  return 'cloudy';
}
