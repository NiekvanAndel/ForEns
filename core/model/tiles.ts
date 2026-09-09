/**
 * The blocks on 'Actueel'.
 *
 * Two sources, one shape. Where a location has an AgroExact station, the blocks are
 * the ones on that account's dashboard — the API says what they are called, over
 * which window they are computed and in which unit, and the app draws them in the
 * order the grower put them in. Where it has no station, the same grid is built from
 * the weather model instead, so every location has a page rather than a page and an
 * apology.
 *
 * The two are deliberately not made to look identical. A measured block carries
 * `measured: true`, and the grid gives it the station dot — design rule 1 says green
 * names a station, and the whole difference between the two halves of this file is
 * whether an instrument or a model is speaking.
 *
 * ## Why the model blocks are fixed and the station blocks are not
 *
 * A dashboard is a choice someone made about their own farm; there is nowhere to
 * make that choice for a town in Zeeland the reader searched for last week. So the
 * modelled set is a fixed twelve, chosen once by the client — see `modelTiles`.
 *
 * Pure: no formatting, no units conversion, no translation beyond the labels handed
 * in. The page converts to the reader's units where it draws, exactly as every other
 * card in the app does.
 */
import type { ForecastModel } from './types';

/** Which unit family a tile's value belongs to, so the page can convert it. */
export type TileKind = 'temp' | 'wind' | 'mm' | 'percent' | 'direction' | 'raw';

export interface Tile {
  /** Stable within a grid, for React's key. */
  id: string;
  /** What the block is called. From the API on a station, from `appStrings` here. */
  title: string;
  /** The window the value covers, e.g. "laatste 24 uur". Blank where there is none. */
  timeLabel: string;
  /** Null draws a dash: a block with no answer still holds its place in the grid. */
  value: number | null;
  /** Only used for `raw`; the other kinds carry the unit their formatter prints. */
  unit: string;
  kind: TileKind;
  /** True where an instrument reported this rather than a model. */
  measured: boolean;
}

/** Attributes the API names for a wind *direction*, which reads as a compass point
 *  rather than as a number of degrees. */
const DIRECTION = /direction/i;

/**
 * Which unit family an API block belongs to, from the attribute it is computed over.
 *
 * The unit string alone would be tempting and is not enough: the API sends wind in
 * m/s and the app works in km/h, so a block matched on "m/s" would be converted
 * twice on a phone set to metres per second and not at all on one set to knots. The
 * attribute says what the quantity *is*, which is the thing that decides.
 */
export function tileKind(attribute: string, unit: string): TileKind {
  if (DIRECTION.test(attribute)) return 'direction';
  if (/temperature|dewpoint|windchill|wet_bulb/i.test(attribute)) return 'temp';
  if (/wind|gust/i.test(attribute)) return 'wind';
  if (/precipitation|rain/i.test(attribute)) return 'mm';
  if (/humidity/i.test(attribute) || unit === '%') return 'percent';
  return 'raw';
}

export interface DashboardEntry {
  id: number;
  title: string;
  attribute: string;
  timeLabel: string;
  unit: string;
  value: number | null;
}

/**
 * The account's dashboard blocks, as tiles.
 *
 * The API's own wind figures are metres per second, like everywhere else it speaks,
 * so they are converted to the km/h the app works in before the page converts again
 * to whatever the reader asked for. Getting that wrong is silent: 4 m/s and 4 km/h
 * are both plausible wind speeds.
 */
export function dashboardTiles(entries: readonly DashboardEntry[]): Tile[] {
  return entries.map((e) => {
    const kind = tileKind(e.attribute, e.unit);
    const value =
      kind === 'wind' && e.value != null
        ? Math.round(e.value * 3.6 * 10) / 10
        : e.value;
    return {
      id: `agro-${e.id}`,
      title: e.title,
      timeLabel: e.timeLabel,
      value,
      unit: e.unit,
      kind,
      measured: true,
    };
  });
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
 * The grid for a location no station speaks for, built from the forecast model.
 *
 * Twelve blocks, chosen by the client: what it is doing now, what the wind has done
 * today, and rainfall over four windows. Every figure is an observation or the hour
 * in progress — never an afternoon the model has not reached yet. 'Actueel' means
 * actual, and a grid of current readings with tomorrow's maximum in it would be
 * answering a question nobody on this page asked. The forecast has two tabs of its
 * own.
 *
 * ## Rolling windows and calendar days are both here, and they are not the same
 *
 * "Laatste 24 uur" counts back from now; "vandaag" starts at midnight. At four in
 * the afternoon they are different numbers, and a grower reading a spray window
 * cares which — so both are shown, each labelled with the window it covers, rather
 * than one standing in for the other.
 *
 * Where a station has merged its measurements into `pastHours`, these tiles are
 * measured and say so — a rain gauge fills in the rainfall and leaves the wind to
 * the model, exactly as the conditions hero already shows it.
 */
export function modelTiles(model: ForecastModel, labels: TileLabels): Tile[] {
  const measured = model.station?.current ?? null;
  const now = model.futureHours[0] ?? model.pastHours[model.pastHours.length - 1] ?? null;
  /** True where a station has any say over this location at all. */
  const hasStation = !!model.station;
  // The location's own local day, from the model's own clock — not the device's,
  // which may be in another zone entirely.
  const todayKey = model.nowHour.slice(0, 10);
  const today = model.pastHours.filter((h) => h.time.slice(0, 10) === todayKey);

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
    unit: string,
    isMeasured: boolean
  ): Tile => ({
    id, title, timeLabel,
    value: value == null || !Number.isFinite(value) ? null : value,
    unit, kind, measured: isMeasured,
  });

  return [
    tile('temp', labels.temperature, labels.now, nowTemp, 'temp', '°', measured?.temp != null),
    tile('humidity', labels.humidity, labels.now,
      measured?.humidity ?? now?.humidity, 'percent', '%', measured?.humidity != null),
    tile('wind', labels.windSpeed, labels.now,
      measured?.wind ?? now?.windExact ?? now?.wind, 'wind', '', measured?.wind != null),
    tile('gust', labels.windGust, labels.now,
      measured?.gusts ?? now?.gusts, 'wind', '', measured?.gusts != null),
    tile('wind-dir', labels.windDirection, labels.now,
      measured?.windDir ?? now?.windDir, 'direction', '', measured?.windDir != null),
    tile('gust-max', labels.gustMax, labels.today, peak(today), 'wind', '', hasStation),
    tile('rain-6h', labels.rain, labels.last6h, sum(model.pastHours.slice(-ROLLING.six)), 'mm', 'mm', hasStation),
    tile('rain-12h', labels.rain, labels.last12h, sum(model.pastHours.slice(-ROLLING.twelve)), 'mm', 'mm', hasStation),
    tile('rain-today', labels.rain, labels.today, sum(today), 'mm', 'mm', hasStation),
    tile('rain-24h', labels.rain, labels.last24h, sum(window), 'mm', 'mm', hasStation),
    tile('temp-max', labels.tempMax, labels.last24h,
      temps.length ? Math.max(...temps) : null, 'temp', '°', hasStation),
    tile('temp-min', labels.tempMin, labels.last24h,
      temps.length ? Math.min(...temps) : null, 'temp', '°', hasStation),
  ];
}
