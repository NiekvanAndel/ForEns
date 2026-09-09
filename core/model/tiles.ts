/**
 * The blocks on 'Actueel'.
 *
 * Twelve of them, fixed, in the app's own words. Every one is read out of the
 * forecast model — which, on a location an AgroExact station speaks for, has already
 * had that station's measurements merged into it per quantity by
 * `applyStationObservations`. So the same twelve blocks serve both kinds of location,
 * and on a station they are the station's own numbers.
 *
 * ## Why the account's dashboard is not read here
 *
 * It was, at first: `/aggregations/` is the catalog behind the web app's dashboard,
 * and the blocks a grower picks there are a real statement about their own farm. Two
 * things ruled it out. The set is meant to be these twelve and no others, which a
 * catalog someone edits on the web cannot promise; and its titles and time labels
 * are translated server-side, so the page spoke whatever language the API chose
 * rather than the one set in Instellingen. Those two together leave nothing for the
 * catalog to do that the merged model does not already do better.
 *
 * The station is still what makes the numbers measurements. A block carries
 * `measured: true` and gets the green dot — design rule 1 — and the flag is decided
 * per quantity, because a rain gauge measures the rainfall and leaves the wind to
 * the model.
 *
 * Pure: no formatting, no unit conversion, no translation beyond the labels handed
 * in. The page converts to the reader's units where it draws, as every other card in
 * the app does.
 */
import type { ForecastModel } from './types';

/** Which unit family a tile's value belongs to, so the page can convert it. */
export type TileKind = 'temp' | 'wind' | 'mm' | 'percent' | 'direction';

export interface Tile {
  /** Stable within a grid, for React's key. */
  id: string;
  title: string;
  /** The window the value covers, e.g. "laatste 24 uur". */
  timeLabel: string;
  /** Null draws a dash: a block with no answer still holds its place in the grid. */
  value: number | null;
  kind: TileKind;
  /** True where an instrument reported this rather than a model. */
  measured: boolean;
}

/** The words the modelled grid needs, handed in so this module stays pure. */
export interface TileLabels {
  temperature: string;
  humidity: string;
  windSpeed: string;
  windGust: string;
  windDirection: string;
  gustMax: string;
  rain: string;
  tempMax: string;
  tempMin: string;
  /** Window labels. */
  now: string;
  today: string;
  last6h: string;
  last12h: string;
  last24h: string;
}

/** How many of the trailing observed hours a rolling window covers. */
const ROLLING = { six: 6, twelve: 12, day: 24 } as const;

/**
 * The twelve blocks, from the model — which already carries the station's own
 * readings on a location that has one.
 *
 * What it is doing now, what the wind has done today, rainfall over four windows,
 * and the day's extremes. Every figure is an observation or the hour in progress —
 * never an afternoon the model has not reached yet. 'Actueel' means actual, and a
 * grid of current readings with tomorrow's maximum in it would be answering a
 * question nobody on this page asked. The forecast has two tabs of its own.
 *
 * ## Rolling windows and calendar days are both here, and they are not the same
 *
 * "Laatste 24 uur" counts back from now; "vandaag" starts at midnight. At four in
 * the afternoon they are different numbers, and a grower reading a spray window
 * cares which — so both are shown, each labelled with the window it covers, rather
 * than one standing in for the other.
 *
 * ## Which blocks get the green dot
 *
 * Per quantity, decided by whether the station's latest reading carries that
 * quantity at all. A station either has an anemometer or it does not, so a rain
 * gauge answering with rainfall and nulls for the wind marks its rainfall blocks
 * measured and leaves the wind blocks plain — which is exactly what the hero on 'Nu'
 * already does with the same readings.
 *
 * Marking every block on a station-backed location as measured would have been the
 * easy version and the wrong one: it would put an instrument's authority behind a
 * number the model supplied.
 */
export function modelTiles(model: ForecastModel, labels: TileLabels): Tile[] {
  const measured = model.station?.current ?? null;
  const now = model.futureHours[0] ?? model.pastHours[model.pastHours.length - 1] ?? null;
  // The location's own local day, from the model's own clock — not the device's,
  // which may be in another zone entirely.
  const todayKey = model.nowHour.slice(0, 10);
  const today = model.pastHours.filter((h) => h.time.slice(0, 10) === todayKey);
  const measures = {
    temp: measured?.temp != null,
    humidity: measured?.humidity != null,
    wind: measured?.wind != null,
    gusts: measured?.gusts != null,
    windDir: measured?.windDir != null,
    precip: measured?.precip != null,
  };

  const sum = (hours: readonly { precip: number | null }[]) =>
    Math.round(hours.reduce((total, h) => total + (h.precip ?? 0), 0) * 10) / 10;

  const peak = (hours: readonly { gusts?: number | null }[]): number | null => {
    const values = hours.map((h) => h.gusts).filter((v): v is number => v != null);
    // The reading from the hour in progress belongs in "today" as much as the
    // completed ones do.
    if (measured?.gusts != null) values.push(measured.gusts);
    return values.length ? Math.max(...values) : null;
  };

  const window = model.pastHours.slice(-ROLLING.day);
  const temps = window
    .map((h) => h.tempExact ?? h.temp)
    .filter((v): v is number => v != null);
  const nowTemp = measured?.temp ?? now?.tempExact ?? now?.temp ?? null;
  if (nowTemp != null) temps.push(nowTemp);

  const tile = (
    id: string,
    title: string,
    timeLabel: string,
    value: number | null | undefined,
    kind: TileKind,
    isMeasured: boolean
  ): Tile => ({
    id, title, timeLabel,
    value: value == null || !Number.isFinite(value) ? null : value,
    kind, measured: isMeasured,
  });

  return [
    tile('temp', labels.temperature, labels.now, nowTemp, 'temp', measures.temp),
    tile('humidity', labels.humidity, labels.now,
      measured?.humidity ?? now?.humidity, 'percent', measures.humidity),
    tile('wind', labels.windSpeed, labels.now,
      measured?.wind ?? now?.windExact ?? now?.wind, 'wind', measures.wind),
    tile('gust', labels.windGust, labels.now,
      measured?.gusts ?? now?.gusts, 'wind', measures.gusts),
    tile('wind-dir', labels.windDirection, labels.now,
      measured?.windDir ?? now?.windDir, 'direction', measures.windDir),
    tile('gust-max', labels.gustMax, labels.today, peak(today), 'wind', measures.gusts),
    tile('rain-6h', labels.rain, labels.last6h,
      sum(model.pastHours.slice(-ROLLING.six)), 'mm', measures.precip),
    tile('rain-12h', labels.rain, labels.last12h,
      sum(model.pastHours.slice(-ROLLING.twelve)), 'mm', measures.precip),
    tile('rain-today', labels.rain, labels.today, sum(today), 'mm', measures.precip),
    tile('rain-24h', labels.rain, labels.last24h, sum(window), 'mm', measures.precip),
    tile('temp-max', labels.tempMax, labels.last24h,
      temps.length ? Math.max(...temps) : null, 'temp', measures.temp),
    tile('temp-min', labels.tempMin, labels.last24h,
      temps.length ? Math.min(...temps) : null, 'temp', measures.temp),
  ];
}
