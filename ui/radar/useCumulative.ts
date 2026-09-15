/**
 * The cumulative rainfall layer: which window is on screen, and what it holds.
 *
 * Owns the manifest, the window the slider is on, the play head that walks the
 * windows, and the value raster behind the read-out. The map draws all six overlays
 * at once and flips opacity between them — the rule `RadarLayer` already lives by —
 * so nothing here loads anything while the slider is being dragged.
 *
 * ## Why the play head runs forwards through *longer* windows
 *
 * The windows nest, so stepping to a longer one can only add rain. Played from the
 * shortest to the longest, the field fills in and the total climbs: the reader sees
 * the shower accumulate rather than a slideshow of six unrelated pictures. On the
 * slider that is a thumb moving leftwards, because the track is a time axis whose
 * right-hand end is the anchor — see `slidingWindows`.
 *
 * ## The layer is off until it is asked for
 *
 * Nothing is fetched until the reader turns the layer on. The map's own reason for
 * existing is the nowcast loop, and a reader who never opens the layer menu should
 * not pay for a manifest, let alone six rasters.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CumulativeUnavailable, slidingWindows, windowOf,
  type CumulativeManifest, type CumulativeSource, type CumulativeWindow,
} from '../../core/radar/cumulative';

/** One window per this many milliseconds while playing. Slower than the radar loop's
 *  450ms: each step here is a different total to read, not another frame of motion. */
export const WINDOW_PLAY_INTERVAL_MS = 800;

/** Which window the layer opens on. A day is the span most questions are about —
 *  "how much did we get overnight" — and it is long enough that the coverage
 *  warnings, when there are any, are on screen from the start rather than surprising
 *  the reader three steps into the slider. */
export const DEFAULT_WINDOW_HOURS = 24;

export type CumulativeStatus = 'off' | 'loading' | 'ready' | 'unavailable' | 'error';

export interface CumulativeLayerState {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  status: CumulativeStatus;
  manifest: CumulativeManifest | null;
  /** Longest first, which is the order the slider's track runs in. */
  windows: CumulativeWindow[];
  index: number;
  setIndex: (index: number) => void;
  /** The window the slider is on. */
  window: CumulativeWindow | undefined;
  playing: boolean;
  togglePlay: () => void;
  /** The active window's raster, once it has arrived. */
  values: Uint16Array | null;
  /** Seconds the server asked us to wait, when it says the layers are not built. */
  retryAfterSec: number | null;
}

export function useCumulative(source: CumulativeSource): CumulativeLayerState {
  const [enabled, setEnabledState] = useState(false);
  const [status, setStatus] = useState<CumulativeStatus>('off');
  const [manifest, setManifest] = useState<CumulativeManifest | null>(null);
  const [windows, setWindows] = useState<CumulativeWindow[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [values, setValues] = useState<Uint16Array | null>(null);
  const [retryAfterSec, setRetryAfterSec] = useState<number | null>(null);
  // Rasters already decoded. Small, and the slider walks back over windows it has
  // shown before; refetching one mid-drag would stall the read-out for no reason.
  const rasters = useRef(new Map<number, Uint16Array>());

  const window = windows[index];

  // The manifest, once, the first time the layer is switched on.
  useEffect(() => {
    if (!enabled || manifest) return;
    const ctrl = new AbortController();
    setStatus('loading');

    source
      .manifest(ctrl.signal)
      .then((m) => {
        if (ctrl.signal.aborted) return;
        const ordered = slidingWindows(m);
        setManifest(m);
        setWindows(ordered);
        // Open on the default window where the server publishes it, rather than on
        // whichever end of the list happens to be first.
        const preferred = windowOf(m, DEFAULT_WINDOW_HOURS);
        const at = preferred ? ordered.indexOf(preferred) : -1;
        setIndex(at >= 0 ? at : Math.max(0, ordered.length - 1));
        setStatus('ready');
        setRetryAfterSec(null);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        // Not built yet is a state the panel renders, not a failure: the server is
        // telling us to come back, and how soon.
        if (e instanceof CumulativeUnavailable) {
          setRetryAfterSec(e.retryAfterSec);
          setStatus('unavailable');
          return;
        }
        setStatus('error');
      });

    return () => ctrl.abort();
  }, [enabled, manifest, source]);

  // The active window's raster. The overlay is already on screen by now — the picture
  // never waits for the numbers behind it.
  useEffect(() => {
    if (!enabled || !window) return;
    const cached = rasters.current.get(window.hours);
    if (cached) {
      setValues(cached);
      return;
    }

    const ctrl = new AbortController();
    // Whatever is on screen belongs to the previous window; keeping it would print a
    // 24 hour total under a 48 hour picture.
    setValues(null);
    source
      .values(window, ctrl.signal)
      .then((raster) => {
        if (ctrl.signal.aborted) return;
        rasters.current.set(window.hours, raster);
        setValues(raster);
      })
      .catch(() => {
        // The read-out simply has nothing to say; the layer itself is unaffected, so
        // this is not the panel's error state.
        if (!ctrl.signal.aborted) setValues(null);
      });

    return () => ctrl.abort();
  }, [enabled, window, source]);

  useEffect(() => {
    if (!playing || windows.length < 2) return;
    const id = setInterval(() => {
      // Backwards through the list, which is forwards through window length: the
      // total grows with every step and then starts over at the shortest.
      setIndex((i) => (i - 1 + windows.length) % windows.length);
    }, WINDOW_PLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [playing, windows.length]);

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    // Only the play head is reset. The manifest and the rasters are kept, so turning
    // the layer back on is instant — and the status is derived below rather than
    // written here, or a second switch-on would sit at 'off' with nothing to fetch.
    if (!on) setPlaying(false);
  }, []);

  return {
    enabled,
    setEnabled,
    // 'off' is the state of the layer, not of the data: what was loaded stays loaded.
    status: enabled ? status : 'off',
    manifest,
    windows,
    index,
    setIndex: useCallback((next: number) => {
      setIndex(next);
      // Dragging is a deliberate choice of window; carrying on stepping past it would
      // take the reader straight off the one they just picked.
      setPlaying(false);
    }, []),
    window,
    playing,
    togglePlay: useCallback(() => setPlaying((p) => !p), []),
    values,
    retryAfterSec,
  };
}
