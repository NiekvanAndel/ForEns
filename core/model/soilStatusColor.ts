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
 * ## Two roles, because a bar and a number want different things
 *
 * A **fill** — a bar, a chart zone, a chip — is read against its neighbours, so what
 * matters is that the five are unmistakably different from each other. An **ink** — a
 * figure printed on a card — is read against the card, so what matters is that it
 * clears the contrast floor.
 *
 * One table tried to do both and the light-mode fills paid for it: a yellow dark
 * enough to read as text is an olive, and beside a readable orange the two merged.
 * The design system's own soil zones solve it by spreading *lightness* as well as hue
 * — a very light yellow next to a mid orange — which reads instantly as a bar and
 * would be unreadable as a number. So the fills are the design's, the inks are
 * darkened to clear 3:1, and both keep the same hue so a zone and the figure over it
 * still describe the same state.
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

/** The same stop as a fill — lighter, because a bar is read against its neighbours. */
export const SOIL_FIELD_CAPACITY_FILL: Record<SoilAppearance, string> = {
  light: '#C9CDD2',
  dark: '#4A5D75',
};

/**
 * The fills: the design system's own soil zones.
 *
 * Taken from the proposal's own charts rather than derived, so a grower moving between
 * the web app and this one meets the same four colours. The light set spreads lightness
 * as well as hue — `#F9EB39` is very light and `#D9871F` is mid — and that spread is
 * what makes yellow and orange tell apart at a glance in a bar six points high.
 */
const FILLS: Record<SoilAppearance, Record<SoilStatus, string>> = {
  light: {
    0: '#5C9452',
    1: '#F9EB39',
    2: '#D9871F',
    3: '#C0433F',
  },
  // On navy the same hues, lifted. There is more room above the floor here, so these
  // are already far enough apart without the light set's extremes.
  dark: {
    0: '#7BB570',
    1: '#E8D14E',
    2: '#E8A94E',
    3: '#E8817D',
  },
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

/**
 * The fill for a state — a bar, a chart zone, a chip. Null where there is no state.
 *
 * Never for text. `#F9EB39` on a white card is a yellow nobody can read, which is
 * exactly what makes it a good bar segment beside an orange one.
 */
export function soilStatusFill(
  level: SoilStatus | null | undefined,
  appearance: SoilAppearance
): string | null {
  if (level == null) return null;
  return FILLS[appearance][level] ?? null;
}

/** Every ink, wet end first — what the tests walk for legibility. */
export function soilScale(appearance: SoilAppearance): string[] {
  return [SOIL_FIELD_CAPACITY_INK[appearance], ...([0, 1, 2, 3] as const).map((l) => SCALE[appearance][l])];
}

/** Every fill, wet end first — what the tests walk for mutual distinction. */
export function soilFillScale(appearance: SoilAppearance): string[] {
  return [
    SOIL_FIELD_CAPACITY_FILL[appearance],
    ...([0, 1, 2, 3] as const).map((l) => FILLS[appearance][l]),
  ];
}
