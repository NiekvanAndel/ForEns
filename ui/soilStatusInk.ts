/**
 * The soil scale in the theme's terms.
 *
 * The colours themselves are `core/model/soilStatusColor` — a table, because the
 * palette has no yellow and its two ambers are one colour. This is only the bridge:
 * it turns the theme's appearance into the scale's, and gives callers the hairline to
 * fall back on where a field has no state to show.
 */
import type { Palette } from '../theme';
import { soilStatusColor, type SoilAppearance } from '../core/model/soilStatusColor';
import type { SoilStatus } from '../core/model/soil';

export function soilStatusInk(
  level: SoilStatus | null | undefined,
  palette: Palette,
  appearance: SoilAppearance
): string {
  // A field the app cannot place must not borrow the colour of one it can.
  return soilStatusColor(level, appearance) ?? palette.hairline;
}
