/**
 * The observation feed, further back than the model needs it.
 *
 * `urls.observations` asks for one past day, because that is what the hour strip and
 * "how much rain has fallen today" need. The table on 'Verwachting' shows the last two
 * days as rows, which is one more — and asking the existing call for two would make
 * every location's first paint carry a day nothing on screen was waiting for.
 *
 * So it is its own request, fired only by the page that draws those rows, with the
 * same hourly fields the rest of the app reads. Open-Meteo's `past_days` serves
 * reanalysis blended with observations for dates already gone, which is as close to a
 * measurement as a location without an instrument can get.
 */
import { tryFetchJson, type FetchOptions } from './http';
import { HOURLY_VARS, type Coords } from './openMeteo';
import type { PastHour } from '../model/pastDays';
import type { NumArray, WeatherResponse } from '../model/types';

const FORECAST = 'https://api.open-meteo.com/v1/forecast';

/** Seconds of sunshine in an hour, as Open-Meteo reports it. */
const SECONDS_PER_MINUTE = 60;

export function pastHoursUrl({ lat, lon }: Coords, days: number): string {
  return (
    `${FORECAST}?latitude=${lat}&longitude=${lon}&timezone=auto` +
    `&hourly=${HOURLY_VARS}&past_days=${days}&forecast_days=1`
  );
}

export async function fetchPastHours(
  coords: Coords,
  days: number,
  opts: FetchOptions = {}
): Promise<PastHour[]> {
  const json = await tryFetchJson<WeatherResponse>(pastHoursUrl(coords, days), 'OBS-terug', opts);
  return parsePastHours(json);
}

/** Split out from the fetch so the parsing can be tested without a network. */
export function parsePastHours(json: WeatherResponse | null): PastHour[] {
  const hourly = json?.hourly;
  const times = hourly?.time;
  if (!hourly || !times?.length) return [];

  const at = (arr: NumArray | undefined, i: number): number | null => {
    const v = arr?.[i];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };

  return times.map((time, i) => ({
    time,
    temp: at(hourly.temperature_2m, i),
    humidity: at(hourly.relativehumidity_2m, i),
    precip: at(hourly.precipitation, i),
    wind: at(hourly.windspeed_10m, i),
    gusts: at(hourly.windgusts_10m, i) ?? at(hourly.wind_gusts_10m, i),
    windDir: at(hourly.winddirection_10m, i),
    dewpoint: at(hourly.dewpoint_2m, i),
    wmo: at(hourly.weather_code, i) ?? at(hourly.weathercode, i),
    // Reported in seconds; the rows want hours, and the day builder divides minutes.
    sunMin: (() => {
      const s = at(hourly.sunshine_duration, i);
      return s == null ? null : s / SECONDS_PER_MINUTE;
    })(),
    et0: at(hourly.et0_fao_evapotranspiration, i),
    measured: false,
  }));
}
