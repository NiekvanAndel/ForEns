/**
 * Parity: core/model/stats against index.html.
 */
import { describe, it, expect } from 'vitest';
import { loadOracle } from './oracle';
import { percentile, probAtLeast, normalCDFUpper, round1 } from '../core/model/stats';

const O = loadOracle(['pct', 'pge', 'normalCDFUpper', 'r1']);

/** Deterministic PRNG, so a failure is always reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Ensemble-shaped samples: 51 members, with the nulls the API really returns. */
function members(rand: () => number, n = 51, nullRate = 0.05): (number | null)[] {
  return Array.from({ length: n }, () => (rand() < nullRate ? null : rand() * 40 - 5));
}

describe('percentile', () => {
  it('matches pct() across random ensembles and percentiles', () => {
    const rand = rng(12345);
    for (let trial = 0; trial < 400; trial++) {
      const arr = members(rand, 1 + Math.floor(rand() * 60));
      for (const p of [0, 10, 25, 50, 75, 90, 100, 33.3]) {
        expect(percentile(arr, p)).toEqual(O.pct(arr, p));
      }
    }
  });

  it('matches on all-null and empty input', () => {
    expect(percentile([], 50)).toEqual(O.pct([], 50));
    expect(percentile([null, null], 50)).toEqual(O.pct([null, null], 50));
    expect(percentile([null, null], 50)).toBeNull();
  });

  it('matches on a single member', () => {
    expect(percentile([7], 10)).toEqual(O.pct([7], 10));
    expect(percentile([7], 90)).toEqual(O.pct([7], 90));
  });
});

describe('probAtLeast', () => {
  it('matches pge() across random ensembles and thresholds', () => {
    const rand = rng(999);
    for (let trial = 0; trial < 400; trial++) {
      const arr = members(rand);
      for (const t of [0, 0.1, 1, 5, 10, 25]) {
        expect(probAtLeast(arr, t)).toEqual(O.pge(arr, t));
      }
    }
  });

  it('matches on empty input', () => {
    expect(probAtLeast([], 1)).toEqual(O.pge([], 1));
    expect(probAtLeast([null], 1)).toEqual(O.pge([null], 1));
  });
});

describe('normalCDFUpper', () => {
  it('matches across the mean/spread/threshold grid', () => {
    const rand = rng(4242);
    for (let trial = 0; trial < 2000; trial++) {
      const mean = rand() * 30 - 5;
      const spread = rand() * 10;
      const threshold = rand() * 30 - 5;
      expect(normalCDFUpper(mean, spread, threshold)).toEqual(
        O.normalCDFUpper(mean, spread, threshold)
      );
    }
  });

  it('matches at the tails and with zero spread', () => {
    for (const [m, s, t] of [
      [0, 0, 0], [5, 0, 3], [3, 0, 5],
      [0, 1, 100], [0, 1, -100], [10, 2, 10],
    ] as const) {
      expect(normalCDFUpper(m, s, t)).toEqual(O.normalCDFUpper(m, s, t));
    }
  });
});

describe('round1', () => {
  it('matches r1() including the NaN case', () => {
    const rand = rng(7);
    for (let i = 0; i < 500; i++) {
      const v = rand() * 200 - 100;
      expect(round1(v)).toEqual(O.r1(v));
    }
    expect(round1(NaN)).toEqual(O.r1(NaN));
  });
});
