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
 * The colour of every layer of every weather glyph.
 *
 * Here rather than in the component, because this is the part that kept going wrong
 * and a pure function can be pinned by a test. `tests/glyphColors.test.ts` asserts
 * every symbol in both appearances against the agreed set; change a constant below
 * and that test says exactly which glyphs move.
 *
 * Nothing is left to SF Symbols' `multicolor` rendering. It draws clouds white and
 * the moon pale blue, and it covered fifty of the fifty-six icon variants in the
 * dark theme — colours nobody working on this code could see. Every layer is stated.
 *
 * Only the cloud changes between appearances; it lifts on navy so it does not sink
 * into the page.
 */
export const GLYPH_CLOUD_LIGHT = '#B7C3D1';
export const GLYPH_CLOUD_DARK = '#C9D6E4';
/** The sun's yellow, and the stars': it is the same light. Not the `--val-sun` text
 *  token, which is a deep orange chosen to be read as a number. */
export const GLYPH_SUN = '#FFCC00';
/** The moon, where it is the whole subject — `moon.fill` and the disc of
 *  `moon.stars.fill`. Pale rather than yellow: a lit moon is the colour of the
 *  cloud it sits beside, and the stars carry the warmth in that glyph. It follows
 *  the cloud between appearances for the same reason the cloud does — it has to
 *  lift off navy. Beside a cloud (`cloud.moon.fill`, `cloud.moon.rain.fill`) the
 *  moon still takes the sun's light, or the two layers would collapse into one
 *  shape. */
export const GLYPH_MOON_LIGHT = '#B7C3D1';
export const GLYPH_MOON_DARK = '#C9D6E4';
/** Rain, drizzle and sleet. */
export const GLYPH_PRECIP = '#3FC1EF';
/** Lightning, warm enough to separate from the rain in the same glyph. */
export const GLYPH_STORM = '#D9871F';

export type GlyphAppearance = 'light' | 'dark';

/** The cloud tone for an appearance — also what a glyph with no readable layers,
 *  and every monochrome fallback, is drawn in. */
export function glyphCloud(appearance: GlyphAppearance): string {
  return appearance === 'dark' ? GLYPH_CLOUD_DARK : GLYPH_CLOUD_LIGHT;
}

/** The moon's tone for an appearance, for the glyphs where it stands alone. */
export function glyphMoon(appearance: GlyphAppearance): string {
  return appearance === 'dark' ? GLYPH_MOON_DARK : GLYPH_MOON_LIGHT;
}

/** One colour per layer, in the order `symbolLayers` reports them. */
export function glyphLayerColors(
  code: number,
  isDay: boolean,
  appearance: GlyphAppearance
): string[] {
  const cloud = glyphCloud(appearance);
  const roles = symbolLayers(code, isDay);
  // A moon drawn beside a cloud keeps the sun's light: pale on pale would merge the
  // two layers into one shape. Alone, it is the moon's own tone.
  const moon = roles.includes('cloud') ? GLYPH_SUN : glyphMoon(appearance);
  return roles.map((role) => {
    switch (role) {
      case 'cloud':
        return cloud;
      case 'sun':
      case 'stars':
        return GLYPH_SUN;
      case 'moon':
        return moon;
      case 'precip':
        return GLYPH_PRECIP;
      // Snow takes the cloud's own tone: a white flake against a grey cloud reads as
      // two objects, and the flakes are the smallest marks in the set.
      case 'snow':
        return cloud;
      case 'storm':
        return GLYPH_STORM;
    }
  });
}

/**
 * How one glyph should be handed to `SymbolView`: which rendering mode, and with
 * what colour or colours.
 *
 * The single-layer case is the whole reason this is a function rather than two lines
 * in the component. expo-symbols drops a palette of one colour on the floor:
 *
 *     case .palette:
 *       if palette.count > 1 {                     // SymbolView.swift:138
 *         config = config.applying(...)
 *       }
 *
 * No configuration is applied, and with no tint colour set either the symbol falls
 * back to the system default — which is blue. That is `moon.fill`, `sun.max.fill`,
 * `cloud.fill` and `snowflake`, and it is why a clear night kept coming out blue
 * however carefully the colours themselves were chosen. A lone layer is therefore
 * sent as a monochrome tint, which is the same picture by a route the library
 * honours.
 */
export interface GlyphRendering {
  type: 'palette' | 'monochrome';
  /** Set only for `palette`, and only ever with two or more entries. */
  colors?: string[];
  /** Set only for `monochrome`. */
  tintColor?: string;
}

export function glyphRendering(
  code: number,
  isDay: boolean,
  appearance: GlyphAppearance,
  /** A colour the caller insists on — a row that tints its glyph means it. */
  forced?: string
): GlyphRendering {
  if (forced) return { type: 'monochrome', tintColor: forced };
  const layers = glyphLayerColors(code, isDay, appearance);
  if (layers.length > 1) return { type: 'palette', colors: layers };
  // One layer, or a symbol whose name yielded none: tint it.
  return { type: 'monochrome', tintColor: layers[0] ?? glyphCloud(appearance) };
}

/**
 * What each layer of a condition's SF Symbol actually depicts, in order.
 *
 * Palette rendering colours layers positionally, so it needs to know what is in
 * them. Assuming layer one is always a cloud is wrong and was: `sun.max.fill` is a
 * sun on its own, and colouring its first layer cloud-grey put out the sun.
 *
 * The roles are read from the symbol's own name — Apple names these compositionally,
 * `cloud.sun.rain.fill` being exactly cloud, then sun, then rain — so the mapping
 * cannot drift out of step with `wmoSymbol` the way a hand-kept table would.
 */
export type LayerRole = 'cloud' | 'sun' | 'moon' | 'stars' | 'precip' | 'snow' | 'storm';

export function symbolLayers(code: number, isDay: boolean = true): LayerRole[] {
  const roles: LayerRole[] = [];
  for (const part of wmoSymbol(code, isDay).split('.')) {
    switch (part) {
      // Fog is drawn as lines under the cloud and reads as part of it.
      case 'cloud':
      case 'fog':
        roles.push('cloud');
        break;
      case 'sun':
        roles.push('sun');
        break;
      // The stars in `moon.stars` are their own layer: the disc is pale and they
      // are not, so they cannot share a role with the moon.
      case 'moon':
        roles.push('moon');
        break;
      case 'stars':
        roles.push('stars');
        break;
      case 'rain':
      case 'heavyrain':
      case 'drizzle':
      case 'sleet':
        roles.push('precip');
        break;
      case 'snow':
      case 'snowflake':
        roles.push('snow');
        break;
      case 'bolt':
      case 'hail':
        roles.push('storm');
        break;
      // `fill` and `max` are qualifiers, not layers.
      default:
        break;
    }
  }
  return roles;
}

/** Share of a period that must be sunshine before the sun wins the icon. */
export const SUNNY_FRACTION = 0.75;

/** How long one row of an hourly series covers. Past 90 hours the model drops to
 *  three-hourly, and a three-hour row needs three times the sunshine to qualify. */
export const HOUR_MIN = 60;
export const THREE_HOUR_MIN = 180;

/**
 * Below this a period counts as dry. Radar and model alike report traces that are
 * not rain — condensation on a gauge, a rounding artefact — and a hundredth of a
 * millimetre should not be able to hold back the sun.
 */
export const DRY_TRACE_MM = 0.05;

/**
 * The code to draw for a period, with a sunny spell allowed to overrule it.
 *
 * A weather code names the period's most notable event, so an afternoon with one
 * ten-minute shower in it is "rain" — and drawn as rain beside three quarters of an
 * hour of sunshine, which is not what that afternoon looked like. Above the
 * threshold the sun is the honest picture.
 *
 * Unless it actually rained. A period with precipitation in it keeps its own code
 * however bright the rest of it was: a sunny hour you got wet in is a shower, and an
 * icon that leaves the rain out is the one piece of information the reader needed.
 * So the sun only wins a period that was dry.
 *
 * Only the *icon* is overruled. The code itself still drives the alert hero, the
 * text description and everything else that has to keep saying a thunderstorm is a
 * thunderstorm — a sunny half hour does not make one safe.
 *
 * `sunMin` is null wherever the sunshine series has not landed, and at night it is
 * zero, so neither can trip the rule.
 */
export function sunnyWmo(
  wmo: number,
  sunMin: number | null | undefined,
  periodMin: number = HOUR_MIN,
  precipMm: number | null | undefined = 0
): number {
  if (sunMin == null || periodMin <= 0) return wmo;
  if ((precipMm ?? 0) > DRY_TRACE_MM) return wmo;
  return sunMin > periodMin * SUNNY_FRACTION ? 0 : wmo;
}

/** The same rule for an hour off the model, which knows its own resolution and
 *  carries its own precipitation. */
export function sunnyHourWmo(hour: {
  wmo: number;
  sunMin?: number | null;
  precip?: number | null;
  is3h?: boolean;
}): number {
  return sunnyWmo(hour.wmo, hour.sunMin, hour.is3h ? THREE_HOUR_MIN : HOUR_MIN, hour.precip);
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
