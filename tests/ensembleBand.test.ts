import { describe, expect, it } from 'vitest';
import {
  bandKey, bandsForSamples, ensembleBands,
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
