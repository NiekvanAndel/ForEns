/**
 * Radar timeline labelling.
 *
 * The frame list is not the evenly-spaced "nu / +1 uur / +2 uur" the design mocks
 * up — a real provider returns mostly past frames and a short forecast tail — so
 * the labels are derived, and that derivation is what these pin down.
 */
import { describe, it, expect } from 'vitest';
import { frameLabel } from '../core/radar/labels';
import type { RadarFrame } from '../core/radar';

const NOW = Date.UTC(2026, 7, 31, 12, 0, 0);
const frame = (offsetMin: number, forecast = false): RadarFrame => ({
  timeMs: NOW + offsetMin * 60000,
  forecast,
  id: `f${offsetMin}`,
});

describe('frameLabel', () => {
  it('calls the present "nu"', () => {
    expect(frameLabel(frame(0), NOW)).toBe('nu');
  });

  it('treats anything within five minutes as now', () => {
    // Radar frames land on a five-minute grid, so the newest observation is
    // usually a few minutes old and should still read as "nu".
    expect(frameLabel(frame(-5), NOW)).toBe('nu');
    expect(frameLabel(frame(-4), NOW)).toBe('nu');
    expect(frameLabel(frame(5), NOW)).toBe('nu');
  });

  it('labels past frames with a negative offset', () => {
    expect(frameLabel(frame(-30), NOW)).toBe('-30 min');
    expect(frameLabel(frame(-120), NOW)).toBe('-120 min');
  });

  it('labels forecast frames with a positive offset', () => {
    expect(frameLabel(frame(30, true), NOW)).toBe('+30 min');
    expect(frameLabel(frame(6, true), NOW)).toBe('+6 min');
  });

  it('rounds to the nearest minute', () => {
    expect(frameLabel({ timeMs: NOW + 29.6 * 60000, forecast: true, id: 'x' }, NOW)).toBe('+30 min');
  });

  it('survives a missing frame rather than throwing', () => {
    expect(frameLabel(undefined, NOW)).toBe('—');
  });
});
