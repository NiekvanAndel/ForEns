/**
 * The ensemble spread the chart on 'Grafiek' draws behind its forecast.
 *
 * A forecast line is a single number per sample, and on its own it claims a precision
 * the model does not have. The 51 IFS members are what the app carries to say where
 * that claim is weak; the day sheets already show them a day at a time, and this puts
 * the same p10–p90 on the page where a reader looks at a whole window.
 *
 * ## Percentiles come last, always
 *
 * The members go in and the percentiles come out *at the resolution the chart draws*.
 * That order is the point of this module. A percentile cannot be aggregated after the
 * fact: the p10 of a day's rainfall is not the sum of its hours' p10s, because that
 * would be the total of a member that was the tenth-driest in every single hour, and
 * no such member exists. Reducing per member first and taking the percentile of the
 * results asks the question a reader is actually asking — how dry could this day
 * plausibly be — and gives a band that is narrower and true rather than wide and
 * invented.
 *
 * ## Which statistic a band is of
 *
 * Not always the same one as the line it sits behind, which is why `stat` is a
 * parameter rather than a consequence of the field.
 *
 * Per hour a bucket is one hour, and every statistic of one number is that number.
 * Per day they come apart, and the chart draws three temperature lines: the day's
 * mean, its minimum and its maximum. A band around the mean is the least useful of
 * the three — it is the spread of an average, which is narrow by construction and is
 * not a number anybody plans around. The spread of *the coldest hour* is: it answers
 * "could it freeze tonight", which is the question a week of temperatures is read
 * for. So per day the band goes on the edges, built from each member's own minimum
 * and maximum, and the mean is left as a bare line.
 *
 * ## What counts as an ensemble
 *
 * Two members at least. Open-Meteo answers a request for member columns it does not
 * have with the plain deterministic series, which `memberSeries` passes through as a
 * single row — and a band drawn from one member is a line with zero width pretending
 * to be a range.
 */
import { percentile, round1 } from './stats';
import type { EnsembleMembers } from '../sources/ensembleRange';

/** Which quantity the band is for. Only these two: they are what the page bands. */
export type BandField = 'temp' | 'precip';

/** How a member's hours are reduced to one value for a bucket. See the note above. */
export type BucketStat = 'mean' | 'sum' | 'min' | 'max';

export type BandResolution = 'minute' | 'hour' | 'day';

export interface Band {
  lo: number;
  hi: number;
}

/** Fewer than this and there is no spread to speak of. See the note above. */
const MIN_MEMBERS = 2;

/** What a field's band is of unless the caller says otherwise. */
export const DEFAULT_STAT: Record<BandField, BucketStat> = { temp: 'mean', precip: 'sum' };

/**
 * The key a sample looks its band up under.
 *
 * At day resolution that is the day. At hour and minute resolution it is the hour:
 * the ensemble is hourly, so a ten-minute sample is answered by the hour it falls
 * inside — the same rule `buildSeries` uses for the deterministic model, which has
 * nothing to say about twenty past three either.
 */
export function bandKey(sampleKey: string, resolution: BandResolution): string {
  return resolution === 'day' ? sampleKey.slice(0, 10) : `${sampleKey.slice(0, 14)}00`;
}

/**
 * One member's value for a bucket.
 *
 * A missing hour in a rainfall member is no rain, so it counts as zero; a missing
 * temperature is unknown and is left out rather than dragging the result toward
 * freezing. Both rules are `parseDayEnsemble`'s, for the same reasons.
 */
function reduceBucket(stat: BucketStat, values: readonly (number | null)[]): number | null {
  if (stat === 'sum') return values.reduce<number>((a, v) => a + (v ?? 0), 0);
  const finite = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!finite.length) return null;
  if (stat === 'min') return Math.min(...finite);
  if (stat === 'max') return Math.max(...finite);
  return finite.reduce((a, b) => a + b, 0) / finite.length;
}

/**
 * Bucket → one value per member, in member order.
 *
 * Null where a member had nothing for that bucket. The rows stay aligned by member
 * index across buckets on purpose: a percentile does not need that, but a running
 * total does — `cumulativeBands` follows each member through the window, and it can
 * only do so while member `m` is the same member in every bucket.
 *
 * Empty where the response carried no ensemble, which is the honest answer and the
 * one that makes the chart draw no band rather than a flat one.
 */
export function memberBuckets(
  members: EnsembleMembers,
  field: BandField,
  resolution: BandResolution,
  stat: BucketStat = DEFAULT_STAT[field]
): Map<string, (number | null)[]> {
  const series = field === 'precip' ? members.precip : members.temp;
  if (series.length < MIN_MEMBERS) return new Map();

  // Gathered in one pass, so a month at day resolution walks the members' rows once
  // rather than once per day.
  const hours = new Map<string, (number | null)[][]>();
  members.times.forEach((time, i) => {
    const key = bandKey(time, resolution);
    let rows = hours.get(key);
    if (!rows) {
      rows = series.map(() => []);
      hours.set(key, rows);
    }
    series.forEach((member, m) => rows![m]!.push(member[i] ?? null));
  });

  const out = new Map<string, (number | null)[]>();
  for (const [key, rows] of hours) out.set(key, rows.map((values) => reduceBucket(stat, values)));
  return out;
}

/** The p10–p90 per bucket. `floor` clamps the band for a quantity that has one —
 *  rainfall cannot be negative, and a band off the wrong side of the axis is noise. */
export function bandsFrom(
  buckets: Map<string, (number | null)[]>,
  floor?: number
): Map<string, Band> {
  const out = new Map<string, Band>();
  for (const [key, values] of buckets) {
    const present = values.filter((v): v is number => v != null);
    if (present.length < MIN_MEMBERS) continue;
    const lo = percentile(present, 10);
    const hi = percentile(present, 90);
    if (lo == null || hi == null) continue;
    out.set(key, {
      lo: round1(floor != null ? Math.max(floor, lo) : lo),
      hi: round1(floor != null ? Math.max(floor, hi) : hi),
    });
  }
  return out;
}

/** `memberBuckets` and `bandsFrom` in one call, which is what most callers want. */
export function ensembleBands(
  members: EnsembleMembers,
  field: BandField,
  resolution: BandResolution,
  stat: BucketStat = DEFAULT_STAT[field]
): Map<string, Band> {
  return bandsFrom(memberBuckets(members, field, resolution, stat), field === 'precip' ? 0 : undefined);
}

/** The shape of a sample, as far as a band cares. */
export interface BandSample {
  key: string;
  future: boolean;
  cumulative?: number | null;
}

/**
 * The band for each sample, in the samples' own order, for handing to the chart.
 *
 * Null where there is none, and null for anything that has already happened: a band
 * around a measurement would say the thermometer might have read something else.
 */
export function bandsForSamples(
  bands: Map<string, Band>,
  samples: readonly BandSample[],
  resolution: BandResolution
): (Band | null)[] {
  if (!bands.size) return samples.map(() => null);
  return samples.map((s) => (s.future ? bands.get(bandKey(s.key, resolution)) ?? null : null));
}

/**
 * The band around the running rainfall total.
 *
 * Built by following each member through the window and taking the percentile of the
 * totals, which is the same "reduce per member, percentile last" rule as everywhere
 * else here and matters more on a total than anywhere else: a run of hourly p10s
 * accumulated into a line would be the total of a member that was the driest hour
 * after hour, and the band would open into a fan several times wider than the members
 * allow.
 *
 * It starts from what has already fallen. The measured half of the total is not in
 * doubt — it is a rain gauge, or the model's own record of hours that have passed —
 * so every member carries on from the last actual figure rather than from zero. The
 * band therefore begins as a point at the forecast boundary and widens from there,
 * which is the picture: how much *more* could still fall.
 *
 * A future sample whose bucket the members do not cover carries the running totals
 * forward unchanged, exactly as `withCumulative` carries the deterministic line
 * across a gap: an unknown hour did not undo the rain before it.
 */
export function cumulativeBands(
  buckets: Map<string, (number | null)[]>,
  samples: readonly BandSample[],
  resolution: BandResolution
): (Band | null)[] {
  const memberCount = buckets.size ? (buckets.values().next().value as (number | null)[]).length : 0;
  if (memberCount < MIN_MEMBERS) return samples.map(() => null);

  const running = new Array<number>(memberCount).fill(0);
  /** The deterministic total at the last sample that has actually happened. */
  let base = 0;

  return samples.map((s) => {
    if (!s.future) {
      if (s.cumulative != null) base = s.cumulative;
      return null;
    }
    const bucket = buckets.get(bandKey(s.key, resolution));
    if (bucket) for (let m = 0; m < memberCount; m++) running[m]! += bucket[m] ?? 0;
    const totals = running.map((r) => base + r);
    const lo = percentile(totals, 10);
    const hi = percentile(totals, 90);
    return lo == null || hi == null
      ? null
      : { lo: round1(Math.max(0, lo)), hi: round1(Math.max(0, hi)) };
  });
}
