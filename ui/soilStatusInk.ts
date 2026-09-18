/**
 * What colour a soil state is.
 *
 * Four states, four inks, in one place — the bar on the field's card, the bar on the
 * overview, and the figures on 'Actueel' all read from here. There were two copies of
 * this table before there were three surfaces using it, which is one copy past the
 * point where they start to drift.
 *
 * The colours are palette tokens rather than a table of their own, unlike
 * `temperatureColor`: that scale has eleven stops the palette never needed, while
 * these four are the app's existing ok / warn / stop inks doing the job they already
 * do everywhere else. Taking them from the palette is also what keeps them legible in
 * both appearances without a second set of hexes to maintain.
 *
 * The state itself is the API's, frozen per measurement against the field's own
 * thresholds — so the same colour on two rows means the same thing about two very
 * different numbers. That is the point of it.
 */
import type { Palette } from '../theme';
import type { SoilStatus } from '../core/model/soil';

export function soilStatusInk(level: SoilStatus | null, palette: Palette): string {
  switch (level) {
    // Optimal: the station green, which is this app's "nothing to do here".
    case 0: return palette.agroInk;
    // Suboptimal — drying out, not yet a decision.
    case 1: return palette.valSun;
    // Irrigate now: the decision moment.
    case 2: return palette.valTemp;
    // Critical: the crop is being damaged.
    case 3: return palette.valHigh;
    // No state — no thresholds, or a sensor out of the ground. A hairline, because a
    // field the app cannot place must not borrow the colour of one it can.
    default: return palette.hairline;
  }
}
