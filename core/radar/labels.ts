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
/**
 * A frame's wall-clock time.
 *
 * "-68 min" is arithmetic a reader has to do against a clock they cannot see. The
 * time itself is the thing they are actually after — "was it raining at half twelve"
 * — so the map badge and the timeline both name the hour.
 */
export function frameClock(frame: RadarFrame | undefined): string {
  if (!frame) return '—';
  const d = new Date(frame.timeMs);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

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


/**
 * The one time axis the radar page reads.
 *
 * The loop and the profile cover different spans — RainViewer's frames run about two
 * hours back, the nowcast two hours forward — and drawing each against its own axis
 * is what left the chart's cursor pinned to the left edge while the slider moved.
 * So both take this: the union of the two, plus where each frame falls within it.
 */
export interface RadarAxis {
  /** Minutes from now at the left edge. */
  from: number;
  /** Minutes from now at the right edge. */
  to: number;
  /** Each frame's position along the axis, 0–1, in frame order. */
  positions: number[];
}

export function radarAxis(
  frames: readonly RadarFrame[],
  profileEndMin: number | null,
  nowMs: number = Date.now()
): RadarAxis | null {
  if (!frames.length) return null;
  const offsets = frames.map((f) => Math.round((f.timeMs - nowMs) / 60_000));
  const from = Math.min(...offsets);
  // The profile reaches past the last frame; without it the curve would be drawn
  // off the right-hand edge of its own axis.
  const to = Math.max(...offsets, profileEndMin ?? -Infinity);
  const span = Math.max(1, to - from);
  return { from, to, positions: offsets.map((o) => (o - from) / span) };
}
