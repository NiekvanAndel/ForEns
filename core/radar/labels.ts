/**
 * Frame labelling for the radar timeline.
 *
 * Pure, and therefore in core/ rather than in the Timeline component: the labels
 * are logic the tests can reach without pulling React Native into the test runner,
 * and the widget will want the same wording.
 */
import type { RadarFrame } from './types';

/** Radar frames land on a five-minute grid, so the newest observation is usually a
 *  few minutes old and should still read as the present. */
const NOW_TOLERANCE_MIN = 5;

/** Label for a frame relative to now: "nu", "-45 min", "+30 min". */
export function frameLabel(frame: RadarFrame | undefined, nowMs: number = Date.now()): string {
  if (!frame) return '—';
  const deltaMin = Math.round((frame.timeMs - nowMs) / 60000);
  if (Math.abs(deltaMin) <= NOW_TOLERANCE_MIN) return 'nu';
  if (deltaMin < 0) return `${deltaMin} min`;
  return `+${deltaMin} min`;
}

/** Intensity at an arbitrary offset, linearly between the two nearest samples —
 *  the profile is 5-minutely at best, and the scrubber moves between them. */
export function intensityAt(
  bars: readonly { offsetMin: number; mmPerHour: number }[],
  offsetMin: number
): number {
  if (!bars.length) return 0;
  const first = bars[0]!;
  const last = bars[bars.length - 1]!;
  if (offsetMin <= first.offsetMin) return first.mmPerHour;
  if (offsetMin >= last.offsetMin) return last.mmPerHour;

  for (let i = 1; i < bars.length; i++) {
    const a = bars[i - 1]!;
    const b = bars[i]!;
    if (offsetMin <= b.offsetMin) {
      const spanMin = b.offsetMin - a.offsetMin || 1;
      const f = (offsetMin - a.offsetMin) / spanMin;
      return a.mmPerHour + (b.mmPerHour - a.mmPerHour) * f;
    }
  }
  return last.mmPerHour;
}

