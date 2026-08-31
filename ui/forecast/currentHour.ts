/**
 * How the current hour is marked in an hourly strip.
 *
 * The design fills the cell with `--sky-wash`, a very pale blue that reads as a
 * gentle highlight on cream. Inverted for dark it does the opposite: a pale fill on
 * navy is the brightest thing on the screen and the strip stops reading as a strip.
 * So on dark the same idea is drawn as an outline — the cell keeps the page's ground
 * and gains a light-blue ring.
 *
 * Shared by every hourly strip so 'Nu' and 'Verwachting' cannot drift apart.
 */
import type { Appearance, Palette } from '../../theme';

export interface CellDecor {
  backgroundColor: string;
  borderWidth: number;
  borderColor: string;
}

export function currentHourDecor(palette: Palette, appearance: Appearance): CellDecor {
  return appearance === 'dark'
    ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(143,220,245,.55)' }
    : { backgroundColor: palette.skyWash, borderWidth: 1, borderColor: 'transparent' };
}

/** The same box without the marking, so both cells have identical metrics and the
 *  strip does not jog by a pixel where the border begins. */
export const plainDecor: CellDecor = {
  backgroundColor: 'transparent',
  borderWidth: 1,
  borderColor: 'transparent',
};
