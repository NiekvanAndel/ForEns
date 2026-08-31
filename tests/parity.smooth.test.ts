/**
 * Parity: core/model/smooth against index.html's smoothPath.
 *
 * The chart curves are the one visual thing that can be checked exactly, since the
 * function emits an SVG path string — so it is compared character for character.
 */
import { describe, it, expect } from 'vitest';
import { loadOracle } from './oracle';
import { smoothPath, niceRange, scaleX, scaleY, type Point } from '../core/model/smooth';

const O = loadOracle(['smoothPath']);

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('smoothPath', () => {
  it('matches on a typical 24-hour series', () => {
    const rand = rng(4321);
    const pts: Point[] = Array.from({ length: 24 }, (_, i) => ({
      x: Math.round(i * 13),
      y: Math.round(rand() * 120),
    }));
    expect(smoothPath(pts)).toBe(O.smoothPath(pts));
  });

  it('matches across random series and tensions', () => {
    const rand = rng(99);
    for (let trial = 0; trial < 200; trial++) {
      const n = 2 + Math.floor(rand() * 40);
      const pts: Point[] = Array.from({ length: n }, (_, i) => ({
        x: Math.round(i * (1 + rand() * 20)),
        y: Math.round(rand() * 200 - 50),
      }));
      const t = trial % 4 === 0 ? null : rand();
      expect(smoothPath(pts, t), `trial ${trial}`).toBe(O.smoothPath(pts, t));
    }
  });

  it('matches on the degenerate cases', () => {
    expect(smoothPath([])).toBe(O.smoothPath([]));
    expect(smoothPath([{ x: 5, y: 9 }])).toBe(O.smoothPath([{ x: 5, y: 9 }]));
    // Coincident points make the segment-length weights divide by zero; both sides
    // must fall back to the same value rather than emitting NaN into the path.
    const dup: Point[] = [{ x: 3, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 3 }];
    expect(smoothPath(dup)).toBe(O.smoothPath(dup));
    expect(smoothPath(dup)).not.toContain('NaN');
  });

  it('matches a flat line, which is what a dry day looks like', () => {
    const flat: Point[] = Array.from({ length: 12 }, (_, i) => ({ x: i * 10, y: 60 }));
    expect(smoothPath(flat)).toBe(O.smoothPath(flat));
  });
});

describe('scaleX and scaleY', () => {
  it('spreads points across the width and inverts y for screen coordinates', () => {
    expect(scaleX(0, 5, 10, 100)).toBe(10);
    expect(scaleX(4, 5, 10, 100)).toBe(110);
    // A single point sits in the middle rather than dividing by zero.
    expect(scaleX(0, 1, 10, 100)).toBe(60);
    // The low end of the range is at the bottom of the plot.
    expect(scaleY(0, 0, 10, 0, 100)).toBe(100);
    expect(scaleY(10, 0, 10, 0, 100)).toBe(0);
    expect(scaleY(5, 0, 10, 0, 100)).toBe(50);
  });

  it('survives a zero-height range', () => {
    expect(Number.isFinite(scaleY(5, 5, 5, 0, 100))).toBe(true);
  });
});

describe('niceRange', () => {
  it('pads and rounds outward to readable bounds', () => {
    const r = niceRange(3.2, 17.4);
    expect(r.lo).toBeLessThanOrEqual(3.2);
    expect(r.hi).toBeGreaterThanOrEqual(17.4);
  });

  it('never returns a zero-width range', () => {
    const r = niceRange(7, 7);
    expect(r.hi).toBeGreaterThan(r.lo);
  });

  it('handles a non-finite input rather than emitting NaN bounds', () => {
    expect(niceRange(NaN, 10)).toEqual({ lo: 0, hi: 1 });
    expect(niceRange(0, Infinity)).toEqual({ lo: 0, hi: 1 });
  });

  it('does not leave floating-point residue in the bounds', () => {
    for (const [lo, hi] of [[0, 0.3], [-2.7, 4.1], [0, 1], [12.34, 98.76]] as const) {
      const r = niceRange(lo, hi);
      expect(String(r.lo)).not.toMatch(/\d{8,}/);
      expect(String(r.hi)).not.toMatch(/\d{8,}/);
    }
  });
});
