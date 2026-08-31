/**
 * The hourly ensemble for a single day.
 *
 * Ported from index.html's `getEnsForDay`. The 51-member hourly series is far too
 * large to fetch for the whole horizon, so it is requested one day at a time when a
 * detail sheet opens, and cached for as long as the location is unchanged.
 *
 * This is what turns "2 mm tomorrow" into "here is the hour it falls in, and how
 * much the members disagree about it" — and the same for the temperature and the
 * wind, which carry a spread worth reading too: a front arriving two hours early
 * shows up as members disagreeing about one afternoon hour long before it shows up
 * in a daily maximum.
 */
import { tryFetchJson, type FetchOptions } from './http';
import { percentile, probAtLeast, round1 } from '../model/stats';

const ENSEMBLE = 'https://ensemble-api.open-meteo.com/v1/ensemble';

/** The members' spread for one quantity in one hour. */
export interface HourSpread {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface HourEnsemble {
  /** Probability of measurable precipitation in this hour, 0–100. */
  pChance: number;
  precipP10: number;
  precipP25: number;
  precipP50: number;
  precipP75: number;
  precipP90: number;
  /** Present once the response carries the member columns for these. */
  temp?: HourSpread;
  wind?: HourSpread;
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
  // One call for all three: three separate day-sheet fetches of the same 51 members
  // would be three times the wait for the same rows.
  const url =
    `${ENSEMBLE}?latitude=${lat}&longitude=${lon}` +
    `&hourly=precipitation,temperature_2m,windspeed_10m` +
    `&models=ecmwf_ifs025&start_date=${date}&end_date=${date}&timezone=auto`;

  const json = await tryFetchJson<EnsembleResponse>(url, 'ENS-uur', opts);
  return parseDayEnsemble(json);
}

/** Split out from the fetch so the parsing can be tested without a network. */
/** The member columns for one field, e.g. `temperature_2m_member01…`. A response
 *  without them still carries the plain deterministic series, which is treated as a
 *  one-member ensemble rather than as missing. */
function memberSeries(
  hourly: Record<string, unknown>,
  field: string
): (number | null)[][] {
  const members = Object.keys(hourly)
    .filter((k) => k.startsWith(`${field}_member`))
    .sort()
    .map((k) => hourly[k] as (number | null)[]);
  if (members.length) return members;
  const plain = hourly[field] as (number | null)[] | undefined;
  return plain ? [plain] : [];
}

/** Percentiles at one hour, or undefined where the field is absent. Nulls are
 *  dropped rather than counted as zero, which for a temperature would drag the
 *  whole spread toward freezing. */
function spreadAt(series: (number | null)[][], i: number): HourSpread | undefined {
  if (!series.length) return undefined;
  const values = series
    .map((m) => m[i])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!values.length) return undefined;
  return {
    p10: round1(percentile(values, 10) as number),
    p25: round1(percentile(values, 25) as number),
    p50: round1(percentile(values, 50) as number),
    p75: round1(percentile(values, 75) as number),
    p90: round1(percentile(values, 90) as number),
  };
}

export function parseDayEnsemble(json: EnsembleResponse | null): DayEnsemble {
  const hourly = json?.hourly;
  if (!hourly) return {};
  const times = (hourly.time as string[] | undefined) ?? [];

  const precip = memberSeries(hourly, 'precipitation');
  const temp = memberSeries(hourly, 'temperature_2m');
  const wind = memberSeries(hourly, 'windspeed_10m');

  const out: DayEnsemble = {};
  for (let i = 0; i < times.length; i++) {
    // A missing hour in a precipitation member means no rain, so nulls count as
    // zero here — unlike temperature, where a gap is simply unknown.
    const rain = precip.map((m) => m[i] ?? 0);
    out[times[i] as string] = {
      pChance: Math.round(probAtLeast(rain, 0.1)),
      precipP10: round1(percentile(rain, 10) as number),
      precipP25: round1(percentile(rain, 25) as number),
      precipP50: round1(percentile(rain, 50) as number),
      precipP75: round1(percentile(rain, 75) as number),
      precipP90: round1(percentile(rain, 90) as number),
      temp: spreadAt(temp, i),
      wind: spreadAt(wind, i),
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
