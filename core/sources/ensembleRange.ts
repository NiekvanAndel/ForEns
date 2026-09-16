/**
 * The ensemble members across a whole window, rather than one day at a time.
 *
 * `ensembleHourly` fetches one day for a detail sheet and reduces it to percentiles
 * on the way in, which is exactly right for a sheet: the sheet asks about one day and
 * plots the percentiles it is given. The chart on 'Grafiek' asks a different question
 * — a window of up to a month, which it may draw hour by hour or day by day — and a
 * percentile is the one statistic you cannot aggregate afterwards. The p10 of a day's
 * rainfall is not the sum of its hours' p10s unless the members happen to be ranked
 * the same way in every hour, and they are not.
 *
 * So this keeps the members. The chart buckets them the way it buckets everything
 * else and takes the percentiles at the end, which is the only order that gives an
 * honest band at day resolution. It costs memory — 51 members over a month is about
 * 37 000 numbers per field — and that is the whole of the cost, since the two fields
 * the chart bands are fetched in one request.
 *
 * Temperature, precipitation and wind — the three the page bands — in one request.
 * Three fields is half as much again over the wire as two, and it is still the cheaper
 * shape: a reader tapping through the measurement pills would otherwise pay a fresh
 * 51-member request per tap, where this answers all three from one cached response.
 */
import { tryFetchJson, type FetchOptions } from './http';
import { memberSeries } from './ensembleHourly';

const ENSEMBLE = 'https://ensemble-api.open-meteo.com/v1/ensemble';

/** Members × hours, alongside the hours they are indexed by. */
export interface EnsembleMembers {
  /** Local wall-clock keys, `YYYY-MM-DDTHH:MM` — the same shape the rest of the
   *  model keys hours by, because `timezone=auto` puts the response in the
   *  location's own zone. */
  times: string[];
  /** One row per member. Empty where the response carried the field for none. */
  temp: (number | null)[][];
  precip: (number | null)[][];
  wind: (number | null)[][];
}

export const EMPTY_MEMBERS: EnsembleMembers = { times: [], temp: [], precip: [], wind: [] };

interface EnsembleResponse {
  hourly?: Record<string, unknown>;
}

export async function fetchEnsembleRange(
  lat: number,
  lon: number,
  from: string,
  to: string,
  opts: FetchOptions = {}
): Promise<EnsembleMembers> {
  const url =
    `${ENSEMBLE}?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,precipitation,windspeed_10m` +
    `&models=ecmwf_ifs025&start_date=${from}&end_date=${to}&timezone=auto`;

  const json = await tryFetchJson<EnsembleResponse>(url, 'ENS-reeks', opts);
  return parseEnsembleRange(json);
}

/** Split out from the fetch so the parsing can be tested without a network. */
export function parseEnsembleRange(json: EnsembleResponse | null): EnsembleMembers {
  const hourly = json?.hourly;
  if (!hourly) return EMPTY_MEMBERS;
  const times = (hourly.time as string[] | undefined) ?? [];
  if (!times.length) return EMPTY_MEMBERS;
  return {
    times,
    temp: memberSeries(hourly, 'temperature_2m'),
    precip: memberSeries(hourly, 'precipitation'),
    wind: memberSeries(hourly, 'windspeed_10m'),
  };
}
