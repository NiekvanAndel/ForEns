/**
 * Wet bulb and Delta T — the two figures that decide whether a droplet lands.
 *
 * Its own kernel for the same reason `humidHours` is one: two families read it. The
 * spray window is a Delta T question, and whether frost irrigation helps at all is a
 * wet-bulb question, and the two disagreeing about the same air would be two answers
 * to a question with one answer.
 *
 * Stull's 2011 empirical fit, which holds to a few tenths over the range Dutch
 * weather occupies and needs neither pressure nor iteration. Outside its stated range
 * it returns **null** rather than a number the formula does not support: Delta T is
 * what sends a sprayer out, and a wrong Delta T is worse than none at all.
 *
 * Pure and word-free, like every other kernel here.
 */

/** The range Stull's fit is stated for: °C and %RH. */
const T_MIN = -20;
const T_MAX = 50;
const RH_MIN = 5;
const RH_MAX = 100;

/** Above this the fit runs out; saturated air is the wet bulb by definition anyway. */
const RH_CAP = 99;

/**
 * Wet-bulb temperature, °C, from air temperature and relative humidity.
 *
 * Null where either is missing or outside the range the fit covers.
 */
export function wetBulb(
  tempC: number | null | undefined,
  rh: number | null | undefined
): number | null {
  if (tempC == null || rh == null) return null;
  if (!Number.isFinite(tempC) || !Number.isFinite(rh)) return null;
  if (rh < RH_MIN || rh > RH_MAX || tempC < T_MIN || tempC > T_MAX) return null;

  const t = tempC;
  const h = Math.min(rh, RH_CAP);
  const tw =
    t * Math.atan(0.151977 * Math.sqrt(h + 8.313659)) +
    Math.atan(t + h) -
    Math.atan(h - 1.676331) +
    0.00391838 * Math.pow(h, 1.5) * Math.atan(0.023101 * h) -
    4.686035;

  return Math.round(tw * 10) / 10;
}

/**
 * Delta T, °C — the gap between the dry bulb and the wet bulb.
 *
 * One number for what the air will do to a droplet on its way down: too small and it
 * hangs, too large and it is gone before the leaf.
 */
export function deltaT(
  tempC: number | null | undefined,
  rh: number | null | undefined
): number | null {
  const tw = wetBulb(tempC, rh);
  if (tw == null || tempC == null) return null;
  return Math.round((tempC - tw) * 10) / 10;
}
