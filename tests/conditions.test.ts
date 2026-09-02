/**
 * The sunny-period rule.
 *
 * A weather code names a period's most notable event, so an hour with one short
 * shower in it is "rain" — and was drawn as rain beside three quarters of an hour of
 * sunshine. Above the threshold the sun wins the icon. The rule is checked against
 * index.html's own `sunnyWmo`, since both apps have to draw the same hour the same
 * way.
 */
import { describe, it, expect } from 'vitest';
import { loadOracle } from './oracle';
import {
  sunnyWmo, sunnyHourWmo, SUNNY_FRACTION, HOUR_MIN, THREE_HOUR_MIN,
} from '../core/model/conditions';

describe('sunnyWmo', () => {
  it('gives the hour to the sun past three quarters of it', () => {
    // 46 minutes of an hour, which is what the client asked the threshold to be.
    expect(sunnyWmo(61, 46)).toBe(0);
    expect(sunnyWmo(95, 50)).toBe(0);
  });

  it('leaves the code alone at or below the threshold', () => {
    // Exactly 45 is not *more* than three quarters, so the shower still wins.
    expect(sunnyWmo(61, 45)).toBe(61);
    expect(sunnyWmo(61, 20)).toBe(61);
    expect(sunnyWmo(3, 0)).toBe(3);
  });

  it('needs three times the sunshine over a three-hour row', () => {
    // 2.25 h is the same three quarters, so 135 minutes is the boundary.
    expect(sunnyWmo(61, 136, THREE_HOUR_MIN)).toBe(0);
    expect(sunnyWmo(61, 135, THREE_HOUR_MIN)).toBe(61);
  });

  it('does nothing without a sunshine figure', () => {
    // The series has not landed, which must not turn every hour sunny.
    expect(sunnyWmo(61, null)).toBe(61);
    expect(sunnyWmo(61, undefined)).toBe(61);
  });

  it('reads an hour’s own resolution', () => {
    expect(sunnyHourWmo({ wmo: 61, sunMin: 50 })).toBe(0);
    // The same 50 minutes across three hours is a mostly grey afternoon.
    expect(sunnyHourWmo({ wmo: 61, sunMin: 50, is3h: true })).toBe(61);
  });

  it('matches index.html for every combination', () => {
    const O = loadOracle(['sunnyWmo'], { consts: ['SUNNY_FRACTION'] });
    for (const period of [HOUR_MIN, THREE_HOUR_MIN]) {
      for (let sun = 0; sun <= period; sun += 1) {
        expect(sunnyWmo(61, sun, period), `${sun}/${period}`).toBe(
          O.sunnyWmo(61, sun, period)
        );
      }
    }
    expect(SUNNY_FRACTION).toBe(0.75);
  });
});
