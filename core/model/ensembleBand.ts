/**
 * The p10–p90 band the chart on 'Grafiek' draws behind its forecast.
 *
 * A forecast line is a single number per hour, and on its own it claims a precision
 * the model does not have. The 51 IFS members are what the app carries to say where
 * that claim is weak, and the day sheets already show them — this puts the same
 * spread on the page where a reader looks at a whole window rather than one day.
 *
 * ## Percentiles come last, always
 *
 * The members go in and the percentiles come out *at the resolution the chart draws*.
 * That order is the point of this module. A percentile cannot be aggregated after the
 * fact: the p10 of a day's rainfall is not the sum of its hours' p10s, because that
 * would be the total of a member that was the tenth-driest in every single hour, and
 * no such member exists. Summing per member first and taking the percentile of the
 * totals asks the question a reader is actually asking — how dry could this day
 * plausibly be — and gives a band that is narrower and true rather than wide and
 * invented.
 *
 * Temperature is the same story with a mean instead of a sum, and the same reasoning:
 * the coldest day is a member that ran cold all day, not the coldest hour of each.
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

export interface Band {
  lo: number;
  hi: number;
}

/** Fewer than this and there is no spread to speak of. See the note above. */
const MIN_MEMBERS = 2;

/**
 * The key a sample looks its band up under.
 *
 * At day resolution that is the day. At hour and minute resolution it is the hour:
 * the ensemble is hourly, so a ten-minute sample is answered by the hour it falls
 * inside — the same rule `buildSeries` uses for the deterministic model, which has
 * nothing to say about twenty past three either.
 */
export function bandKey(sampleKey: string, resolution: 'minute' | 'hour' | 'day'): string {
  return resolution === 'day' ? sampleKey.slice(0, 10) : `${sampleKey.slice(0, 14)}00`;
}

/**
 * One member's value for a bucket: the total for rainfall, the mean for temperature.
 *
 * A missing hour in a rainfall member is no rain, so it counts as zero; a missing
 * temperature is unknown and is left out of the mean rather than dragging it toward
 * freezing. Both rules are `parseDayEnsemble`'s, for the same reasons.
 */
function reduceBucket(field: BandField, values: readonly (number | null)[]): number | null {
  if (field === 'precip') {
    return values.reduce<number>((a, v) => a + (v ?? 0), 0);
  }
  const finite = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return finite.length ? finite.reduce((a, b) => a + b, 0) / finite.length : null;
}

/**
 * The band per bucket, keyed the way `bandKey` keys a sample.
 *
 * Empty where the response carried no ensemble — which is the honest answer, and the
 * one that makes the chart simply draw no band rather than a flat one.
 */
export function ensembleBands(
  members: EnsembleMembers,
  field: BandField,
  resolution: 'minute' | 'hour' | 'day'
): Map<string, Band> {
  const series = field === 'precip' ? members.precip : members.temp;
  if (series.length < MIN_MEMBERS) return new Map();

  // Bucket → member index → the hours of that bucket. Built once, so a month at day
  // resolution walks the members' rows once rather than once per day.
  const buckets = new Map<string, (number | null)[][]>();
  members.times.forEach((time, i) => {
    const key = resolution === 'day' ? time.slice(0, 10) : `${time.slice(0, 14)}00`;
    let rows = buckets.get(key);
    if (!rows) {
      rows = series.map(() => []);
      buckets.set(key, rows);
    }
    series.forEach((member, m) => rows![m]!.push(member[i] ?? null));
  });

  const out = new Map<string, Band>();
  for (const [key, rows] of buckets) {
    const perMember = rows
      .map((values) => reduceBucket(field, values))
      .filter((v): v is number => v != null);
    if (perMember.length < MIN_MEMBERS) continue;
    const lo = percentile(perMember, 10);
    const hi = percentile(perMember, 90);
    if (lo == null || hi == null) continue;
    // Rainfall cannot be negative, and a percentile of a set of sums never is — but
    // the clamp costs nothing and keeps a band off the wrong side of the axis.
    out.set(key, {
      lo: round1(field === 'precip' ? Math.max(0, lo) : lo),
      hi: round1(field === 'precip' ? Math.max(0, hi) : hi),
    });
  }
  return out;
}

/**
 * The band for each sample, in the samples' own order, for handing to the chart.
 *
 * Null where there is none, and null for anything that has already happened: a band
 * around a measurement would say the thermometer might have read something else.
 */
export function bandsForSamples(
  bands: Map<string, Band>,
  samples: readonly { key: string; future: boolean }[],
  resolution: 'minute' | 'hour' | 'day'
): (Band | null)[] {
  if (!bands.size) return samples.map(() => null);
  return samples.map((s) => (s.future ? bands.get(bandKey(s.key, resolution)) ?? null : null));
}
