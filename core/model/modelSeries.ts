/**
 * The disease models over a period, for 'Grafiek'.
 *
 * A badge says where a model stands today; this says how it got there. A grower
 * looking at a Smith badge wants to know whether last week was one long damp stretch or
 * two near misses, and that is a different question from the one the card answers.
 *
 * ## Always a day per sample
 *
 * Unlike every other series on that page, these do not change grain with the window.
 * Both models *are* daily — Smith counts hours within a calendar day and DIV scores
 * one — so an hourly view of them would be drawing a figure that does not exist at
 * that resolution. A one-day window is one bar, which is honest rather than useful,
 * and the page's own period row is where a reader fixes that.
 *
 * ## No forecast half
 *
 * Nothing here runs ahead of now. The models read measured hours, and a Smith period
 * computed from a forecast would be a claim about weather that has not happened
 * wearing the authority of one about weather that has. When the plan's step 4c brings a
 * forecast into these series, it arrives as `future` samples and the chart starts
 * dashing them without a line of this changing.
 */
import { DIV_HUMIDITY, DIV_RECENT_THRESHOLD, divFor } from './cercospora';
import { SMITH } from './smith';
import { humidDays, type HumidHour } from './humidHours';
import { timeKeys, type Sample, type Series, type SeriesShape } from './series';

/** Which model a chart is about. */
export type ModelSeriesKey = 'smithHours' | 'divDaily';

export interface ModelSeriesMeta {
  key: ModelSeriesKey;
  shape: SeriesShape;
  axisMin: number;
  axisMax: number;
  axisFixed: true;
  /** The boundary the model is read against, on the same axis. */
  threshold: number;
}

export const MODEL_SERIES_META: Record<ModelSeriesKey, ModelSeriesMeta> = {
  /**
   * Humid hours per day, against Smith's eleven.
   *
   * Pinned to a full day, because that is the scale the threshold means something on:
   * eleven hours out of twenty-four. An axis fitted to a quiet week would put a line
   * at eleven above the top of the plot and a line at four looking alarming.
   */
  smithHours: {
    key: 'smithHours', shape: 'bar',
    axisMin: 0, axisMax: 24, axisFixed: true,
    threshold: SMITH.hoursPerDay,
  },
  /**
   * The daily infection value, against the two-day threshold.
   *
   * The bars are each day's score and the line over them is the rolling two-day total —
   * which is the figure the guidance is actually read on, so it is the one the
   * threshold line sits at. Both on one axis, as with refill room and its rain: the
   * point is seeing that two fives make a ten and two threes do not.
   */
  divDaily: {
    key: 'divDaily', shape: 'bar',
    // A single day tops out at 7, so two days top out at 14.
    axisMin: 0, axisMax: 14, axisFixed: true,
    threshold: DIV_RECENT_THRESHOLD,
  },
};

export interface BuildModelSeriesInput {
  key: ModelSeriesKey;
  /** The window, as local calendar days. */
  from: string;
  to: string;
  /** The hours the models run on, from whichever instrument stands here. */
  hours: readonly HumidHour[];
}

/**
 * One model over one window, a day at a time.
 *
 * A day the instrument only half reported is a gap, not a zero — the same rule the
 * models themselves follow, and for the same reason: a bar of four on a day the station
 * was down reads as a quiet day, and quiet days are exactly what a grower is deciding
 * not to walk the field on.
 */
export function buildModelSeries({
  key, from, to, hours,
}: BuildModelSeriesInput): Series {
  const byDate = new Map(
    humidDays(hours, DIV_HUMIDITY).map((d) => [d.date, d])
  );

  // One sample per calendar day in the window, whether or not the instrument reported
  // it — a week with a silent Tuesday should show a gap on Tuesday, not six days.
  const dates = [...new Set(timeKeys(from, to, 24 * 60).map((t) => t.slice(0, 10)))];

  const daily: Sample[] = dates.map((date) => {
    const day = byDate.get(date);
    if (!day?.complete) {
      return { key: date, value: null, measured: false, future: false, source: null };
    }

    const meanTemp = day.minTemp != null && day.maxTemp != null
      ? (day.minTemp + day.maxTemp) / 2
      : null;

    const value = key === 'smithHours' ? day.hours : divFor(day.hours, meanTemp);

    return {
      key: date,
      value,
      // Derived from measurements, not measured. The chart's own solid-versus-dashed
      // rule is about past against future, which these are all on one side of.
      measured: false,
      future: false,
      source: value != null ? ('station' as const) : null,
    };
  });

  const samples = key === 'divDaily' ? withRollingTwoDay(daily) : daily;
  const values = samples.map((s) => s.value).filter((v): v is number => v != null);

  return {
    resolution: 'day',
    samples,
    stats: values.length
      ? {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
          total: Math.round(values.reduce((a, b) => a + b, 0) * 10) / 10,
          secondaryMax: null,
        }
      : null,
    anyMeasured: false,
    forecastFrom: -1,
  };
}

/**
 * Each day with the one before it, which is the figure the guidance reads.
 *
 * A gap breaks it rather than being counted as zero: two qualifying days either side of
 * a day nobody measured are not two days in a row, and a total that quietly spanned the
 * gap would say they were.
 */
function withRollingTwoDay(samples: readonly Sample[]): Sample[] {
  return samples.map((s, i) => {
    const previous = samples[i - 1]?.value;
    if (s.value == null) return { ...s, cumulative: null };
    return {
      ...s,
      cumulative: previous == null ? s.value : s.value + previous,
    };
  });
}
