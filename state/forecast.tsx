/**
 * Forecast context.
 *
 * Drives the staged load from `core/sources` and re-runs `processAll` as each stage
 * lands, which is what lets the hero appear in about a second while the ensemble is
 * still in flight. The web app did this with module globals and direct DOM calls;
 * here each stage updates state and React re-renders what changed.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { processAll } from '../core/model/process';
import { deriveAlert, type WeatherAlert } from '../core/model/alert';
import {
  loadStage1, loadStage2, loadEnsemble, loadExtended, type HarmonieState,
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
  icons: WeatherResponse | null;
  iconsExt: WeatherResponse | null;
  offsetSec: number;
  harmonie: HarmonieState;
}

const EMPTY: Sources = {
  observations: null, hourly: null, ensemble: null, ifs: null,
  icons: null, iconsExt: null, offsetSec: 0,
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

      const ens = await loadEnsemble(coords, 7, { signal });
      if (!live()) return;
      setSources((p) => ({ ...p, ensemble: ens }));
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
      const [ext, ens] = await Promise.all([
        loadExtended(coords, { signal }),
        loadEnsemble(coords, 14, { signal }),
      ]);
      if (signal?.aborted) return;
      setSources((p) => ({
        ...p,
        ifs: ext.ifs ?? p.ifs,
        iconsExt: ext.icons ?? p.iconsExt,
        ensemble: ens ?? p.ensemble,
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
        sources.ifs, // sunshine and ET0 arrive inside the IFS response
        sources.ifs,
        sources.ifs,
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

  const alert = useMemo(() => deriveAlert(model, nowcast), [model, nowcast]);

  const value = useMemo<ForecastContextValue>(
    () => ({
      model, alert, nowcast,
      harmonie: sources.harmonie,
      offsetSec: sources.offsetSec,
      phase, error, extendedLoaded, refresh, loadExtendedDays,
    }),
    [model, alert, nowcast, sources.harmonie, sources.offsetSec, phase, error, extendedLoaded, refresh, loadExtendedDays]
  );

  return <ForecastContext.Provider value={value}>{children}</ForecastContext.Provider>;
}

export function useForecast(): ForecastContextValue {
  const ctx = useContext(ForecastContext);
  if (!ctx) throw new Error('useForecast must be used inside a ForecastProvider');
  return ctx;
}
