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
 * modelled set is the eight figures the rest of the app already leads with — what it
 * is doing now, what it has done since this time yesterday — rather than an
 * arbitrary subset of everything Open-Meteo returns.
 *
 * Pure: no formatting, no units conversion, no translation beyond the labels handed
 * in. The page converts to the reader's units where it draws, exactly as every other
 * card in the app does.
 */
import type { ForecastModel } from './types';
import { recent24 } from './station';

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
  tempMax: string;
  tempMin: string;
  rainLastHour: string;
  rain24h: string;
  wind: string;
  gusts: string;
  humidity: string;
  dewpoint: string;
  /** Window label for "now", e.g. "nu". */
  now: string;
  /** Window label for the rolling day, e.g. "laatste 24 uur". */
  last24h: string;
  /** Window label for the hour that has just finished. */
  lastHour: string;
}

/**
 * The same grid, built from the forecast model.
 *
 * Every figure here is an observation or the hour in progress — never an afternoon
 * the model has not reached yet. 'Actueel' means actual, and a page that mixed
 * tomorrow's maximum into a grid of current readings would be answering a question
 * nobody on it asked. The forecast has two tabs of its own.
 *
 * Where a station has merged its measurements into `pastHours`, those tiles are
 * measured and say so — a rain gauge fills in the rainfall and leaves the wind to
 * the model, exactly as the conditions hero already shows it.
 */
export function modelTiles(model: ForecastModel, labels: TileLabels): Tile[] {
  const { tempMin, tempMax, precip } = recent24(model);
  const measured = model.station?.current ?? null;
  const now = model.futureHours[0] ?? model.pastHours[model.pastHours.length - 1] ?? null;
  const lastFull = model.pastHours[model.pastHours.length - 1] ?? null;
  /** True where a station has any say over this location at all. */
  const hasStation = !!model.station;

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
    tile('temp', labels.temperature, labels.now,
      measured?.temp ?? now?.tempExact ?? now?.temp, 'temp', '°', measured?.temp != null),
    tile('temp-max', labels.tempMax, labels.last24h, tempMax, 'temp', '°', hasStation),
    tile('temp-min', labels.tempMin, labels.last24h, tempMin, 'temp', '°', hasStation),
    // The hour that has just finished, not the one running: a full hour is a total,
    // where the current one is still being added to.
    tile('rain-hour', labels.rainLastHour, labels.lastHour, lastFull?.precip ?? 0, 'mm', 'mm', hasStation),
    tile('rain-24h', labels.rain24h, labels.last24h, precip, 'mm', 'mm', hasStation),
    tile('wind', labels.wind, labels.now,
      measured?.wind ?? now?.windExact ?? now?.wind, 'wind', '', measured?.wind != null),
    tile('gusts', labels.gusts, labels.now,
      measured?.gusts ?? now?.gusts, 'wind', '', measured?.gusts != null),
    tile('humidity', labels.humidity, labels.now,
      measured?.humidity ?? now?.humidity, 'percent', '%', measured?.humidity != null),
    tile('dewpoint', labels.dewpoint, labels.now,
      measured?.dewpoint ?? now?.dewpoint, 'temp', '°', measured?.dewpoint != null),
  ];
}
