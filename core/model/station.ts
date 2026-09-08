/**
 * Measurements over model.
 *
 * A station-backed location shows what a nearby instrument actually recorded instead
 * of what a model thinks happened. That substitution is *per quantity*, not per
 * hour: a RainExact measures precipitation and nothing else, an AtmoExact can lose a
 * single sensor, and in both cases the honest page is measured rainfall over a
 * modelled everything-else rather than an hour of blanks.
 *
 * What is deliberately **not** replaced:
 *
 *  - The weather code. A station measures quantities, not conditions; there is no
 *    instrument on it that can tell drizzle from a passing shower, so the icon keeps
 *    coming from the model.
 *  - Sunshine minutes. The API reports global radiation, which is not the same
 *    quantity — deriving minutes of bright sunshine from it would be a guess wearing
 *    a measurement's clothes.
 *  - Anything in the future. Measurements end at now, by definition.
 *
 * Pure, and separate from `processAll`, because the station data arrives on its own
 * schedule: the model is built when the forecast lands and re-decorated when the
 * station answers, without refetching either.
 */
import { AGRO_MAX_DISTANCE_KM, nearestStation, type AgroStation, type StationObservations } from '../sources/agroexact';
import type { SavedLocation } from '../prefs';
import type { ForecastModel, Hour, StationOverlay } from './types';

/** Prefer the measurement, keep the model where there is none. */
const pick = <T>(measured: T | null | undefined, modelled: T): T =>
  measured == null ? modelled : measured;

/**
 * Rebuild one hour from what the station measured in it.
 *
 * Returns the original object when nothing was measured, so React sees an unchanged
 * reference and the strip does not re-render its whole row set on every refresh.
 */
export function mergeHour(hour: Hour, measured: StationObservations['hours'][string] | undefined): Hour {
  if (!measured) return hour;
  return {
    ...hour,
    temp: pick(measured.temp, hour.temp),
    precip: pick(measured.precip, hour.precip),
    wind: pick(measured.wind, hour.wind),
    gusts: pick(measured.gusts, hour.gusts ?? null),
    windDir: pick(measured.windDir, hour.windDir ?? null),
    humidity: pick(measured.humidity, hour.humidity),
    dewpoint: pick(measured.dewpoint, hour.dewpoint ?? null),
    // The icon, the sunshine minutes and every ensemble figure stay as they were.
  };
}

/**
 * Apply a station's observations to a built model.
 *
 * Only the observed hours are touched. The current hour lives in `futureHours` — it
 * is a forecast hour that happens to have started — and is left alone: the station's
 * own reading for it is partial by construction, and the hero shows that reading
 * directly rather than through the strip.
 */
export function applyStationObservations(
  model: ForecastModel,
  obs: StationObservations | null
): ForecastModel {
  if (!obs) return model;

  const pastHours = model.pastHours.map((h) => mergeHour(h, obs.hours[h.time]));
  const station: StationOverlay = {
    id: obs.stationId,
    name: obs.stationName,
    current: obs.current,
  };

  return {
    ...model,
    pastHours,
    allHours: [...pastHours, ...model.futureHours],
    station,
    // `currentTemp` is what the widget and the notification rules read as "now", so
    // a measured reading belongs there too.
    currentTemp: obs.current?.temp ?? model.currentTemp,
  };
}

/**
 * The last 24 hours, summarised.
 *
 * The hero used to show today's forecast maximum and minimum beside the current
 * reading, which answers a question the reader did not ask on a card whose whole
 * subject is *now* — and on a station-backed location it mixed a measured present
 * with a modelled afternoon. A rolling 24 hours is one thing throughout: what it has
 * actually done since this time yesterday.
 *
 * Computed from the observed hours plus the latest reading, so it is measured data
 * wherever the location has any and observations from Open-Meteo everywhere else.
 */
export interface Recent24 {
  tempMin: number | null;
  tempMax: number | null;
  precip: number;
  /** How many hours the window actually covers, for a page that has just launched. */
  hours: number;
}

export function recent24(model: ForecastModel): Recent24 {
  const window = model.pastHours.slice(-24);
  const temps: number[] = [];
  let precip = 0;

  for (const h of window) {
    if (h.temp != null) temps.push(h.temp);
    precip += h.precip ?? 0;
  }

  // The reading from the hour in progress belongs in "the last 24 hours" as much as
  // the completed ones do — leaving it out is how a hero shows a maximum lower than
  // the temperature printed beside it.
  const now = model.station?.current?.temp ?? model.futureHours[0]?.temp ?? null;
  if (now != null) temps.push(now);

  return {
    tempMin: temps.length ? Math.min(...temps) : null,
    tempMax: temps.length ? Math.max(...temps) : null,
    precip: Math.round(precip * 10) / 10,
    hours: window.length,
  };
}

/**
 * A measurement's own time, as the hero prints it.
 *
 * Readings are UTC and arrive at ten-minute intervals, so unlike a modelled hour
 * this one has minutes worth showing: "14:42" says the station reported twelve
 * minutes ago, where "14:00" would suggest the top of the hour. The location's own
 * offset is used rather than the device's, so a Dutch station reads in Dutch time
 * on a phone set to another zone.
 */
export function measurementTimeLabel(measTime: string, offsetSec: number): string {
  const ms = new Date(measTime).getTime();
  if (!Number.isFinite(ms)) return '';
  const l = new Date(ms + offsetSec * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(l.getUTCHours())}:${pad(l.getUTCMinutes())}`;
}

/**
 * The station that speaks for a location, or null.
 *
 * Two ways a location gets one, and they are not the same rule. A location the sync
 * created is bound to its station by id, wherever it happens to sit. The device's
 * own page has no station of its own, so it may borrow the nearest one — but only
 * within `AGRO_MAX_DISTANCE_KM`, and only when the user has asked for that in
 * Instellingen.
 */
export function stationForLocation(
  location: SavedLocation,
  stations: readonly AgroStation[] | undefined,
  useForCurrentLocation: boolean
): { id: string; name: string | null } | null {
  if (location.stationId) {
    const known = stations?.find((s) => s.id === location.stationId);
    // The binding is stored on the location, so it holds before the list has landed.
    return { id: location.stationId, name: known?.name ?? location.stationName ?? null };
  }
  if (!location.current || !useForCurrentLocation || !stations?.length) return null;
  const near = nearestStation(stations, location.lat, location.lon);
  return near && near.dist <= AGRO_MAX_DISTANCE_KM ? { id: near.id, name: near.name } : null;
}
