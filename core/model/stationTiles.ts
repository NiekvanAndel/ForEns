/**
 * What one station's own record says for a block on 'Actueel'.
 *
 * A rule a grower sets names a block and a set of stations — "temp-min below 2 at
 * Hedikhuizen". Evaluating it means computing that block's figure from that
 * station's readings, which is what this does.
 *
 * ## Why not `modelTiles`
 *
 * Because `modelTiles` answers for a *location*: it takes a whole `ForecastModel`,
 * with a station's measurements already merged into it per quantity and the weather
 * model filling every gap. That merge is the right answer for a page — a rain gauge
 * measures the rainfall and the model speaks for the wind — and the wrong one for a
 * rule. Somebody who ticked a station wants that station's number, not a number the
 * station contributed part of, and a rule that fired on a modelled figure would be
 * telling them their field did something on the strength of a forecast.
 *
 * So the aggregation is written out again here, from the station alone. The windows
 * and the statistics are deliberately the same ones — the tests compare the two
 * against the same readings, because two implementations of "the last 24 hours"
 * agreeing today is not the same as them staying agreed.
 *
 * ## The two blocks a station cannot answer
 *
 * `rain-next-1h` and `rain-next-24h` are forecasts. A station has no opinion about
 * the next hour, so a rule on one of them returns null here and is skipped rather
 * than evaluated against something else that happens to be to hand. It is the same
 * rule as everywhere else in this app: a missing figure is missing, not zero.
 */
import type { MeasuredHour, Measurement } from '../sources/agroexact';

/** Hours back that a rolling window may reach. Matches `modelTiles`' own. */
const ROLLING = { six: 6, twelve: 12, day: 24 } as const;

export interface StationRecord {
  /** Hourly aggregates keyed by local hour, as `fetchStationObservations` returns. */
  hours: Record<string, MeasuredHour>;
  /** The latest reading, which is what every "nu" block is. */
  current: Measurement | null;
}

/** Whether a station can answer for this block at all. */
export function stationCanAnswer(tileId: string): boolean {
  return tileId !== 'rain-next-1h' && tileId !== 'rain-next-24h';
}

/**
 * The block's figure for this station, or null where there is none.
 *
 * `nowKey` is the local hour the run is in, `YYYY-MM-DDTHH:MM` — the same key shape
 * the hours are stored under. Windows are counted back from it rather than from the
 * newest row present, so a station that stopped reporting two hours ago produces a
 * 24-hour total of what it actually measured rather than of its last 24 rows.
 */
export function stationTileValue(
  tileId: string,
  record: StationRecord,
  nowKey: string
): number | null {
  const { hours, current } = record;

  /** The rows of the last `n` hours, oldest first, gaps simply absent. */
  const back = (n: number): MeasuredHour[] => {
    const out: MeasuredHour[] = [];
    const base = Date.parse(`${nowKey.slice(0, 13)}:00:00Z`);
    if (!Number.isFinite(base)) return out;
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(base - i * 3_600_000);
      const key =
        `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
        `T${pad(d.getUTCHours())}:00`;
      const row = hours[key];
      if (row) out.push(row);
    }
    return out;
  };

  /** Every row of the calendar day `nowKey` falls in, up to and including it. */
  const today = (): MeasuredHour[] => {
    const day = nowKey.slice(0, 10);
    return Object.entries(hours)
      .filter(([key]) => key.slice(0, 10) === day && key <= nowKey)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([, row]) => row);
  };

  const sum = (rows: readonly MeasuredHour[]): number | null => {
    const v = rows.map((h) => h.precip).filter(isNum);
    return v.length ? round1(v.reduce((a, b) => a + b, 0)) : null;
  };
  const peak = (rows: readonly MeasuredHour[]): number | null => {
    const v = rows.map((h) => h.gusts).filter(isNum);
    return v.length ? Math.max(...v) : null;
  };

  /**
   * Every temperature the last 24 hours touched.
   *
   * The hourly aggregate carries its own minimum and maximum, so the day's coldest
   * was inside some hour's minimum rather than at the lowest hourly mean — the same
   * reading `modelTiles` takes. The latest measurement joins them, because the
   * newest hour may not have been aggregated yet.
   */
  const temps = (): number[] => {
    const rows = back(ROLLING.day);
    const out = rows.flatMap((h) => [h.temp, h.tempMin, h.tempMax].filter(isNum));
    if (isNum(current?.temp)) out.push(current.temp);
    return out;
  };

  switch (tileId) {
    case 'temp': return current?.temp ?? null;
    case 'humidity': return current?.humidity ?? null;
    case 'wind': return current?.wind ?? null;
    case 'gust': return current?.gusts ?? null;
    case 'wind-dir': return current?.windDir ?? null;
    case 'gust-max': return peak(today());
    case 'rain-6h': return sum(back(ROLLING.six));
    case 'rain-12h': return sum(back(ROLLING.twelve));
    case 'rain-today': return sum(today());
    case 'rain-24h': return sum(back(ROLLING.day));
    case 'temp-max': {
      const t = temps();
      return t.length ? Math.max(...t) : null;
    }
    case 'temp-min': {
      const t = temps();
      return t.length ? Math.min(...t) : null;
    }
    // Forecast blocks, and anything a later version adds that this has not learned:
    // null rather than a guess. See the note at the top.
    default: return null;
  }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const pad = (n: number) => String(n).padStart(2, '0');
const round1 = (v: number) => Math.round(v * 10) / 10;
