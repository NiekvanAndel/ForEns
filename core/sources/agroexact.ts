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
 * ## Everything the station reports, not only what it measures itself
 *
 * Both calls pass `station_only=false`, which is the API's default but is sent
 * explicitly because it decides what comes back: with it, AgroExact substitutes
 * external data for the quantities a given unit does not measure, so a RainExact
 * answers with a full record rather than a rain figure and a row of nulls. The merge
 * is still per quantity — whatever arrives as null stays modelled — but the app asks
 * for everything and uses everything it gets, rather than deciding in advance which
 * station is allowed to speak about what.
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
 * One hour as the station reported it.
 *
 * Every field is independently nullable: a sensor can fail, and a young station has
 * hours before it existed. The merge treats each quantity on its own — what came
 * back replaces the model, what did not stays modelled — so a gap in one field never
 * costs the hour its other values.
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
 * The schema documents `Authorization: Token <api key>` as well, but the only
 * credential this app holds is an AuthKit access token, and that is a bearer token.
 * Sending one scheme means a 401 says what it is meant to say — this token is no
 * good — instead of also standing for "maybe the other scheme would have worked",
 * which is what `withAgroToken` needs to tell a stale token from a dead account.
 */
export function agroHeaders(token: string): Record<string, string> {
  return { Accept: 'application/json', Authorization: `Bearer ${token.trim()}` };
}

/** Thrown on a 401/403, so the caller can tell "signed out" from "no data". */
export class AgroAuthError extends SourceError {
  constructor(message: string, status?: number) {
    super('AgroExact', message, status);
    this.name = 'AgroAuthError';
  }
}

/**
 * Run a call against the API with a token it actually accepts.
 *
 * A refused call is not proof of a dead account. WorkOS can retire an access token
 * ahead of the expiry it handed out, and the device clock is its own opinion, so the
 * first 401 buys a forced refresh and one retry rather than an integration that
 * reads as connected over data that never arrives. A second refusal is thrown.
 *
 * `getToken` is `getAccessToken` from the auth context: called bare for the token in
 * hand, and with the refused one to ask for its replacement. Resolves to null when
 * there is no account to call with at all — every caller has a page to draw without.
 *
 * `onRefusedFreshToken` runs when a token minted seconds ago is refused too. That is
 * no longer an expiry problem — the grant does not buy access to this API — and the
 * auth context uses it to stop claiming the integration is healthy.
 */
export async function withAgroToken<T>(
  getToken: (spentToken?: string) => Promise<string | null>,
  call: (token: string) => Promise<T>,
  onRefusedFreshToken?: () => void
): Promise<T | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    return await call(token);
  } catch (e) {
    if (!(e instanceof AgroAuthError)) throw e;
    const fresh = await getToken(token);
    // Nothing newer to try with: the auth context has already recorded why — a
    // revoked grant disconnects the integration, a network failure leaves it alone.
    if (!fresh || fresh === token) throw e;
    try {
      return await call(fresh);
    } catch (afterRefresh) {
      if (afterRefresh instanceof AgroAuthError) onRefusedFreshToken?.();
      throw afterRefresh;
    }
  }
}

async function agroFetch<T>(
  token: string,
  path: string,
  opts: FetchOptions = {}
): Promise<T> {
  const { signal, fetchImpl = fetch } = opts;
  const url = `${AGRO_BASE}${path}`;

  const r = await fetchImpl(url, {
    signal,
    headers: { ...agroHeaders(token), ...(opts.headers ?? {}) },
  });

  if (r.status === 401 || r.status === 403) {
    throw new AgroAuthError('niet geautoriseerd', r.status);
  }
  if (!r.ok) throw new SourceError('AgroExact', `HTTP ${r.status}`, r.status);

  const body = (await r.json()) as T & { detail?: string };
  // The API reports its own errors as `{ "detail": "..." }`.
  if (!Array.isArray(body) && body?.detail) throw new SourceError('AgroExact', body.detail);
  return body;
}

/**
 * The readings endpoints, whose body is not necessarily one JSON document.
 *
 * `/readings/` streams NDJSON — one measurement per line — where `/aggregates/`
 * answers with an ordinary array. Which of the two a given path returns is not
 * something this app can settle from the outside, and `.json()` throws on the first
 * newline, so the rows are read as text and parsed either way: an array if the body
 * looks like one, line by line if it does not.
 *
 * A line that will not parse is skipped rather than failing the call. A station that
 * wrote one bad record should cost that record and not the chart.
 */
async function agroFetchRows<T>(
  token: string,
  path: string,
  opts: FetchOptions = {}
): Promise<T[]> {
  const { signal, fetchImpl = fetch } = opts;

  const r = await fetchImpl(`${AGRO_BASE}${path}`, {
    signal,
    headers: { ...agroHeaders(token), ...(opts.headers ?? {}) },
  });

  if (r.status === 401 || r.status === 403) {
    throw new AgroAuthError('niet geautoriseerd', r.status);
  }
  if (!r.ok) throw new SourceError('AgroExact', `HTTP ${r.status}`, r.status);

  return parseRows<T>(await r.text());
}

/** Exported for the tests: both body shapes, and the bad line in the middle. */
export function parseRows<T>(body: string): T[] {
  const trimmed = body.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }

  const rows: T[] = [];
  for (const line of trimmed.split('\n')) {
    const text = line.trim();
    if (!text) continue;
    try {
      const row = JSON.parse(text) as T & { detail?: string };
      // The API reports its own errors as `{ "detail": "..." }`.
      if (row && typeof row === 'object' && 'detail' in row && row.detail) {
        throw new SourceError('AgroExact', String(row.detail));
      }
      rows.push(row);
    } catch (e) {
      if (e instanceof SourceError) throw e;
      // A single unreadable record is not worth the whole series.
    }
  }
  return rows;
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Metres per second as the API sends them, in the km/h the app works in — to a
 *  tenth, because a station's whole point is that it measured this. */
const msToKmh = (v: number | null): number | null => (v == null ? null : round1(v * 3.6));
const roundOrNull = (v: number | null): number | null => (v == null ? null : Math.round(v));
/** The same, to a tenth — for the quantities a station is trusted to have measured
 *  precisely. See `core/model/types` on `tempExact`. */
const round1OrNull = (v: number | null): number | null => (v == null ? null : round1(v));

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
 * Rain gauges are kept alongside full stations, and are asked the same questions:
 * with external substitution on, a RainExact location gets a complete page rather
 * than a rain figure over a row of blanks. Dropping a station someone owns from a
 * screen that claims to list their stations would be the worse answer anyway.
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
 * One aggregate row as the app's hour.
 *
 * The hourly *average* is the honest value for an hour; the API's bare
 * `temperature_150` is the last measurement inside it, which on a strip or a chart
 * would let a single late-afternoon spike stand for the whole hour. Where an average
 * is missing the bare reading is better than a gap, so it is the fallback.
 *
 * Shared by the hour strip's fixed window and the graph page's chosen one, so the
 * two can never disagree about what an hour measured.
 */
function mapAggregateRow(key: string, r: AggregateRow): MeasuredHour {
  const temp = num(r.temperature_150_avg) ?? num(r.temperature_150);
  const humidity = num(r.humidity_150_avg) ?? num(r.humidity_150);
  const wind = num(r.windspeed_avg) ?? num(r.windspeed);

  return {
    time: key,
    // Temperature keeps its tenth: this is a measurement, and the hero prints it as
    // one. Everything that wants a whole number rounds where it draws.
    temp: round1OrNull(temp),
    tempMin: round1OrNull(num(r.temperature_150_min)),
    tempMax: round1OrNull(num(r.temperature_150_max)),
    humidity: roundOrNull(humidity),
    dewpoint: roundOrNull(num(r.dewpoint)),
    wind: msToKmh(wind),
    gusts: msToKmh(num(r.gust_max)),
    windDir: roundOrNull(num(r.wind_direction)),
    precip: num(r.precipitation) != null ? round1(num(r.precipitation) as number) : null,
  };
}

/**
 * The station's last `hours` hours, as hourly measurements.
 *
 * `include_partial=true` is deliberate: without it the most recent completed hour is
 * withheld until every late measurement has arrived, which on the hour strip reads as
 * the station having stopped reporting. The values can still change on the next
 * refresh, which is exactly what a live hour does anyway.
 *
 * `station_only=false` is the default, sent explicitly: the app wants every quantity
 * the station can answer for, substituted where its own sensors cannot.
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
    `/aggregates/${encodeURIComponent(stationId)}/` +
      `?hours=${hours}&include_partial=true&station_only=false`,
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

    out[key] = mapAggregateRow(key, r);
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
  const rows = await agroFetchRows<ReadingRow>(
    token,
    `/readings/${encodeURIComponent(stationId)}/?latest=true&station_only=false`,
    opts
  );
  const r = rows[0];
  if (!r?.timestamp) return { current: null, stationName: null };

  const time = localHourKey(r.timestamp, offsetSec);
  if (!time) return { current: null, stationName: r.station_name ?? null };

  return {
    stationName: r.station_name ?? null,
    current: {
      time,
      measTime: r.timestamp,
      temp: round1OrNull(num(r.temperature_150)),
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

// ── A measured series over a period ─────────────────────────────────────────────

/**
 * A calendar day as the API's `start_date`/`end_date` want it.
 *
 * The app works in `YYYY-MM-DD` throughout — it sorts, it compares as a string, and
 * it is the first ten characters of an hour key. The API wants `dd-mm-YYYY`. The
 * conversion is one line and it is here rather than at the call site because getting
 * it wrong is silent: `2026-09-08` is not rejected as a date, it is simply not the
 * window that was asked for, and the chart comes back empty with no error to show.
 */
export function apiDay(isoDay: string): string {
  const [y, m, d] = isoDay.split('-');
  return `${d}-${m}-${y}`;
}

/**
 * Every hour the station measured between two dates, oldest first.
 *
 * The graph page's window, where `fetchStationHours` covers the hour strip's fixed
 * 26. Same mapping, same end-of-hour correction, same units — it differs only in how
 * the window is asked for and in returning a list rather than a lookup, because a
 * chart plots a sequence and a strip looks hours up by name.
 *
 * `limit` is high enough that a thirty-day window is not truncated to its newest
 * rows: the API answers newest-first and cuts at the limit, so a low one would draw
 * a month that quietly starts a week ago.
 */
export async function fetchStationRange(
  token: string,
  stationId: string,
  offsetSec: number,
  /** Both `YYYY-MM-DD`; converted to the API's own format on the way out. */
  startDay: string,
  endDay: string,
  opts: FetchOptions = {}
): Promise<MeasuredHour[]> {
  const rows = await agroFetch<AggregateRow[]>(
    token,
    `/aggregates/${encodeURIComponent(stationId)}/` +
      `?start_date=${apiDay(startDay)}&end_date=${apiDay(endDay)}` +
      `&include_partial=true&station_only=false&limit=5000`,
    opts
  );
  const out: MeasuredHour[] = [];

  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r?.timestamp) continue;
    const endMs = new Date(r.timestamp).getTime();
    if (!Number.isFinite(endMs)) continue;
    const key = localHourKey(new Date(endMs - HOUR_MS).toISOString(), offsetSec);
    if (!key) continue;
    out.push(mapAggregateRow(key, r));
  }

  // Oldest first: a chart reads left to right, and the API answers newest first.
  return out.sort((a, b) => (a.time < b.time ? -1 : 1));
}

/**
 * Every raw measurement a station took between two dates.
 *
 * A station reports about every ten minutes, and on a one-day window that is what
 * the graph page asks for: an hourly roll-up of a single day flattens the quarter of
 * an hour a shower actually fell into a bar that says it rained all hour. Over longer
 * windows the aggregates are the right answer — see `fetchStationRange` — because a
 * month of ten-minute records is thousands of points nobody can read and a great deal
 * of data to move.
 *
 * The API caps this window at 48 hours, which a single day fits inside with room to
 * spare. `time_rounding` puts the timestamps on the measurement interval rather than
 * wherever the station's clock happened to be, so the samples land on a regular grid
 * instead of drifting a minute either way.
 *
 * Mapped into the same shape as an hour, with a minute-level key: the series builder
 * treats the two identically and only its step size differs. What an hour has and a
 * reading does not — a minimum and a maximum within it — stays null, because a single
 * measurement has neither.
 */
export async function fetchStationReadings(
  token: string,
  stationId: string,
  offsetSec: number,
  /** Both `YYYY-MM-DD`; converted to the API's own format on the way out. */
  startDay: string,
  endDay: string,
  opts: FetchOptions = {}
): Promise<MeasuredHour[]> {
  const rows = await agroFetchRows<ReadingRow>(
    token,
    `/readings/${encodeURIComponent(stationId)}/` +
      `?start_date=${apiDay(startDay)}&end_date=${apiDay(endDay)}` +
      `&station_only=false&time_rounding=true`,
    opts
  );

  const out: MeasuredHour[] = [];
  for (const r of rows) {
    if (!r?.timestamp) continue;
    const time = localMinuteKey(r.timestamp, offsetSec);
    if (!time) continue;
    out.push({
      time,
      // A reading is stamped at the instant it was taken, so unlike an aggregate it
      // is not shifted back by a window it covers.
      temp: round1OrNull(num(r.temperature_150)),
      tempMin: null,
      tempMax: null,
      humidity: roundOrNull(num(r.humidity_150)),
      dewpoint: roundOrNull(num(r.dewpoint)),
      wind: msToKmh(num(r.windspeed)),
      gusts: msToKmh(num(r.gust)),
      windDir: roundOrNull(num(r.wind_direction)),
      precip: num(r.precipitation) != null ? round1(num(r.precipitation) as number) : null,
    });
  }

  // Oldest first: a chart reads left to right, and the API answers newest first.
  return out.sort((a, b) => (a.time < b.time ? -1 : 1));
}

/**
 * The local ten-minute slot a UTC instant falls in, as the series builder's key.
 *
 * The same construction as `localHourKey` and for the same reason — the location's
 * own offset, not the device's — but keeping the minutes, floored to the interval a
 * station reports on so a reading lands on the grid the chart draws rather than
 * between two of its steps.
 */
export function localMinuteKey(utcIso: string, offsetSec: number, stepMin = 10): string {
  const ms = new Date(utcIso).getTime();
  if (!Number.isFinite(ms)) return '';
  const l = new Date(ms + offsetSec * 1000);
  const minute = Math.floor(l.getUTCMinutes() / stepMin) * stepMin;
  return (
    `${l.getUTCFullYear()}-${pad(l.getUTCMonth() + 1)}-${pad(l.getUTCDate())}` +
    `T${pad(l.getUTCHours())}:${pad(minute)}`
  );
}
