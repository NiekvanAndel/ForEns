/**
 * The field layer: which variable is up, which frame is on screen, and what it holds.
 *
 * Owns the manifest, the play head over the frames, and the value rasters behind every
 * number the layer prints. The map mounts all the overlays at once and the play head
 * only flips which one is opaque — the rule `RadarLayer` is built on — so nothing here
 * is loaded while the slider is being dragged.
 *
 * ## The loop opens on the newest frame and plays forwards
 *
 * Every frame is in the past: this is observation, not forecast. So the slider runs
 * oldest-left to newest-right, the loop opens on the right-hand end — the most recent
 * thing there is, which is what a reader opening a weather map wants first — and
 * playing wraps back to the start. The same shape as the radar loop minus its forecast
 * half, which is why there is no boundary marker on the track.
 *
 * ## Every raster, not only the one on screen
 *
 * The bubbles print a number for each saved location *at the frame on screen*, so a
 * loop that plays wants a raster per frame. The active one is fetched first and the
 * rest fill in behind it, so the first pass of the loop is the only one that can be
 * short of a number.
 *
 * This is also the clearest argument for the point endpoint the contract anticipates:
 * to put one figure in one bubble the app is pulling down a whole country's raster per
 * frame. Behind the `FieldSource` interface that swap changes this file and nothing
 * else.
 *
 * ## The layer is off until it is asked for
 *
 * Nothing is fetched until the reader picks a variable. The map's own reason for
 * existing is the nowcast loop, and a reader who never opens the layer menu should not
 * pay for a manifest.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FieldsUnavailable, orderedFrames,
  type FieldFrame, type FieldManifest, type FieldSource, type FieldVariable,
} from '../../core/fields';

/**
 * One frame per this many milliseconds while playing.
 *
 * Slower than the radar loop's 450 ms. A radar frame is five minutes of a shower
 * moving and reads as motion; a field frame is ten minutes of a temperature pattern
 * drifting, and at 450 ms the eye gets a flicker instead of a trend.
 */
export const FIELD_PLAY_INTERVAL_MS = 600;

export type FieldStatus = 'off' | 'loading' | 'ready' | 'unavailable' | 'error';

export interface FieldLayerState {
  /** The variable on the map, or null while the layer is off. */
  variable: FieldVariable | null;
  setVariable: (variable: FieldVariable | null) => void;
  status: FieldStatus;
  manifest: FieldManifest | null;
  /** Oldest first, which is the order the track runs in. */
  frames: FieldFrame[];
  index: number;
  setIndex: (index: number) => void;
  /** The frame on screen. */
  frame: FieldFrame | undefined;
  playing: boolean;
  togglePlay: () => void;
  /** The active frame's raster, once it has arrived. */
  values: Uint16Array | null;
  /** Seconds the server asked us to wait, when it says the layers are not built. */
  retryAfterSec: number | null;
}

export function useFields(source: FieldSource): FieldLayerState {
  const [variable, setVariableState] = useState<FieldVariable | null>(null);
  const [status, setStatus] = useState<FieldStatus>('off');
  const [manifest, setManifest] = useState<FieldManifest | null>(null);
  const [frames, setFrames] = useState<FieldFrame[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rasters, setRasters] = useState<ReadonlyMap<string, Uint16Array>>(new Map());
  const [retryAfterSec, setRetryAfterSec] = useState<number | null>(null);
  /** Frames already being fetched, so a queue restarted by a layer switch cannot ask
   *  for one that is still on its way. */
  const pending = useRef(new Set<string>());

  const setVariable = useCallback((next: FieldVariable | null) => {
    setVariableState(next);
    setPlaying(false);
    if (next == null) {
      setStatus('off');
      setManifest(null);
      setFrames([]);
      setRetryAfterSec(null);
    }
    // The rasters are keyed by variable and frame, so switching variable does not
    // invalidate what is already decoded — a reader flipping between temperature and
    // humidity pays for each of them once.
  }, []);

  // The manifest. Re-run on every variable change, and abandoned if the reader moves
  // on before it lands: a late manifest setting frames for a layer that is no longer
  // up would show the wrong variable's loop.
  useEffect(() => {
    if (!variable) return;
    const controller = new AbortController();
    let cancelled = false;

    setStatus('loading');
    setRetryAfterSec(null);
    source
      .manifest(variable, controller.signal)
      .then((next) => {
        if (cancelled) return;
        const ordered = orderedFrames(next);
        setManifest(next);
        setFrames(ordered);
        // Open on the newest frame. Everything here is observation, so the newest is
        // the one a reader means by "now".
        setIndex(Math.max(0, ordered.length - 1));
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof FieldsUnavailable) {
          setRetryAfterSec(error.retryAfterSec);
          setStatus('unavailable');
        } else {
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [variable, source]);

  // The play head. Wraps, because the loop has no end to stop at.
  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % frames.length),
      FIELD_PLAY_INTERVAL_MS
    );
    return () => clearInterval(id);
  }, [playing, frames.length]);

  // The rasters: the frame on screen first, then the rest, in loop order.
  useEffect(() => {
    if (!variable || !manifest || status !== 'ready' || !frames.length) return;
    const controller = new AbortController();
    let cancelled = false;

    const key = (frame: FieldFrame) => `${variable}/${frame.time}`;
    const queue = [frames[index], ...frames].filter(Boolean) as FieldFrame[];

    (async () => {
      for (const frame of queue) {
        const id = key(frame);
        if (cancelled) return;
        if (pending.current.has(id)) continue;
        // Read through the state setter rather than the captured map, so a frame
        // fetched by the previous pass is not fetched again by this one.
        let have = false;
        setRasters((current) => {
          have = current.has(id);
          return current;
        });
        if (have) continue;

        pending.current.add(id);
        try {
          const values = await source.values(manifest, frame, controller.signal);
          if (cancelled) return;
          setRasters((current) => new Map(current).set(id, values));
        } catch {
          // A frame whose raster will not load simply has no number to print; the
          // overlay is a separate request and is still on the map. Nothing to say.
        } finally {
          pending.current.delete(id);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // `index` is in the list so the frame the reader lands on jumps the queue; the
    // loop above skips whatever is already decoded, so re-running is cheap.
  }, [variable, manifest, status, frames, index, source]);

  const frame = frames[index];

  return {
    variable,
    setVariable,
    status,
    manifest,
    frames,
    index,
    setIndex,
    frame,
    playing,
    togglePlay: useCallback(() => setPlaying((p) => !p), []),
    values: (variable && frame && rasters.get(`${variable}/${frame.time}`)) || null,
    retryAfterSec,
  };
}
