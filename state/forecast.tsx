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
 * It is not a network cache: entries never expire, but nothing reads one for the
 * location in front, which always re-fetches on selection.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { processAll } from '../core/model/process';
import { deriveAlert, type WeatherAlert } from '../core/model/alert';
import {
  loadStage1, loadStage2, loadEnsemble, loadExtended, loadIfsHourly, type HarmonieState,
} from '../core/sources/openMeteo';
import { activeProvider, type NowcastProfile } from '../core/radar';
import type { ForecastModel, WeatherResponse } from '../core/model/types';
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
  const cache = useRef(new Map<string, ForecastModel>());
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

  const model = useMemo(
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

  // Coordinates are floats off a geocoder, so they are keyed at a fixed precision
  // rather than compared: four decimals is about ten metres, far finer than any two
  // saved locations are apart.
  const cacheKey = (lat: number, lon: number) => `${lat.toFixed(4)},${lon.toFixed(4)}`;

  useEffect(() => {
    if (!model) return;
    cache.current.set(cacheKey(location.lat, location.lon), model);
  }, [model, location.lat, location.lon]);

  const cachedModel = useCallback(
    (lat: number, lon: number) => cache.current.get(cacheKey(lat, lon)) ?? null,
    []
  );

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
