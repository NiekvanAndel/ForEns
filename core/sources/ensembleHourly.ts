/**
 * Hourly ensemble precipitation for a single day.
 *
 * Ported from index.html's `getEnsForDay`. The 51-member hourly series is far too
 * large to fetch for the whole horizon, so it is requested one day at a time when a
 * detail sheet opens, and cached for as long as the location is unchanged.
 *
 * This is what turns "2 mm tomorrow" into "here is the hour it falls in, and how
 * much the members disagree about it".
 */
import { tryFetchJson, type FetchOptions } from './http';
import { percentile, probAtLeast, round1 } from '../model/stats';

const ENSEMBLE = 'https://ensemble-api.open-meteo.com/v1/ensemble';

export interface HourEnsemble {
  /** Probability of measurable precipitation in this hour, 0–100. */
  pChance: number;
  precipP10: number;
  precipP25: number;
  precipP50: number;
  precipP75: number;
  precipP90: number;
}

/** Per-hour ensemble, keyed by the local timestamp the rest of the model uses. */
export type DayEnsemble = Record<string, HourEnsemble>;

interface EnsembleResponse {
  hourly?: Record<string, unknown>;
}

export async function fetchDayEnsemble(
  lat: number,
  lon: number,
  date: string,
  opts: FetchOptions = {}
): Promise<DayEnsemble> {
  const url =
    `${ENSEMBLE}?latitude=${lat}&longitude=${lon}&hourly=precipitation` +
    `&models=ecmwf_ifs025&start_date=${date}&end_date=${date}&timezone=auto`;

  const json = await tryFetchJson<EnsembleResponse>(url, 'ENS-uur', opts);
  return parseDayEnsemble(json);
}

/** Split out from the fetch so the parsing can be tested without a network. */
export function parseDayEnsemble(json: EnsembleResponse | null): DayEnsemble {
  const hourly = json?.hourly;
  if (!hourly) return {};
  const times = (hourly.time as string[] | undefined) ?? [];

  const members = Object.keys(hourly)
    .filter((k) => k.startsWith('precipitation_member'))
    .map((k) => hourly[k] as (number | null)[]);
  // A response without member columns still carries a single deterministic series.
  const series = members.length
    ? members
    : [(hourly.precipitation as (number | null)[] | undefined) ?? []];

  const out: DayEnsemble = {};
  for (let i = 0; i < times.length; i++) {
    const values = series.map((m) => m[i] ?? 0);
    out[times[i] as string] = {
      pChance: Math.round(probAtLeast(values, 0.1)),
      precipP10: round1(percentile(values, 10) as number),
      precipP25: round1(percentile(values, 25) as number),
      precipP50: round1(percentile(values, 50) as number),
      precipP75: round1(percentile(values, 75) as number),
      precipP90: round1(percentile(values, 90) as number),
    };
  }
  return out;
}

/**
 * A per-location cache.
 *
 * Keyed by coordinates as well as date: the same date at a different place is a
 * different forecast, and a cache that ignored that would show one city's rain on
 * another's sheet.
 */
export class DayEnsembleCache {
  private readonly entries = new Map<string, DayEnsemble>();
  private readonly inFlight = new Map<string, Promise<DayEnsemble>>();

  private key(lat: number, lon: number, date: string): string {
    return `${lat.toFixed(4)},${lon.toFixed(4)},${date}`;
  }

  get(lat: number, lon: number, date: string): DayEnsemble | undefined {
    return this.entries.get(this.key(lat, lon, date));
  }

  async load(
    lat: number,
    lon: number,
    date: string,
    opts: FetchOptions = {}
  ): Promise<DayEnsemble> {
    const k = this.key(lat, lon, date);
    const cached = this.entries.get(k);
    if (cached) return cached;

    // Opening and reopening a sheet quickly must not fire the request twice.
    const pending = this.inFlight.get(k);
    if (pending) return pending;

    const p = fetchDayEnsemble(lat, lon, date, opts)
      .then((data) => {
        this.entries.set(k, data);
        return data;
      })
      .finally(() => this.inFlight.delete(k));

    this.inFlight.set(k, p);
    return p;
  }

  clear(): void {
    this.entries.clear();
  }
}
