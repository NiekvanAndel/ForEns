/**
 * Forecast context.
 *
 * Drives the staged load from `core/sources` and re-runs `processAll` as each stage
 * lands, which is what lets the hero appear in about a second while the ensemble is
 * still in flight. The web app did this with module globals and direct DOM calls;
 * here each stage updates state and React re-renders what changed.
 *
 * ## The cache behind the swipe
 *
 * Every model built here is kept, keyed by its location. That does two things: a
 * location the reader has already visited comes back instantly instead of through a
 * spinner, and the pager can draw the neighbouring page *during* a swipe rather than
 * after it — the swipe reveals the next location instead of announcing it.
 *
 * The cache holds finished models, not responses, because rebuilding one is
 * `processAll` over the whole 14-day ensemble and the pager needs it inside a frame.
 * Nothing reads one for the location in front, which always re-fetches on selection,
 * so a stale entry can only ever be glimpsed sliding past — and the hero it slides
 * past with names the hour its readings are from.
 *
 * Two things fill it. The location in front fills it as it loads. Its two neighbours
 * are prefetched once that has finished: the first two stages only, which is the
 * hero, the strip and the day rows, and no ensemble — a page being swiped past does
 * not need percentile beams, and they arrive the moment the reader lands on it.
 * Without that prefetch the pager had almost nothing to draw, because a cache filled
 * only by visiting is empty on the swipe that matters.
 *
 * It survives a relaunch through AsyncStorage. Old numbers beat no numbers when the
 * page carries its own timestamp; anything past `CACHE_MAX_AGE_MS` is dropped on
 * load rather than shown, since past that even a labelled forecast is misleading.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { processAll } from '../core/model/process';
import { deriveAlert, type WeatherAlert } from '../core/model/alert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadStage1, loadStage2, loadEnsemble, loadExtended, loadIfsHourly, type HarmonieState,
} from '../core/sources/openMeteo';
import { activeProvider, type NowcastProfile } from '../core/radar';
import type { ForecastModel, WeatherResponse } from '../core/model/types';
import type { SavedLocation } from '../core/prefs';
import { usePrefs } from './prefs';

/** Every response the model builder consumes, held so a later stage can rebuild. */
interface Sources {
  observations: WeatherResponse | null;
  hourly: WeatherResponse | null;
  ensemble: WeatherResponse | null;
  ifs: WeatherResponse | null;
  /** The IFS hourly series behind the day sheets and the per-day humidity extremes. */
  ifsHourly: WeatherResponse | null;
  icons: WeatherResponse | null;
  iconsExt: WeatherResponse | null;
  offsetSec: number;
  harmonie: HarmonieState;
}

const EMPTY: Sources = {
  observations: null, hourly: null, ensemble: null, ifs: null,
  ifsHourly: null, icons: null, iconsExt: null, offsetSec: 0,
  harmonie: { model: null, failed: false, disabled: true },
};

const CACHE_KEY = 'exactcast.models.v1';
/** Past this a cached model is dropped rather than drawn. Six hours is two IFS runs:
 *  old enough to be visibly stale, recent enough to still describe the same weather. */
const CACHE_MAX_AGE_MS = 6 * 3600_000;
/** How many locations are kept on disk — the page in front and its two neighbours,
 *  which is exactly what the pager can reach without another swipe. */
const CACHE_MAX_ENTRIES = 3;
/** Ceiling on what is written to disk, as serialised characters. */
const CACHE_MAX_BYTES = 4_000_000;

interface CacheEntry {
  model: ForecastModel;
  savedMs: number;
}

/**
 * A location's cache key.
 *
 * Coordinates are floats off a geocoder, so they are keyed at a fixed precision
 * rather than compared: four decimals is about ten metres, far finer than any two
 * saved locations are apart.
 *
 * At module scope, not inside the provider. It closes over nothing, and as a `const`
 * in the component body it was declared below its first use — which Babel compiles
 * to a hoisted `var`, so the call site got `undefined` rather than the function, and
 * the provider threw on its first render.
 */
const cacheKey = (lat: number, lon: number) => `${lat.toFixed(4)},${lon.toFixed(4)}`;

export type LoadPhase = 'idle' | 'loading' | 'ready' | 'error';

interface ForecastContextValue {
  model: ForecastModel | null;
  alert: WeatherAlert | null;
  nowcast: NowcastProfile | null;
  harmonie: HarmonieState;
  offsetSec: number;
  phase: LoadPhase;
  error: string | null;
  /** True once days 8–14 have been fetched. */
  extendedLoaded: boolean;
  refresh: () => void;
  loadExtendedDays: () => void;
  /** The last model built for a location, or null if it has not been visited.
   *  Used by the pager to draw a neighbouring page mid-swipe. */
  cachedModel: (lat: number, lon: number) => ForecastModel | null;
}

const ForecastContext = createContext<ForecastContextValue | null>(null);

export function ForecastProvider({ children }: { children: ReactNode }) {
  const { prefs, location } = usePrefs();
  const [sources, setSources] = useState<Sources>(EMPTY);
  const [nowcast, setNowcast] = useState<NowcastProfile | null>(null);
  const [phase, setPhase] = useState<LoadPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [extendedLoaded, setExtendedLoaded] = useState(false);
  const [nonce, setNonce] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  /** Finished models by location. See the note at the top of the file. */
  const cache = useRef(new Map<string, CacheEntry>());
  /** Locations a prefetch is already in flight for, so a re-render cannot start a
   *  second one for the same place. */
  const prefetching = useRef(new Set<string>());
  /** Bumped whenever the cache changes, so the pager re-reads it. */
  const [cacheVersion, setCacheVersion] = useState(0);
  const coords = { lat: location.lat, lon: location.lon };
  const key = `${location.lat},${location.lon},${prefs.useHarmonie},${nonce}`;

  useEffect(() => {
    // Changing location mid-load must not let the old location's slow stages
    // overwrite the new one's fast ones.
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const { signal } = ctrl;
    const live = () => !signal.aborted;

    setPhase('loading');
    setError(null);
    setExtendedLoaded(false);
    setNowcast(null);
    setSources(EMPTY);

    (async () => {
      const s1 = await loadStage1(coords, prefs.useHarmonie, { signal });
      if (!live()) return;

      if (!s1.observations && !s1.hourly) {
        setPhase('error');
        setError('Weerdata is tijdelijk niet beschikbaar. Probeer het later opnieuw.');
        return;
      }
      setSources((p) => ({
        ...p,
        observations: s1.observations,
        hourly: s1.hourly,
        offsetSec: s1.offsetSec,
        harmonie: s1.harmonie,
      }));
      setPhase('ready');

      // The nowcast profile feeds the alert hero; it must not block the day list.
      activeProvider()
        .nowcastProfile(coords.lat, coords.lon, signal)
        .then((p) => { if (live()) setNowcast(p); })
        .catch(() => { /* the hero simply shows no bars */ });

      const s2 = await loadStage2(coords, { signal });
      if (!live()) return;
      setSources((p) => ({ ...p, ifs: s2.ifs, icons: s2.icons }));

      // The ensemble and the IFS hourly series are both slow and neither gates the
      // day list, so they run together after it is already on screen.
      const [ens, ifsHourly] = await Promise.all([
        loadEnsemble(coords, 7, { signal }),
        loadIfsHourly(coords, 7, { signal }),
      ]);
      if (!live()) return;
      setSources((p) => ({ ...p, ensemble: ens, ifsHourly: ifsHourly ?? p.ifsHourly }));
    })().catch((e) => {
      if (!live()) return;
      setPhase('error');
      setError((e as Error)?.message ?? 'Onbekende fout');
    });

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loadExtendedDays = useCallback(() => {
    if (extendedLoaded) return;
    setExtendedLoaded(true);
    const ctrl = abortRef.current;
    const signal = ctrl?.signal;
    (async () => {
      const [ext, ens, ifsHourly] = await Promise.all([
        loadExtended(coords, { signal }),
        loadEnsemble(coords, 14, { signal }),
        loadIfsHourly(coords, 16, { signal }),
      ]);
      if (signal?.aborted) return;
      setSources((p) => ({
        ...p,
        ifs: ext.ifs ?? p.ifs,
        iconsExt: ext.icons ?? p.iconsExt,
        ensemble: ens ?? p.ensemble,
        ifsHourly: ifsHourly ?? p.ifsHourly,
      }));
    })().catch(() => setExtendedLoaded(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extendedLoaded, coords.lat, coords.lon]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const built = useMemo(
    () =>
      processAll(
        sources.observations,
        sources.hourly,
        sources.ensemble,
        sources.ifs, // sunshine and ET0 arrive inside the IFS daily response
        sources.ifs,
        // The hourly series: precipitation and weather codes per hour, and the
        // temperature/dew-point pair the per-day humidity extremes come from. Until
        // it lands the daily response stands in, which carries neither, so those
        // fields simply stay empty rather than being wrong.
        sources.ifsHourly,
        {
          lat: location.lat,
          lon: location.lon,
          useHarmonie: prefs.useHarmonie,
          harmFailed: sources.harmonie.failed,
          ecmwfHourly: sources.icons,
          ecmwfHourlyExt: sources.iconsExt,
        }
      ),
    [sources, location.lat, location.lon, prefs.useHarmonie]
  );

  /**
   * What the page shows: the live model, or the cached one until it arrives.
   *
   * Landing on a location resets the sources, so for the second or two before stage
   * one comes back there is nothing to draw — and the page the reader had just
   * swiped into view would blank out and show a spinner, undoing the very thing the
   * swipe was for. If that location is in the cache, it stays on screen until the
   * fresh one replaces it. The hero says which hour its readings are from, so a
   * stale one announces itself.
   *
   * Only `built` is written back to the cache, so a cached model cannot re-stamp
   * itself as fresh and outlive its own expiry.
   */
  const model = useMemo(
    () => built ?? cache.current.get(cacheKey(location.lat, location.lon))?.model ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cacheVersion is the point
    [built, location.lat, location.lon, cacheVersion]
  );

  /** Put a model in the cache and let the pager know there is something new. */
  const remember = useCallback((lat: number, lon: number, m: ForecastModel) => {
    cache.current.set(cacheKey(lat, lon), { model: m, savedMs: Date.now() });
    setCacheVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!built) return;
    remember(location.lat, location.lon, built);
  }, [built, location.lat, location.lon, remember]);

  const cachedModel = useCallback(
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cacheVersion is the point
    (lat: number, lon: number) => cache.current.get(cacheKey(lat, lon))?.model ?? null,
    [cacheVersion]
  );

  // ── Read the cache back at startup. ──
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        const stored = JSON.parse(raw) as Record<string, CacheEntry>;
        const cutoff = Date.now() - CACHE_MAX_AGE_MS;
        let added = 0;
        for (const [k, entry] of Object.entries(stored)) {
          // Never overwrite something this session already fetched, and never
          // resurrect a forecast old enough to describe different weather.
          if (cache.current.has(k)) continue;
          if (!entry?.model || !(entry.savedMs > cutoff)) continue;
          cache.current.set(k, entry);
          added++;
        }
        if (added) setCacheVersion((v) => v + 1);
      })
      .catch(() => {
        // Unreadable or corrupt: the cache is an optimisation, so losing it costs a
        // swipe that shows a blank page rather than anything the app needs.
      });
    return () => { alive = false; };
  }, []);

  // ── Write it back, keeping only what the pager can reach. ──
  useEffect(() => {
    if (!cacheVersion) return;
    const reachable = new Set(
      [prefs.activeLocation - 1, prefs.activeLocation, prefs.activeLocation + 1]
        .map((i) => prefs.locations[(i + prefs.locations.length) % prefs.locations.length])
        .filter((l): l is SavedLocation => !!l)
        .map((l) => cacheKey(l.lat, l.lon))
    );
    const out: Record<string, CacheEntry> = {};
    let kept = 0;
    for (const [k, entry] of cache.current) {
      if (!reachable.has(k) || kept >= CACHE_MAX_ENTRIES) continue;
      out[k] = entry;
      kept++;
    }
    const payload = JSON.stringify(out);
    // Three full models are a few hundred kilobytes; an order of magnitude past that
    // means something unexpected, and a write that size is not worth blocking on.
    if (payload.length > CACHE_MAX_BYTES) return;
    AsyncStorage.setItem(CACHE_KEY, payload).catch(() => {
      // A failed write costs the next launch its head start, not this session.
    });
  }, [cacheVersion, prefs.activeLocation, prefs.locations]);

  // ── Prefetch the neighbours, once the page in front is done. ──
  //
  // Stages 1 and 2 only. That is the hero, the hourly strip and the day rows; the
  // ensemble behind the beams is the slowest call the app makes and a page sliding
  // past does not need it. Landing on the location runs the full load anyway.
  useEffect(() => {
    if (phase !== 'ready' || prefs.locations.length < 2) return;
    const ctrl = new AbortController();
    const { signal } = ctrl;

    const neighbours = [prefs.activeLocation - 1, prefs.activeLocation + 1]
      .map((i) => prefs.locations[(i + prefs.locations.length) % prefs.locations.length])
      .filter((l): l is SavedLocation => !!l)
      .filter((l) => cacheKey(l.lat, l.lon) !== cacheKey(location.lat, location.lon));

    for (const l of neighbours) {
      const k = cacheKey(l.lat, l.lon);
      const entry = cache.current.get(k);
      const fresh = entry && Date.now() - entry.savedMs < CACHE_MAX_AGE_MS;
      if (fresh || prefetching.current.has(k)) continue;
      prefetching.current.add(k);

      (async () => {
        const coords = { lat: l.lat, lon: l.lon };
        const s1 = await loadStage1(coords, prefs.useHarmonie, { signal });
        if (signal.aborted || (!s1.observations && !s1.hourly)) return;
        const s2 = await loadStage2(coords, { signal });
        if (signal.aborted) return;
        const built = processAll(
          s1.observations, s1.hourly, null, s2.ifs, s2.ifs, null,
          {
            lat: l.lat,
            lon: l.lon,
            useHarmonie: prefs.useHarmonie,
            harmFailed: s1.harmonie.failed,
            ecmwfHourly: s2.icons,
            ecmwfHourlyExt: null,
          }
        );
        if (built) remember(l.lat, l.lon, built);
      })()
        .catch(() => {
          // A neighbour that will not load leaves an empty page under the swipe,
          // which is what the pager already handles.
        })
        .finally(() => {
          prefetching.current.delete(k);
        });
    }

    return () => ctrl.abort();
  }, [
    phase, prefs.activeLocation, prefs.locations, prefs.useHarmonie,
    location.lat, location.lon, remember,
  ]);

  const alert = useMemo(() => deriveAlert(model, nowcast), [model, nowcast]);

  const value = useMemo<ForecastContextValue>(
    () => ({
      model, alert, nowcast,
      harmonie: sources.harmonie,
      offsetSec: sources.offsetSec,
      phase, error, extendedLoaded, refresh, loadExtendedDays, cachedModel,
    }),
    [
      model, alert, nowcast, sources.harmonie, sources.offsetSec, phase, error,
      extendedLoaded, refresh, loadExtendedDays, cachedModel,
    ]
  );

  return <ForecastContext.Provider value={value}>{children}</ForecastContext.Provider>;
}

/**
 * A model that stands in for the loaded one, for one subtree.
 *
 * The pager's neighbour pages read their forecast from the cache above through this,
 * exactly as they read their location through `LocationOverrideProvider`. Only the
 * three fields a page renders from are overridden; the loading phase reads 'ready',
 * because a cached model is not loading, and the actions stay pointed at the real
 * provider so a stray press on a page sliding past cannot start a fetch for it.
 */
const ForecastOverrideContext = createContext<{
  model: ForecastModel;
  alert: WeatherAlert | null;
} | null>(null);

export function ForecastOverrideProvider({
  model, alert, children,
}: { model: ForecastModel; alert: WeatherAlert | null; children: ReactNode }) {
  const value = useMemo(() => ({ model, alert }), [model, alert]);
  return (
    <ForecastOverrideContext.Provider value={value}>{children}</ForecastOverrideContext.Provider>
  );
}

export function useForecast(): ForecastContextValue {
  const ctx = useContext(ForecastContext);
  const override = useContext(ForecastOverrideContext);
  if (!ctx) throw new Error('useForecast must be used inside a ForecastProvider');
  if (!override) return ctx;
  return {
    ...ctx,
    model: override.model,
    alert: override.alert,
    // A neighbour's nowcast is not cached — it is two hours of minutely data for a
    // place the reader may not stop on — so its alert hero shows the model's own
    // reading of the next hours and no radar profile.
    nowcast: null,
    phase: 'ready',
  };
}
