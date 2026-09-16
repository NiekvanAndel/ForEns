/**
 * The short forecast the overview page reads, one location at a time.
 *
 * Its own module rather than another branch of the staged loader, because it answers
 * a different shape of question. `loadStage1`/`loadStage2` build one location's full
 * picture in the order a screen can use it; this asks a narrow question of every
 * saved location at once, and the thing that matters is that it is small — a grower
 * with eight fields pays eight of these on one page.
 *
 * So it carries exactly what the widgets read: the coming days' extremes and rainfall
 * for the outlook rows, and the coming hours' temperature, rain and wind for the
 * spray window and tonight's minimum. No ensemble, no cloud layers, no radiation.
 */
import { tryFetchJson } from './http';
import { urls, type Coords } from './openMeteo';
import type { FetchOptions } from './http';
import type { LocationOutlook, OutlookDay, OutlookHour } from '../overviewData';
import type { NumArray, WeatherResponse } from '../model/types';

/** Three days: enough for "tonight, tomorrow, the day after", which is the horizon a
 *  grower plans work on. Beyond that they open the location's own page. */
export const OUTLOOK_DAYS = 3;

export async function fetchOutlook(
  coords: Coords,
  opts: FetchOptions = {}
): Promise<LocationOutlook | null> {
  const json = await tryFetchJson<WeatherResponse>(
    urls.outlook(coords, OUTLOOK_DAYS),
    'Vooruitblik',
    opts
  );
  return parseOutlook(json);
}

/** Split out from the fetch so the parsing can be tested without a network. */
export function parseOutlook(json: WeatherResponse | null, nowMs = Date.now()): LocationOutlook | null {
  if (!json?.hourly?.time?.length) return null;

  const at = (arr: NumArray | undefined, i: number): number | null => {
    const v = arr?.[i];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };

  const h = json.hourly;
  // From the hour the reader is in, not from midnight: every widget that reads these
  // asks "from now", and trimming here means none of them has to.
  const nowKey = localHourFrom(json.utc_offset_seconds ?? 0, nowMs);
  const hours: OutlookHour[] = (h.time ?? [])
    .map((time, i) => ({
      time,
      temp: at(h.temperature_2m, i),
      precip: at(h.precipitation, i),
      wind: at(h.windspeed_10m, i),
      gusts: at(h.windgusts_10m, i) ?? at(h.wind_gusts_10m, i),
    }))
    .filter((row) => row.time >= nowKey);

  const d = json.daily;
  const days: OutlookDay[] = (d?.time ?? []).map((date, i) => ({
    date,
    tempMax: at(d?.temperature_2m_max, i),
    tempMin: at(d?.temperature_2m_min, i),
    precip: at(d?.precipitation_sum, i),
    windMax: at(d?.windspeed_10m_max, i),
    wmo: at(d?.weather_code as NumArray | undefined, i),
  }));

  return { hours, days };
}

/** The location's own current hour as a key, from the offset the response carries —
 *  not the device's, which may be in another zone entirely. */
function localHourFrom(offsetSec: number, nowMs: number): string {
  const d = new Date(nowMs + offsetSec * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:00`
  );
}
