/**
 * The radar loop, fetched once for whichever page is showing it.
 *
 * Two pages draw the same frames now — the radar card and the map page behind the
 * top row's map button — and they have to agree about which frame is on screen, or
 * stepping from one to the other would restart the loop at a different minute.
 *
 * They are not shared through the query cache: the frames are a small list of URLs
 * with a play head running over them, and the play head is what the pages are really
 * about. So each page owns its own copy of this hook and its own index, and what
 * they share is the code that decides where a loop opens — on the latest observation,
 * never on the oldest frame or on a forecast.
 *
 * ## The play head runs here, not in the scrubber
 *
 * It used to run inside `Timeline`, on the reasonable-looking grounds that the
 * scrubber is what shows it. But the scrubber is not always on screen now — the
 * chart above it is the usual way to scrub, and the slider only appears where there
 * is no curve to drag — and playback that stops because its own progress bar was
 * hidden is a bug waiting in the wings. Whoever owns the index owns the timer.
 */
import { useCallback, useEffect, useState } from 'react';
import { activeProvider, type RadarFrame } from '../../core/radar';

/** One step per this many milliseconds during playback, matching the design's 450ms. */
export const PLAY_INTERVAL_MS = 450;

export interface RadarFrames {
  frames: RadarFrame[];
  index: number;
  setIndex: (index: number) => void;
  playing: boolean;
  togglePlay: () => void;
  loading: boolean;
  /**
   * Fetch the loop.
   *
   * `showSpinner` false is the pull-to-refresh path: the frames on screen are a few
   * minutes old, not wrong, and blanking the map to a spinner for a manual refresh
   * loses the reader's place in the loop for no gain. The control at the top of the
   * page already says it is working.
   */
  fetch: (signal?: AbortSignal, showSpinner?: boolean) => Promise<void>;
}

export function useRadarFrames(): RadarFrames {
  const [frames, setFrames] = useState<RadarFrame[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % frames.length),
      PLAY_INTERVAL_MS
    );
    return () => clearInterval(id);
  }, [playing, frames.length]);

  const fetch = useCallback((signal?: AbortSignal, showSpinner = true) => {
    if (showSpinner) setLoading(true);
    return activeProvider()
      .listFrames(signal)
      .then((f) => {
        if (signal?.aborted) return;
        setFrames([...f.past, ...f.forecast]);
        // Open on the latest observation, not on the oldest frame or a forecast.
        setIndex(Math.max(0, f.past.length - 1));
      })
      .catch(() => {
        if (signal?.aborted) return;
        // A failed refresh keeps the frames it already has; only a failed first load
        // has nothing to fall back on.
        if (showSpinner) setFrames([]);
      })
      .finally(() => {
        if (!signal?.aborted && showSpinner) setLoading(false);
      });
  }, []);

  return {
    frames, index, setIndex, playing, loading, fetch,
    togglePlay: useCallback(() => setPlaying((p) => !p), []),
  };
}

/**
 * The frame nearest a position along the shared axis.
 *
 * The chart's cursor and the scrubber's thumb run on one axis so the two read as one
 * control, which means a fraction of that axis has to come back to a frame index.
 * Both pages do it, identically, so it lives here.
 */
export function frameAtFraction(positions: readonly number[] | undefined, fraction: number): number | null {
  if (!positions?.length) return null;
  let best = 0;
  let bestDistance = Infinity;
  positions.forEach((p, i) => {
    const d = Math.abs(p - fraction);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  return best;
}
