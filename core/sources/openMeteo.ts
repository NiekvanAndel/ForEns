/**
 * Open-Meteo endpoints and the load cascade.
 *
 * Ported from index.html's `run()`, `loadIfsSunFull()` and `loadEnsFullData()`.
 * The staging matters as much as the URLs: the app renders as soon as the first,
 * fastest source lands and refines as the slower ones arrive, so a user on a poor
 * connection sees a temperature within a second rather than a spinner for ten.
 *
 *   stage 1  observations + HARMONIE     → hero and hour strip
 *   stage 2  IFS deterministic + icons   → the 7-day list
 *   stage 3  ENS 51 members              → spread on the day rows
 *   later    16-day IFS and 14-day ENS   → only when the user opens days 8–14
 */
import { fetchJson, tryFetchJson, type FetchOptions } from './http';
import type { WeatherResponse } from '../model/types';

const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const ECMWF = 'https://api.open-meteo.com/v1/ecmwf';
const ENSEMBLE = 'https://ensemble-api.open-meteo.com/v1/ensemble';

/** Hourly fields the app reads. cloud_cover_low/mid/high and shortwave_radiation
 *  are what method-6 sunshine needs; without them it falls back to daily totals. */
export const HOURLY_VARS = [
  'temperature_2m', 'precipitation', 'windspeed_10m', 'winddirection_10m',
  'weathercode', 'relativehumidity_2m', 'cloudcover', 'dewpoint_2m',
  'apparent_temperature', 'surface_pressure', 'et0_fao_evapotranspiration',
  'windgusts_10m', 'sunshine_duration', 'direct_normal_irradiance',
  'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'shortwave_radiation',
].join(',');

const IFS_DAILY_VARS = [
  'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum',
  'windspeed_10m_max', 'winddirection_10m_dominant', 'weather_code',
  'dewpoint_2m_max', 'dewpoint_2m_min', 'sunshine_duration',
  'et0_fao_evapotranspiration',
].join(',');

const ENS_DAILY_VARS =
  'precipitation_sum,temperature_2m_max,temperature_2m_min,windspeed_10m_max';

export interface Coords {
  lat: number;
  lon: number;
}

const base = ({ lat, lon }: Coords) => `latitude=${lat}&longitude=${lon}&timezone=auto`;

export const urls = {
  observations: (c: Coords) =>
    `${FORECAST}?${base(c)}&hourly=${HOURLY_VARS}&current_weather=true&past_days=1&forecast_days=1`,
  harmonie: (c: Coords, region: 'netherlands' | 'europe') =>
    `${FORECAST}?${base(c)}&hourly=${HOURLY_VARS}&current_weather=true&forecast_days=2` +
    `&models=knmi_harmonie_arome_${region}`,
  ifsHourly: (c: Coords) =>
    `${FORECAST}?${base(c)}&hourly=${HOURLY_VARS}&current_weather=true&forecast_days=3&models=ecmwf_ifs`,
  ifsDaily: (c: Coords, days: number) =>
    `${ECMWF}?${base(c)}&models=ecmwf_ifs` +
    `&hourly=cloud_cover_low,cloud_cover_mid,cloud_cover_high,shortwave_radiation` +
    `&daily=${IFS_DAILY_VARS}&forecast_days=${days}`,
  ifsIcons: (c: Coords, days: number) =>
    `${FORECAST}?${base(c)}&hourly=weather_code&models=ecmwf_ifs&forecast_days=${days}`,
  ensemble: (c: Coords, days: number) =>
    `${ENSEMBLE}?${base(c)}&daily=${ENS_DAILY_VARS}&models=ecmwf_ifs025&forecast_days=${days}`,
};

/** Which model actually supplied the hourly data, for the source-breakdown card. */
export type HarmonieState =
  | { model: 'netherlands' | 'europe'; failed: false; disabled: false }
  | { model: null; failed: true; disabled: false }
  | { model: null; failed: false; disabled: true };

export interface HourlyResult {
  hourly: WeatherResponse | null;
  state: HarmonieState;
}

/**
 * HARMONIE with no retries: when the Dutch domain returns an empty series the right
 * move is to fall through immediately rather than wait out a backoff, because the
 * location is simply outside its range.
 */
async function fastHarmonie(
  url: string,
  opts: FetchOptions
): Promise<WeatherResponse | null> {
  const data = await tryFetchJson<WeatherResponse>(url, 'HARMONIE', { ...opts, retries: 0 });
  if (!data) return null;
  const temps = data.hourly?.temperature_2m ?? [];
  // A response of all-nulls means the location is outside the model domain.
  if (temps.length > 0 && temps.every((v) => v === null)) return null;
  return data;
}

/**
 * Resolve the hourly source: HARMONIE-NL, then HARMONIE-EU, then IFS hourly.
 * IFS is also the "now" source when observations fail.
 */
export async function loadHourly(
  c: Coords,
  useHarmonie: boolean,
  opts: FetchOptions = {}
): Promise<HourlyResult> {
  if (!useHarmonie) {
    const ifs = await tryFetchJson<WeatherResponse>(urls.ifsHourly(c), 'IFS-hourly', opts);
    return { hourly: ifs, state: { model: null, failed: false, disabled: true } };
  }

  let data = await fastHarmonie(urls.harmonie(c, 'netherlands'), opts);
  if (data) return { hourly: data, state: { model: 'netherlands', failed: false, disabled: false } };

  data = await fastHarmonie(urls.harmonie(c, 'europe'), opts);
  if (data) return { hourly: data, state: { model: 'europe', failed: false, disabled: false } };

  const ifs = await tryFetchJson<WeatherResponse>(urls.ifsHourly(c), 'IFS-hourly', opts);
  return { hourly: ifs, state: { model: null, failed: true, disabled: false } };
}

export interface Stage1 {
  observations: WeatherResponse | null;
  hourly: WeatherResponse | null;
  harmonie: HarmonieState;
  /** The UTC offset both the solar maths and the hour strip depend on. */
  offsetSec: number;
}

/**
 * Stage 1: observations and hourly, started in parallel.
 * Observations are allowed to fail — an Open-Meteo outage then costs the history
 * strip, not the whole screen.
 */
export async function loadStage1(
  c: Coords,
  useHarmonie: boolean,
  opts: FetchOptions = {}
): Promise<Stage1> {
  const obsPromise = tryFetchJson<WeatherResponse>(urls.observations(c), 'Obs', opts);
  const hourlyPromise = loadHourly(c, useHarmonie, opts);
  const [observations, { hourly, state }] = await Promise.all([obsPromise, hourlyPromise]);
  return {
    observations,
    hourly,
    harmonie: state,
    offsetSec: observations?.utc_offset_seconds ?? hourly?.utc_offset_seconds ?? 0,
  };
}

export interface Stage2 {
  /** IFS deterministic daily; also carries sunshine and ET0. */
  ifs: WeatherResponse | null;
  /** Separate hourly weather-code call, used only for day icons. */
  icons: WeatherResponse | null;
}

/** Stage 2: the deterministic 7-day forecast and its icon codes. */
export async function loadStage2(c: Coords, opts: FetchOptions = {}): Promise<Stage2> {
  const [ifs, icons] = await Promise.all([
    tryFetchJson<WeatherResponse>(urls.ifsDaily(c, 7), 'IFS', opts),
    tryFetchJson<WeatherResponse>(urls.ifsIcons(c, 7), 'IFS-icons', opts),
  ]);
  return { ifs, icons };
}

/** Stage 3: the 51-member ensemble. Slow, so it never blocks the first render. */
export function loadEnsemble(
  c: Coords,
  days: 7 | 14,
  opts: FetchOptions = {}
): Promise<WeatherResponse | null> {
  return tryFetchJson<WeatherResponse>(urls.ensemble(c, days), 'ENS', opts);
}

/** Days 8–14: the extended deterministic run and its icon codes. */
export async function loadExtended(c: Coords, opts: FetchOptions = {}): Promise<Stage2> {
  const [ifs, icons] = await Promise.all([
    tryFetchJson<WeatherResponse>(urls.ifsDaily(c, 16), 'IFS-16d', opts),
    tryFetchJson<WeatherResponse>(urls.ifsIcons(c, 14), 'IFS-icons-14d', opts),
  ]);
  return { ifs, icons };
}

export { fetchJson, tryFetchJson };
