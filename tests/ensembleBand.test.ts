import { describe, expect, it } from 'vitest';
import {
  bandKey, bandsForSamples, bandsFrom, cumulativeBands, ensembleBands, memberBuckets,
} from '../core/model/ensembleBand';
import { parseEnsembleRange } from '../core/sources/ensembleRange';
import type { EnsembleMembers } from '../core/sources/ensembleRange';

const members = (
  times: string[],
  temp: (number | null)[][],
  precip: (number | null)[][]
): EnsembleMembers => ({ times, temp, precip });

describe('bandKey', () => {
  it('is the day at day resolution and the hour otherwise', () => {
    expect(bandKey('2026-09-17T14:30', 'day')).toBe('2026-09-17');
    expect(bandKey('2026-09-17T14:00', 'hour')).toBe('2026-09-17T14:00');
    // A ten-minute sample is answered by the hour it falls inside: the ensemble is
    // hourly and has nothing to say about twenty past three in particular.
    expect(bandKey('2026-09-17T14:20', 'minute')).toBe('2026-09-17T14:00');
  });
});

describe('ensembleBands', () => {
  const times = ['2026-09-17T00:00', '2026-09-17T01:00'];

  it('needs more than one member', () => {
    // Open-Meteo answers a request it cannot serve with the plain deterministic
    // series, which arrives as a single row. A band from one member is a line.
    const one = members(times, [[10, 12]], [[0, 0]]);
    expect(ensembleBands(one, 'temp', 'hour').size).toBe(0);
    expect(ensembleBands(members(times, [], []), 'temp', 'hour').size).toBe(0);
  });

  it('takes the percentiles across members, per hour', () => {
    const m = members(times, [[10, 10], [0, 0], [5, 5]], []);
    const bands = ensembleBands(m, 'temp', 'hour');
    expect(bands.get('2026-09-17T00:00')).toEqual({ lo: 1, hi: 9 });
    expect(bands.get('2026-09-17T01:00')).toEqual({ lo: 1, hi: 9 });
  });

  it('sums each member before taking a day percentile, not the other way round', () => {
    // The property the whole module exists for. Three members that each deliver
    // 10 mm over the day, disagreeing only about which hour it falls in: the day's
    // p10 and p90 are both 10, because every member brought 10.
    //
    // Aggregating percentiles instead would give 1 + 1 = 2 to 9 + 9 = 18 — a band
    // describing a member that was the driest hour after hour, which is nobody.
    const m = members(times, [], [[10, 0], [0, 10], [5, 5]]);
    expect(ensembleBands(m, 'precip', 'day').get('2026-09-17')).toEqual({ lo: 10, hi: 10 });
    expect(ensembleBands(m, 'precip', 'hour').get('2026-09-17T00:00')).toEqual({ lo: 1, hi: 9 });
  });

  it('averages each member before taking a day percentile for temperature', () => {
    const m = members(times, [[10, 20], [0, 0], [30, 30]], []);
    expect(ensembleBands(m, 'temp', 'day').get('2026-09-17')).toEqual({ lo: 3, hi: 27 });
  });

  it('reads a missing hour as no rain, and as no reading for temperature', () => {
    // A rainfall member with a gap did not rain; a temperature member with a gap is
    // simply unknown, and counting it as zero would drag the band toward freezing.
    const rain = members(times, [], [[4, null], [4, null], [4, null]]);
    expect(ensembleBands(rain, 'precip', 'day').get('2026-09-17')).toEqual({ lo: 4, hi: 4 });

    const temp = members(times, [[20, null], [20, null], [20, null]], []);
    expect(ensembleBands(temp, 'temp', 'day').get('2026-09-17')).toEqual({ lo: 20, hi: 20 });
  });

  it('never puts a rainfall band below zero', () => {
    const m = members(times, [], [[0, 0], [0, 0], [1, 0]]);
    const band = ensembleBands(m, 'precip', 'day').get('2026-09-17');
    expect(band!.lo).toBeGreaterThanOrEqual(0);
  });
});

describe('bandsForSamples', () => {
  const times = ['2026-09-17T00:00', '2026-09-17T01:00'];
  const bands = ensembleBands(members(times, [[10, 10], [0, 0], [5, 5]], []), 'temp', 'hour');

  it('leaves everything already measured without one', () => {
    // A band around a measurement would say the thermometer might have read
    // something else.
    const out = bandsForSamples(
      bands,
      [
        { key: '2026-09-17T00:00', future: false },
        { key: '2026-09-17T01:00', future: true },
      ],
      'hour'
    );
    expect(out[0]).toBeNull();
    expect(out[1]).toEqual({ lo: 1, hi: 9 });
  });

  it('is exactly as long as the samples, whatever it found', () => {
    // The chart indexes it by sample, so a short array would band the wrong hours.
    const samples = times.concat('2026-09-18T00:00').map((key) => ({ key, future: true }));
    expect(bandsForSamples(bands, samples, 'hour')).toHaveLength(3);
    expect(bandsForSamples(new Map(), samples, 'hour')).toEqual([null, null, null]);
  });

  it('answers a ten-minute sample from its hour', () => {
    const out = bandsForSamples(bands, [{ key: '2026-09-17T01:40', future: true }], 'minute');
    expect(out[0]).toEqual({ lo: 1, hi: 9 });
  });
});

describe('parseEnsembleRange', () => {
  it('collects the member columns for both fields', () => {
    const out = parseEnsembleRange({
      hourly: {
        time: ['2026-09-17T00:00'],
        temperature_2m_member01: [10],
        temperature_2m_member02: [12],
        precipitation_member01: [0],
        precipitation_member02: [1],
      },
    });
    expect(out.times).toEqual(['2026-09-17T00:00']);
    expect(out.temp).toEqual([[10], [12]]);
    expect(out.precip).toEqual([[0], [1]]);
  });

  it('is empty rather than wrong when there is no response', () => {
    expect(parseEnsembleRange(null).times).toEqual([]);
    expect(parseEnsembleRange({}).times).toEqual([]);
    expect(parseEnsembleRange({ hourly: { time: [] } }).times).toEqual([]);
  });
});

describe('ensembleBands by statistic', () => {
  // Two days of three members, so a daily min and a daily max are different numbers
  // from a daily mean and from each other.
  const times = [
    '2026-09-17T00:00', '2026-09-17T12:00',
    '2026-09-18T00:00', '2026-09-18T12:00',
  ];
  const m = members(
    times,
    [
      [0, 20, 0, 20],   // cold night, warm afternoon
      [5, 15, 5, 15],   // flat
      [-5, 25, -5, 25], // the extreme member
    ],
    []
  );

  it('bands the day mean by default', () => {
    // Means are 10, 10, 10: the members agree about the average and disagree about
    // the day, which is exactly why the mean is the wrong thing to band per day.
    expect(ensembleBands(m, 'temp', 'day').get('2026-09-17')).toEqual({ lo: 10, hi: 10 });
  });

  it("bands each member's own coldest and warmest hour", () => {
    const mins = bandsFrom(memberBuckets(m, 'temp', 'day', 'min'));
    const maxes = bandsFrom(memberBuckets(m, 'temp', 'day', 'max'));
    // Minima across members are -5, 0, 5; maxima are 15, 20, 25.
    expect(mins.get('2026-09-17')).toEqual({ lo: -4, hi: 4 });
    expect(maxes.get('2026-09-17')).toEqual({ lo: 16, hi: 24 });
    // And they are not the mean's band, which is the whole reason for the parameter.
    expect(mins.get('2026-09-17')).not.toEqual(ensembleBands(m, 'temp', 'day').get('2026-09-17'));
  });

  it('is the same number at every statistic when a bucket is one hour', () => {
    const hourly = ensembleBands(m, 'temp', 'hour');
    for (const stat of ['min', 'max', 'mean'] as const) {
      expect(bandsFrom(memberBuckets(m, 'temp', 'hour', stat)).get('2026-09-17T00:00'))
        .toEqual(hourly.get('2026-09-17T00:00'));
    }
  });
});

describe('cumulativeBands', () => {
  const times = ['2026-09-17T00:00', '2026-09-17T01:00', '2026-09-17T02:00'];
  // Three members over three hours. Totals after each hour:
  //   A 1, 3, 6   B 0, 0, 0   C 2, 4, 6
  const buckets = memberBuckets(
    members(times, [], [[1, 2, 3], [0, 0, 0], [2, 2, 2]]),
    'precip',
    'hour'
  );
  const sample = (key: string, future: boolean, cumulative: number | null = null) =>
    ({ key, future, cumulative });

  it('opens from what has already fallen, not from zero', () => {
    // The first hour has happened and the gauge says 4 mm. Every member carries on
    // from there, so the band at the second hour is 4 + each member's second hour.
    const out = cumulativeBands(
      buckets,
      [
        sample(times[0]!, false, 4),
        sample(times[1]!, true),
        sample(times[2]!, true),
      ],
      'hour'
    );
    expect(out[0]).toBeNull();
    // Running totals from hour two: A 2, B 0, C 2 → p10 0.4, p90 2.
    expect(out[1]).toEqual({ lo: 4.4, hi: 6 });
    // And after hour three: A 5, B 0, C 4 → p10 0.8, p90 4.8.
    expect(out[2]).toEqual({ lo: 4.8, hi: 8.8 });
  });

  it('starts at zero where the whole window is still ahead', () => {
    const out = cumulativeBands(buckets, times.map((t) => sample(t, true)), 'hour');
    expect(out[0]).toEqual({ lo: 0.2, hi: 1.8 });
    // Never shrinks: a running total cannot go down, and neither can its band.
    expect(out[2]!.hi).toBeGreaterThanOrEqual(out[1]!.hi);
    expect(out[2]!.lo).toBeGreaterThanOrEqual(out[1]!.lo);
  });

  it('carries the totals across a bucket the members do not cover', () => {
    // An unknown hour did not undo the rain before it, exactly as `withCumulative`
    // holds the deterministic line's level across a gap.
    const out = cumulativeBands(
      buckets,
      [sample(times[0]!, true), sample('2026-09-17T09:00', true)],
      'hour'
    );
    expect(out[1]).toEqual(out[0]);
  });

  it('gives nothing at all without an ensemble', () => {
    expect(cumulativeBands(new Map(), [sample(times[0]!, true)], 'hour')).toEqual([null]);
  });
});
