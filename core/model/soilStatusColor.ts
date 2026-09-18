/**
 * The soil scale: what colour a field's state is.
 *
 * Five stops, and they are a scale rather than a set of labels — wet at one end, a
 * damaged crop at the other — so the colours run the way a grower already reads them:
 * grey, green, yellow, orange, red.
 *
 * ## Why this is a table and not four palette tokens
 *
 * It was four palette tokens, and that was wrong twice over. `valSun` and `valTemp`
 * are the *same* colour in both appearances — `#D9871F` light, `#E8A94E` dark — so
 * "suboptimaal" and "beregen nu" came out identical, and the four-lamp shape the whole
 * indicator layer is built on read as three lamps on screen. And the palette has no
 * yellow at all: the design system's only warm colours are that one amber and a title
 * tint, so there was nothing to reach for.
 *
 * So the scale gets its own table, for the same reason `temperatureColor` has one: it
 * needs stops the palette was never asked for. Two tables, because legibility is what
 * changes between appearances — every stop clears 3:1 against the ground it is printed
 * on, which is the large-text floor these figures are set at, and
 * `tests/soilStatusColor.test.ts` fails if an edit drops one under it or lets two
 * stops collapse into each other again.
 *
 * ## Fills come from these too
 *
 * A chart's zones are these same inks at low opacity, so the band behind the line and
 * the figure above it cannot disagree about what state they describe. That is why the
 * table holds one ink per stop rather than a separate pale set.
 */
import type { SoilStatus } from './soil';

export type SoilAppearance = 'light' | 'dark';

/**
 * Below the first threshold the soil is at or above field capacity — wetter than the
 * crop needs, draining rather than drying. Grey, because it is not a warning and not
 * an achievement: it is the state a field is in the day after it rains.
 */
export const SOIL_FIELD_CAPACITY_INK: Record<SoilAppearance, string> = {
  light: '#7F8FA3',
  dark: '#6E8199',
};

const SCALE: Record<SoilAppearance, Record<SoilStatus, string>> = {
  // On white and cream cards. Yellow and orange are the pair that has to work hardest
  // here: both must stay readable, which pushes them darker than they would be as
  // fills, and they must stay apart, which is why the orange is not the palette's.
  light: {
    0: '#457A3D',
    1: '#9C8200',
    2: '#BD6B12',
    3: '#D0524E',
  },
  // On navy. The same four hues, lifted — there is far more room above the floor here,
  // so these can be the brighter, more obviously yellow and orange versions.
  dark: {
    0: '#7BB570',
    1: '#E8D14E',
    2: '#E8A94E',
    3: '#E8817D',
  },
};

/**
 * The ink for a state, or null where there is none.
 *
 * Null rather than a default: a field whose state nobody knows — no thresholds, or a
 * sensor out of the ground — must not borrow the colour of one that is fine. The
 * caller decides what to draw instead, and every caller in this app draws a hairline.
 */
export function soilStatusColor(
  level: SoilStatus | null | undefined,
  appearance: SoilAppearance
): string | null {
  if (level == null) return null;
  return SCALE[appearance][level] ?? null;
}

/** Every stop, wet end first — what a legend and the tests walk. */
export function soilScale(appearance: SoilAppearance): string[] {
  return [SOIL_FIELD_CAPACITY_INK[appearance], ...([0, 1, 2, 3] as const).map((l) => SCALE[appearance][l])];
}
