/**
 * The cumulative rainfall layer: which window is on screen, and what it holds.
 *
 * Owns the manifest, the window the slider is on, the play head that walks the
 * windows, and the value rasters behind every number the layer prints. The map draws
 * all six overlays at once and flips opacity between them — the rule `RadarLayer`
 * already lives by — so nothing here loads anything while the slider is being
 * dragged.
 *
 * ## Why the play head runs towards *longer* windows
 *
 * The windows nest, so stepping to a longer one can only add rain. Played from the
 * shortest to the longest, the field fills in and the total climbs: the reader sees
 * the shower accumulate rather than a slideshow of six unrelated pictures. The slider
 * is ordered to match — shortest at the left — so the thumb travels with the number
 * instead of sliding backwards under a rising total.
 *
 * ## Every raster, not only the one on screen
 *
 * The panel draws the accumulation curve across all six windows at once, so all six
 * rasters are wanted rather than the active one. One queue fetches them in the
 * background, always taking the window in front next, and the curve fills in as they
 * land — a chart that waits for its last point is blank for as long as the slowest
 * request.
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
 *  "how much did we get overnight" — and it is long enough that the accumulation
 *  curve has somewhere to go in both directions from the start. */
export const DEFAULT_WINDOW_HOURS = 24;

export type CumulativeStatus = 'off' | 'loading' | 'ready' | 'unavailable' | 'error';

export interface CumulativeLayerState {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  status: CumulativeStatus;
  manifest: CumulativeManifest | null;
  /** Shortest first, which is the order the slider's track runs in. */
  windows: CumulativeWindow[];
  index: number;
  setIndex: (index: number) => void;
  /** The window the slider is on. */
  window: CumulativeWindow | undefined;
  playing: boolean;
  togglePlay: () => void;
  /** Every raster decoded so far, by window length. */
  rasters: ReadonlyMap<number, Uint16Array>;
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
  const [rasters, setRasters] = useState<ReadonlyMap<number, Uint16Array>>(new Map());
  const [retryAfterSec, setRetryAfterSec] = useState<number | null>(null);
  // Windows already being fetched, so a queue restarted by a switch-off and back on
  // cannot ask for one that is still on its way.
  const inFlight = useRef(new Set<number>());
  // Mirrors the state above, so `load` can skip a window it already has without
  // taking the map as a dependency and rebuilding itself on every arrival.
  const rastersRef = useRef(rasters);
  rastersRef.current = rasters;

  const window = windows[index];
  // Read by the fetch queue to decide what to pull next. A ref rather than a
  // dependency: the queue follows the slider, it does not restart with it.
  const activeHours = useRef<number | undefined>(window?.hours);
  activeHours.current = window?.hours;

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
        // Open on the default window where the server publishes it; without it, the
        // shortest, which is the cheapest thing to show and the one least likely to
        // be read as a claim about the whole of yesterday.
        const preferred = windowOf(m, DEFAULT_WINDOW_HOURS);
        const at = preferred ? ordered.indexOf(preferred) : -1;
        setIndex(at >= 0 ? at : 0);
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

  /** Fetch one window's raster, unless it is already here or already on its way. */
  const load = useCallback(
    async (target: CumulativeWindow, signal?: AbortSignal) => {
      if (rastersRef.current.has(target.hours) || inFlight.current.has(target.hours)) return;
      inFlight.current.add(target.hours);
      try {
        const raster = await source.values(target, signal);
        if (signal?.aborted) return;
        setRasters((prev) => new Map(prev).set(target.hours, raster));
      } catch {
        // The read-out and the curve simply have nothing to say for this window; the
        // overlay itself is unaffected, so this is not the panel's error state.
      } finally {
        inFlight.current.delete(target.hours);
      }
    },
    [source]
  );

  // One queue, serving whichever window is in front next.
  //
  // Sequential rather than parallel: six rasters at once on a mobile connection
  // delays the one being looked at. And the order is read from a ref at each step
  // rather than from the effect's own dependencies, so dragging the slider changes
  // what is fetched next without tearing down a request that is already running —
  // which, with the queue restarting on every arrival, is a loop rather than a load.
  useEffect(() => {
    if (!enabled || !windows.length) return;
    const ctrl = new AbortController();

    (async () => {
      const remaining = new Map(windows.map((w) => [w.hours, w]));
      while (remaining.size && !ctrl.signal.aborted) {
        const front = activeHours.current;
        const hours = front != null && remaining.has(front) ? front : [...remaining.keys()][0]!;
        const target = remaining.get(hours)!;
        remaining.delete(hours);
        await load(target, ctrl.signal);
      }
    })();

    return () => ctrl.abort();
  }, [enabled, windows, load]);

  useEffect(() => {
    if (!playing || windows.length < 2) return;
    const id = setInterval(() => {
      // Forwards through the list, which is forwards through window length: the total
      // grows with every step and then starts over at the shortest.
      setIndex((i) => (i + 1) % windows.length);
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
    rasters,
    values: window ? rasters.get(window.hours) ?? null : null,
    retryAfterSec,
  };
}
