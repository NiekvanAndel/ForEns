/**
 * AgroExact station data.
 *
 * Ported from index.html's AGRO block. Where a station is close enough, its live
 * readings replace the modelled "now" and the past hours, and the location title
 * turns AgroExact green — the one place the design system allows green.
 *
 * Two changes from the web app:
 *
 *  - `agroDistKm` was called but never defined (index.html:3509), so
 *    `agroNearestStation` threw a ReferenceError that every caller swallowed with
 *    `.catch()`. The feature therefore never activated. Implemented here as a
 *    haversine distance.
 *  - The token moves from localStorage to expo-secure-store, handled by the caller;
 *    this module only receives it. CORS is irrelevant natively.
 */
import { fetchJson, SourceError, type FetchOptions } from './http';
import { round1 } from '../model/stats';
import { isHourDay } from '../solar';
import type { Hour } from '../model/types';

export const AGRO_DEFAULT_BASE = 'https://app.agroexact.com/api/v2';

/** A station is only used when it is genuinely near, per the web app's rule. */
export const AGRO_MAX_DISTANCE_KM = 10;

export interface AgroStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type: string | null;
}

export interface NearestStation extends AgroStation {
  /** Great-circle distance from the requested point, km. */
  dist: number;
}

export interface AgroConfig {
  token: string;
  baseUrl?: string;
}

/** First non-null value among the given keys — the API's field names vary. */
function field(o: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) if (o[k] != null) return o[k];
  return null;
}

/** Pull an array of records out of a response, tolerant of the wrapper used. */
export function agroRecords(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  const o = json as Record<string, unknown> | null;
  if (!o) return [];
  for (const key of ['records', 'data', 'results', 'stations', 'readings']) {
    if (Array.isArray(o[key])) return o[key] as Record<string, unknown>[];
  }
  return [];
}

export function agroBaseUrl(cfg: AgroConfig): string {
  return (cfg.baseUrl || '').trim() || AGRO_DEFAULT_BASE;
}

/** AgroExact expects `Authorization: Token <key>`; a token that already carries a
 *  scheme is passed through rather than double-prefixed. */
export function agroHeaders(cfg: AgroConfig): Record<string, string> {
  const tok = (cfg.token || '').trim();
  const h: Record<string, string> = { Accept: 'application/json' };
  if (tok) h.Authorization = /^(token|bearer)\s/i.test(tok) ? tok : `Token ${tok}`;
  return h;
}

async function agroGet<T>(cfg: AgroConfig, path: string, opts: FetchOptions = {}): Promise<T> {
  return fetchJson<T>(agroBaseUrl(cfg) + path, 'AgroExact', {
    retries: 1,
    ...opts,
    headers: { ...agroHeaders(cfg), ...(opts.headers ?? {}) },
  });
}

const R_EARTH_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/**
 * Great-circle distance in kilometres.
 *
 * This is the function index.html referenced but never defined. Haversine is used
 * rather than equirectangular because station distance decides whether live readings
 * replace the model at all, so the threshold should not drift with latitude.
 */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Fetch and normalise the station list. Only full weather stations (ATMO) qualify;
 *  a station with no type is kept, since older records omit it. */
export async function fetchStations(
  cfg: AgroConfig,
  opts: FetchOptions = {}
): Promise<AgroStation[]> {
  const json = await agroGet<unknown>(cfg, '/stations/', opts);
  const stations = agroRecords(json)
    .map((r) => ({
      id: String(field(r, 'station_id', 'id', 'stationId', 'uuid') ?? ''),
      name: String(field(r, 'name', 'station_name', 'label') ?? 'Station'),
      lat: parseFloat(String(field(r, 'latitude', 'lat'))),
      lon: parseFloat(String(field(r, 'longitude', 'lon', 'lng'))),
      type: (field(r, 'version_type', 'type', 'kind') as string | null) ?? null,
    }))
    .filter((s) => s.id && Number.isFinite(s.lat) && Number.isFinite(s.lon))
    .filter((s) => !s.type || /atmo/i.test(s.type));
  if (!stations.length) throw new SourceError('AgroExact', 'no stations in response');
  return stations;
}

export function nearestStation(
  stations: readonly AgroStation[],
  lat: number,
  lon: number
): NearestStation | null {
  let best: AgroStation | null = null;
  let bestD = Infinity;
  for (const s of stations) {
    const d = distanceKm(lat, lon, s.lat, s.lon);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best ? { ...best, dist: bestD } : null;
}

export interface StationHour extends Hour {
  /** Marks an hour sourced from a station rather than a model. */
  agro: true;
}

export interface StationCurrent {
  time: string;
  /** The reading's own timestamp, which may be minutes inside the hour. */
  measTime: string;
  temp: number | null;
  humidity: number | null;
  wind: number | null;
  gusts: number | null;
  windDir: number | null;
  dewpoint: number | null;
  precip: number;
  wmo: number;
  isDay: 0 | 1;
}

export interface StationData {
  hours: StationHour[];
  current: StationCurrent;
}

const mean = (a: number[]): number | null =>
  a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;

/** Mean of bearings, which cannot be averaged arithmetically: 350° and 10° average
 *  to 0°, not 180°. */
export function circularMean(degs: readonly number[]): number | null {
  if (!degs.length) return null;
  let x = 0;
  let y = 0;
  for (const d of degs) {
    x += Math.cos(rad(d));
    y += Math.sin(rad(d));
  }
  const a = (Math.atan2(y / degs.length, x / degs.length) * 180) / Math.PI;
  return (a + 360) % 360;
}

const msToKmh = (v: number | null): number | null => (v == null ? null : v * 3.6);

/**
 * Fetch ~30 hours of readings and fold them into hourly buckets.
 *
 * Weather codes come from the model, not the station: an AgroExact station measures
 * quantities, not conditions, so the icon has to keep coming from Open-Meteo.
 */
export async function fetchStationData(
  cfg: AgroConfig,
  stationId: string,
  offsetSec: number,
  lat: number,
  opts: FetchOptions & { wmoByHour?: Record<string, number>; currentWmo?: number } = {}
): Promise<StationData | null> {
  const json = await agroGet<unknown>(cfg, `/readings/${stationId}/?hours=30`, opts);
  const stamp = (r: Record<string, unknown>) =>
    field(r, 'timestamp', 'time', 'datetime') as string | null;

  const recs = agroRecords(json).filter((r) => stamp(r));
  if (!recs.length) return null;
  recs.sort((a, b) => ((stamp(a) as string) < (stamp(b) as string) ? 1 : -1)); // newest first

  const pad = (n: number) => String(n).padStart(2, '0');
  /** Readings are UTC; the hour strip is local, so bucket by local hour. */
  const localHourKey = (utcIso: string): string => {
    const l = new Date(new Date(utcIso).getTime() + (offsetSec || 0) * 1000);
    return (
      `${l.getUTCFullYear()}-${pad(l.getUTCMonth() + 1)}-${pad(l.getUTCDate())}` +
      `T${pad(l.getUTCHours())}:00`
    );
  };

  const num = (v: unknown): number | null => (v != null ? Number(v) : null);
  const rTemp = (r: Record<string, unknown>) => num(field(r, 'temperature_150', 'temperature_2m', 'temperature', 'temp'));
  const rHum = (r: Record<string, unknown>) => num(field(r, 'humidity_150', 'relativehumidity', 'humidity', 'rh'));
  const rWind = (r: Record<string, unknown>) => num(field(r, 'windspeed', 'wind_speed', 'wind'));
  const rGust = (r: Record<string, unknown>) => num(field(r, 'gust', 'windgust', 'wind_gust', 'gusts'));
  const rDir = (r: Record<string, unknown>) => num(field(r, 'wind_direction', 'winddirection', 'wind_dir'));
  const rDew = (r: Record<string, unknown>) => num(field(r, 'dewpoint', 'dew_point'));
  const rPrec = (r: Record<string, unknown>) => num(field(r, 'precipitation', 'precip', 'rain'));

  const byHour: Record<string, Record<string, unknown>[]> = {};
  for (const r of recs) (byHour[localHourKey(stamp(r) as string)] ??= []).push(r);

  const wmoByHour = opts.wmoByHour ?? {};
  const defined = (a: (number | null)[]) => a.filter((v): v is number => v != null);

  const hours: StationHour[] = Object.keys(byHour)
    .sort()
    .map((k) => {
      const arr = byHour[k] as Record<string, unknown>[];
      const temps = defined(arr.map(rTemp));
      const hums = defined(arr.map(rHum));
      const winds = defined(arr.map(rWind));
      const gusts = defined(arr.map(rGust));
      const dews = defined(arr.map(rDew));
      const dirs = defined(arr.map(rDir));
      const precSum = arr.reduce((s, r) => s + (rPrec(r) ?? 0), 0);
      return {
        time: k,
        temp: temps.length ? Math.round(mean(temps) as number) : null,
        humidity: hums.length ? Math.round(mean(hums) as number) : null,
        wind: winds.length ? Math.round(msToKmh(mean(winds)) as number) : null,
        gusts: gusts.length ? Math.round(msToKmh(Math.max(...gusts)) as number) : null,
        windDir: dirs.length ? Math.round(circularMean(dirs) as number) : null,
        dewpoint: dews.length ? Math.round(mean(dews) as number) : null,
        precip: round1(precSum),
        wmo: wmoByHour[k] ?? 0,
        isDay: isHourDay(k, lat, offsetSec),
        isPast: true,
        agro: true as const,
      };
    });

  const cur = recs[0] as Record<string, unknown>;
  const curTime = localHourKey(stamp(cur) as string);
  const current: StationCurrent = {
    time: curTime,
    measTime: stamp(cur) as string,
    temp: rTemp(cur) != null ? Math.round(rTemp(cur) as number) : null,
    humidity: rHum(cur) != null ? Math.round(rHum(cur) as number) : null,
    wind: rWind(cur) != null ? Math.round(msToKmh(rWind(cur)) as number) : null,
    gusts: rGust(cur) != null ? Math.round(msToKmh(rGust(cur)) as number) : null,
    windDir: rDir(cur) != null ? Math.round(rDir(cur) as number) : null,
    dewpoint: rDew(cur) != null ? Math.round(rDew(cur) as number) : null,
    precip: round1(rPrec(cur) ?? 0),
    wmo: opts.currentWmo ?? hours[hours.length - 1]?.wmo ?? 0,
    isDay: isHourDay(curTime, lat, offsetSec),
  };

  return { hours, current };
}
