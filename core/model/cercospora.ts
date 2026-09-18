/**
 * Cercospora-DIV: how favourable the day was for leaf spot in sugar beet.
 *
 * The second client of `humidHours`, and a different shape from Smith. Smith asks a
 * yes-or-no question per day; DIV scores the day from 0 to 7 by weighing how many
 * humid hours it had *against the temperature during them* — warm and damp scores
 * high, damp and cold scores nothing at all. The scores then accumulate.
 *
 * ## ⚠ The table must be checked against the primary source before this ships
 *
 * The matrix below is the Shane & Teng daily-infection-value table as it is commonly
 * reproduced. **It has not been verified against IRS's own published version**, and
 * this app cannot verify it from the outside. The plan's own rule is that no indicator
 * exists without a published source, and its open-points list names exactly this class
 * of thing — the Mills table and the Dutch Beaumont parameters — as something to take
 * from the primary source before a line of code depends on it.
 *
 * So: the numbers are isolated in `DIV_TABLE` and nothing else here knows them. If
 * IRS's table differs, replacing this constant is the whole change, and
 * `tests/cercospora.test.ts` guards the properties that must hold whatever the numbers
 * are — more humid hours never score lower, and the temperature extremes score zero.
 *
 * Getting this wrong has a direction: a table that scores too low tells a grower their
 * beet is safe when it is not. That is the failure to design against.
 *
 * ## It signals, it does not prescribe
 *
 * As with Smith: a run of high DIVs says the weather has suited the fungus. Whether to
 * act depends on the variety's resistance, the spray interval and what the grower finds
 * when they walk the field. "Ga kijken", never "ga spuiten".
 */
import { humidDays, type HumidHour, type HumidSource } from './humidHours';

/** Cercospora counts hours at or above this, in %. */
export const DIV_HUMIDITY = 90;

/**
 * Upper bounds of the hour bands, in the table's own order.
 *
 * 0–2, 3–4, 5–6, 7–9, 10–12, 13–15, 16–18, 19–21, 22–24.
 */
const HOUR_BANDS = [2, 4, 6, 9, 12, 15, 18, 21, 24] as const;

/**
 * Upper bounds of the temperature bands, warmest last.
 *
 * ≤15, ≤17, ≤19, ≤21, ≤26, ≤28, and everything above.
 */
const TEMP_BANDS = [15, 17, 19, 21, 26, 28, Infinity] as const;

/**
 * The daily infection values, by temperature band then hour band.
 *
 * **Unverified — see the warning at the top of this file.** Replacing this constant is
 * the whole of the change if IRS's table differs.
 */
export const DIV_TABLE: readonly (readonly number[])[] = [
  /* ≤15    */ [0, 0, 0, 0, 0, 0, 0, 0, 0],
  /* ≤17    */ [0, 0, 0, 1, 1, 1, 2, 2, 2],
  /* ≤19    */ [0, 0, 1, 1, 2, 2, 3, 3, 4],
  /* ≤21    */ [0, 1, 1, 2, 3, 4, 5, 5, 6],
  /* ≤26    */ [0, 1, 2, 3, 4, 5, 6, 6, 7],
  /* ≤28    */ [0, 1, 1, 2, 3, 4, 5, 5, 6],
  /* >28    */ [0, 0, 0, 0, 0, 0, 0, 0, 0],
];

/** Where a value falls in a set of upper bounds. */
const bandOf = (value: number, bounds: readonly number[]): number => {
  const i = bounds.findIndex((b) => value <= b);
  return i === -1 ? bounds.length - 1 : i;
};

/**
 * One day's infection value.
 *
 * Null where the day cannot be scored — no humid hours reported a temperature, so
 * there is no band to look the score up in. Null is not zero: zero says the weather
 * was unsuitable, and null says nobody knows.
 */
export function divFor(humidHours: number, meanTemp: number | null): number | null {
  if (meanTemp == null) return null;
  if (humidHours <= 0) return 0;
  const row = DIV_TABLE[bandOf(meanTemp, TEMP_BANDS)];
  return row?.[bandOf(humidHours, HOUR_BANDS)] ?? null;
}

export interface CercosporaDay {
  date: string;
  /** Hours at or above `DIV_HUMIDITY`. */
  humidHours: number;
  /** Mean temperature over the day's hours. */
  meanTemp: number | null;
  /** 0–7, or null where the day cannot be scored. */
  div: number | null;
  complete: boolean;
}

export interface CercosporaResult {
  days: CercosporaDay[];
  /** The running total over the window, counting only days that could be scored. */
  total: number;
  /** The last two scored days together — the figure the two-day rule reads. */
  recent: number;
  source: HumidSource;
}

/**
 * How many DIV over two days counts as favourable.
 *
 * **Also to be confirmed against IRS.** The commonly published guidance is that two
 * consecutive days summing to this or more mean conditions have been suitable. It is a
 * named constant for the same reason the table is: so the number a grower is being
 * warned on is one line to correct.
 */
export const DIV_RECENT_THRESHOLD = 6;

export interface CercosporaInput {
  hours: readonly HumidHour[];
  source: HumidSource;
}

/**
 * DIV over a window of hours.
 *
 * An incomplete day is scored but flagged, and left out of the totals — the same rule
 * Smith follows and for the same reason: a day assembled from nineteen hours cannot be
 * compared against a table counted in hours, and treating it as a quiet day clears a
 * field on the strength of missing data.
 */
export function cercospora({ hours, source }: CercosporaInput): CercosporaResult {
  const days: CercosporaDay[] = humidDays(hours, DIV_HUMIDITY).map((d) => ({
    date: d.date,
    humidHours: d.hours,
    meanTemp: d.minTemp != null && d.maxTemp != null
      ? Math.round(((d.minTemp + d.maxTemp) / 2) * 10) / 10
      : null,
    complete: d.complete,
    div: d.complete
      ? divFor(d.hours, d.minTemp != null && d.maxTemp != null ? (d.minTemp + d.maxTemp) / 2 : null)
      : null,
  }));

  const scored = days.filter((d) => d.div != null);
  return {
    days,
    total: scored.reduce((sum, d) => sum + (d.div ?? 0), 0),
    recent: scored.slice(-2).reduce((sum, d) => sum + (d.div ?? 0), 0),
    source,
  };
}

/** Which crops this model speaks for. Sugar beet, and nothing else. */
export function cercosporaAppliesTo(crop: string | null | undefined): boolean {
  const c = (crop ?? '').trim().toLowerCase();
  return c === 'suikerbiet' || c === 'biet';
}
