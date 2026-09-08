/**
 * The AgroExact API — the stations on someone's account and what they measured.
 *
 * Three endpoints, from `/api/v2/schema/`:
 *
 *  - `/stations/`                 the weather stations linked to the account
 *  - `/aggregates/{id}/`          hourly roll-ups, which is what the hour strip wants
 *  - `/readings/{id}/?latest=true` the most recent measurement, which is what the hero wants
 *
 * The hourly strip is built from **aggregates** rather than raw readings. A station
 * measures every ten minutes, so folding readings into hours client-side means
 * pulling six times the data and then re-deriving hourly minima, maxima and gust
 * peaks that the API already computes — and computing them from a partially
 * delivered hour gives a different answer than the API's.
 *
 * ## Two things the API does that the app does not
 *
 * **Timestamps are UTC, and an aggregate is stamped at the end of its hour.** A row
 * at `14:00Z` covers `13:00Z–14:00Z`. The app's `Hour.time` is a local wall-clock
 * string with no zone, stamped at the *start* of the hour, so mapping a row means
 * subtracting the hour before converting. Getting this wrong shifts every measured
 * value one hour into the future, which is invisible in flat weather and badly wrong
 * in a shower.
 *
 * **Wind is in m/s.** The app works in km/h and converts to the reader's unit at the
 * edge, so wind and gusts are converted here, once.
 *
 * Nothing in this module knows about tokens beyond being handed one; refreshing and
 * storing them is `state/auth.tsx`.
 */
import { SourceError, type FetchOptions } from './http';
import { round1 } from '../model/stats';

export const AGRO_BASE = 'https://app.agroexact.com/api/v2';

/** How near a station has to be to speak for the device's own position. Only used
 *  for the opt-in "huidige locatie" rule; a station location is bound by id. */
export const AGRO_MAX_DISTANCE_KM = 10;

export interface AgroStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** ATMO for a full weather station, RAIN/RAIN+ for a rain gauge. */
  type: string | null;
}

export interface NearestStation extends AgroStation {
  /** Great-circle distance from the requested point, km. */
  dist: number;
}

/**
 * One hour as the station measured it.
 *
 * Every field is independently nullable, because a RainExact measures precipitation
 * and nothing else, and even an AtmoExact can lose a sensor. The merge treats each
 * quantity on its own: what the station measured replaces the model, what it did not
 * stays modelled.
 */
export interface MeasuredHour {
  /** Local wall-clock hour, `YYYY-MM-DDTHH:00` — the app's own hour key. */
  time: string;
  temp: number | null;
  tempMin: number | null;
  tempMax: number | null;
  humidity: number | null;
  dewpoint: number | null;
  /** km/h. */
  wind: number | null;
  /** km/h, the hour's peak gust. */
  gusts: number | null;
  windDir: number | null;
  precip: number | null;
}

/** The latest reading, which is what "nu" means on a station-backed location. */
export interface Measurement {
  /** Local wall-clock hour the reading falls in. */
  time: string;
  /** The reading's own timestamp, UTC ISO — the hero shows this, to the minute. */
  measTime: string;
  temp: number | null;
  humidity: number | null;
  dewpoint: number | null;
  wind: number | null;
  gusts: number | null;
  windDir: number | null;
  precip: number | null;
}

/** Everything one station has to say, ready to merge into a model. */
export interface StationObservations {
  stationId: string;
  stationName: string | null;
  /** By local hour key. */
  hours: Record<string, MeasuredHour>;
  current: Measurement | null;
}

/**
 * Authorization for the AgroExact API.
 *
 * The schema documents `Authorization: Token <api key>` for API keys. An AuthKit
 * access token is a bearer token, so that is what is sent; `agroFetch` falls back to
 * the `Token` scheme once on a 401 rather than making the caller know which kind of
 * credential it holds.
 */
export function agroHeaders(token: string, scheme: 'Bearer' | 'Token' = 'Bearer'): Record<string, string> {
  return { Accept: 'application/json', Authorization: `${scheme} ${token.trim()}` };
}

/** Thrown on a 401/403, so the caller can tell "signed out" from "no data". */
export class AgroAuthError extends SourceError {
  constructor(message: string, status?: number) {
    super('AgroExact', message, status);
    this.name = 'AgroAuthError';
  }
}

async function agroFetch<T>(
  token: string,
  path: string,
  opts: FetchOptions = {}
): Promise<T> {
  const { signal, fetchImpl = fetch } = opts;
  const url = `${AGRO_BASE}${path}`;

  const attempt = async (scheme: 'Bearer' | 'Token') =>
    fetchImpl(url, { signal, headers: { ...agroHeaders(token, scheme), ...(opts.headers ?? {}) } });

  let r = await attempt('Bearer');
  // An API key rejected as a bearer token is a scheme mismatch, not a dead
  // credential — worth exactly one retry before reporting the account as signed out.
  if (r.status === 401) r = await attempt('Token');

  if (r.status === 401 || r.status === 403) {
    throw new AgroAuthError('niet geautoriseerd', r.status);
  }
  if (!r.ok) throw new SourceError('AgroExact', `HTTP ${r.status}`, r.status);

  const body = (await r.json()) as T & { detail?: string };
  // The API reports its own errors as `{ "detail": "..." }`.
  if (!Array.isArray(body) && body?.detail) throw new SourceError('AgroExact', body.detail);
  return body;
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const msToKmh = (v: number | null): number | null => (v == null ? null : Math.round(v * 3.6));
const roundOrNull = (v: number | null): number | null => (v == null ? null : Math.round(v));

// ── Stations ────────────────────────────────────────────────────────────────────

interface StationRow {
  station_id?: string;
  name?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  version_type?: string | null;
}

/**
 * The account's weather stations.
 *
 * Rain gauges are kept alongside full stations. They can only fill in precipitation,
 * but the merge is per quantity, so a RainExact location shows measured rainfall over
 * a modelled everything-else rather than being dropped from the list — and dropping a
 * station someone owns from a screen that claims to list their stations is worse than
 * showing one that speaks about less.
 *
 * A station without usable coordinates is skipped: it cannot become a location.
 */
export async function fetchStations(
  token: string,
  opts: FetchOptions = {}
): Promise<AgroStation[]> {
  const rows = await agroFetch<StationRow[]>(token, '/stations/', opts);
  if (!Array.isArray(rows)) throw new SourceError('AgroExact', 'onverwacht antwoord');
  return rows
    .map((r) => ({
      id: String(r.station_id ?? ''),
      name: (r.name ?? '').trim() || 'Station',
      lat: num(r.latitude) as number,
      lon: num(r.longitude) as number,
      type: r.version_type ?? null,
    }))
    .filter((s) => s.id && Number.isFinite(s.lat) && Number.isFinite(s.lon));
}

const R_EARTH_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in kilometres. Haversine rather than equirectangular
 *  because it decides whether measurements replace a model at all. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function nearestStation(
  stations: readonly AgroStation[],
  lat: number,
  lon: number
): NearestStation | null {
  let best: NearestStation | null = null;
  for (const s of stations) {
    const dist = distanceKm(lat, lon, s.lat, s.lon);
    if (!best || dist < best.dist) best = { ...s, dist };
  }
  return best;
}

/** Stations within `km` of a point, for the map pins. */
export function stationsNear(
  stations: readonly AgroStation[],
  lat: number,
  lon: number,
  km: number
): AgroStation[] {
  return stations.filter((s) => distanceKm(lat, lon, s.lat, s.lon) <= km);
}

// ── Measurements ────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The local hour a UTC instant falls in, as the app's hour key.
 *
 * `offsetSec` is the location's offset as Open-Meteo reported it, so the keys line up
 * with the model's own hours across a DST change — deriving the offset from the
 * device instead would put a Dutch station's hours an hour out for anyone whose phone
 * is set to another zone.
 */
export function localHourKey(utcIso: string, offsetSec: number): string {
  const ms = new Date(utcIso).getTime();
  if (!Number.isFinite(ms)) return '';
  const l = new Date(ms + offsetSec * 1000);
  return (
    `${l.getUTCFullYear()}-${pad(l.getUTCMonth() + 1)}-${pad(l.getUTCDate())}` +
    `T${pad(l.getUTCHours())}:00`
  );
}

interface AggregateRow {
  timestamp?: string;
  station_name?: string;
  temperature_150?: number | null;
  temperature_150_min?: number | null;
  temperature_150_max?: number | null;
  temperature_150_avg?: number | null;
  precipitation?: number | null;
  windspeed?: number | null;
  windspeed_avg?: number | null;
  gust_max?: number | null;
  wind_direction?: number | null;
  humidity_150?: number | null;
  humidity_150_avg?: number | null;
  dewpoint?: number | null;
}

/** An aggregate row is stamped at the end of the hour it covers. */
const HOUR_MS = 3600_000;

/**
 * The station's last `hours` hours, as hourly measurements.
 *
 * `include_partial=true` is deliberate: without it the most recent completed hour is
 * withheld until every late measurement has arrived, which on the hour strip reads as
 * the station having stopped reporting. The values can still change on the next
 * refresh, which is exactly what a live hour does anyway.
 */
export async function fetchStationHours(
  token: string,
  stationId: string,
  offsetSec: number,
  hours = 26,
  opts: FetchOptions = {}
): Promise<{ hours: Record<string, MeasuredHour>; stationName: string | null }> {
  const rows = await agroFetch<AggregateRow[]>(
    token,
    `/aggregates/${encodeURIComponent(stationId)}/?hours=${hours}&include_partial=true`,
    opts
  );
  const out: Record<string, MeasuredHour> = {};
  let stationName: string | null = null;

  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r?.timestamp) continue;
    const endMs = new Date(r.timestamp).getTime();
    if (!Number.isFinite(endMs)) continue;
    stationName ??= r.station_name ?? null;

    // Stamped at the end of its window, so the hour it describes starts an hour back.
    const key = localHourKey(new Date(endMs - HOUR_MS).toISOString(), offsetSec);
    if (!key) continue;

    // The hourly average is the honest value for an hour; the API's bare
    // `temperature_150` is the last measurement inside it, which on the strip would
    // make a single late-afternoon spike stand for the whole hour.
    const temp = num(r.temperature_150_avg) ?? num(r.temperature_150);
    const humidity = num(r.humidity_150_avg) ?? num(r.humidity_150);
    const wind = num(r.windspeed_avg) ?? num(r.windspeed);

    out[key] = {
      time: key,
      temp: roundOrNull(temp),
      tempMin: roundOrNull(num(r.temperature_150_min)),
      tempMax: roundOrNull(num(r.temperature_150_max)),
      humidity: roundOrNull(humidity),
      dewpoint: roundOrNull(num(r.dewpoint)),
      wind: msToKmh(wind),
      gusts: msToKmh(num(r.gust_max)),
      windDir: roundOrNull(num(r.wind_direction)),
      precip: num(r.precipitation) != null ? round1(num(r.precipitation) as number) : null,
    };
  }

  return { hours: out, stationName };
}

interface ReadingRow {
  timestamp?: string;
  station_name?: string;
  temperature_150?: number | null;
  humidity_150?: number | null;
  dewpoint?: string | number | null;
  precipitation?: number | null;
  windspeed?: number | null;
  wind_direction?: number | null;
  gust?: number | null;
}

/**
 * The station's most recent measurement.
 *
 * `latest=true` reads straight from the API's cache and ignores every window
 * parameter, which is both the cheapest call available and the one that answers what
 * the hero asks: what is it doing right now, and when was that measured.
 */
export async function fetchLatestMeasurement(
  token: string,
  stationId: string,
  offsetSec: number,
  opts: FetchOptions = {}
): Promise<{ current: Measurement | null; stationName: string | null }> {
  const rows = await agroFetch<ReadingRow[]>(
    token,
    `/readings/${encodeURIComponent(stationId)}/?latest=true`,
    opts
  );
  const r = (Array.isArray(rows) ? rows : [])[0];
  if (!r?.timestamp) return { current: null, stationName: null };

  const time = localHourKey(r.timestamp, offsetSec);
  if (!time) return { current: null, stationName: r.station_name ?? null };

  return {
    stationName: r.station_name ?? null,
    current: {
      time,
      measTime: r.timestamp,
      temp: roundOrNull(num(r.temperature_150)),
      humidity: roundOrNull(num(r.humidity_150)),
      dewpoint: roundOrNull(num(r.dewpoint)),
      wind: msToKmh(num(r.windspeed)),
      gusts: msToKmh(num(r.gust)),
      windDir: roundOrNull(num(r.wind_direction)),
      precip: num(r.precipitation) != null ? round1(num(r.precipitation) as number) : null,
    },
  };
}

/**
 * Everything one station has to say, in one call site.
 *
 * The two requests are independent and both are small, so they go together; a
 * failure of either is not fatal, because the merge is per quantity and an empty
 * half simply leaves the model in place.
 */
export async function fetchStationObservations(
  token: string,
  stationId: string,
  offsetSec: number,
  opts: FetchOptions = {}
): Promise<StationObservations> {
  const [hourly, latest] = await Promise.all([
    fetchStationHours(token, stationId, offsetSec, 26, opts),
    fetchLatestMeasurement(token, stationId, offsetSec, opts),
  ]);
  return {
    stationId,
    stationName: latest.stationName ?? hourly.stationName,
    hours: hourly.hours,
    current: latest.current,
  };
}
