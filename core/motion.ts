/**
 * Motion maths, kept free of React Native so it can be tested. The functions that
 * gesture callbacks call are marked 'worklet' so they run on the UI thread.
 *
 * The rules come from Apple's "Designing Fluid Interfaces": a gesture hands its
 * release velocity to a spring, the landing point is projected from that velocity
 * rather than read from where the finger lifted, and a boundary resists
 * progressively instead of stopping dead.
 */

/**
 * Where a throw would come to rest, in the same unit as the velocity (points).
 *
 * Apple's exponential-decay form, not the textbook v²/2a: this is what scroll views
 * use, so a flick lands where a reader's hand already expects it to.
 *
 * @param velocity points per second, signed
 * @param decelerationRate 0.998 is a normal scroll; 0.99 is snappier
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Resistance past a boundary: the further over, the less the page follows.
 *
 * @param overshoot signed distance past the edge, in points
 * @param dimension the size of the thing being dragged along that axis
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  'worklet';
  const sign = overshoot < 0 ? -1 : 1;
  const over = Math.abs(overshoot);
  return (sign * (over * dimension * constant)) / (dimension + constant * over);
}

/**
 * Apple's two-number spring (damping ratio, response in seconds) as the mass,
 * stiffness and damping Reanimated wants.
 *
 * `response` is the period of an undamped oscillation, so stiffness = (2π/response)²
 * and damping = 4π·ratio/response, with unit mass.
 */
export function springConfig(dampingRatio: number, response: number) {
  const stiffness = (2 * Math.PI / response) ** 2;
  const damping = (4 * Math.PI * dampingRatio) / response;
  return { mass: 1, stiffness, damping } as const;
}

/**
 * The springs the app uses. Critically damped by default; a bounce is reserved for
 * motion the reader's own gesture put there.
 */
export const spring = {
  /** Anything that moves because it was tapped: pages, toggles, press feedback. */
  settle: springConfig(1, 0.34),
  /** A page carried off by a flick. Never overshoots, or the gap behind it shows. */
  carry: { ...springConfig(1, 0.3), overshootClamping: true },
  /** A drawer or sheet let go with momentum: slight give. */
  sheet: springConfig(0.8, 0.3),
} as const;

/**
 * Whether a horizontal drag should commit, judged by where it is going.
 *
 * Position alone loses a short, fast flick and keeps a long, hesitant drag; the
 * projected end point treats both as the reader meant them.
 *
 * @param translation distance dragged so far (signed)
 * @param velocity release velocity (signed, points per second)
 * @param threshold distance the projected end point must pass
 */
export function shouldCommit(translation: number, velocity: number, threshold: number): boolean {
  'worklet';
  // The snappier 0.99 rate: a page is not a scroll view, and a light drift should
  // not carry it a whole screen.
  return Math.abs(translation + project(velocity, 0.99)) > threshold;
}
