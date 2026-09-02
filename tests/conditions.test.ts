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
  sunnyWmo, sunnyHourWmo, SUNNY_FRACTION, DRY_TRACE_MM, HOUR_MIN, THREE_HOUR_MIN,
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

  it('leaves a wet period alone however bright it was', () => {
    // A sunny hour you got wet in is a shower. The icon that leaves the rain out is
    // the one piece of information the reader needed.
    expect(sunnyWmo(80, 50, HOUR_MIN, 0.4)).toBe(80);
    expect(sunnyWmo(80, 59, HOUR_MIN, 12)).toBe(80);
    expect(sunnyWmo(80, 140, THREE_HOUR_MIN, 0.4)).toBe(80);
  });

  it('treats a trace as dry', () => {
    // Gauges and models both report hundredths that are not rain.
    expect(sunnyWmo(80, 50, HOUR_MIN, DRY_TRACE_MM)).toBe(0);
    expect(sunnyWmo(80, 50, HOUR_MIN, 0.06)).toBe(80);
    // No precipitation figure at all must not block the rule.
    expect(sunnyWmo(80, 50, HOUR_MIN, null)).toBe(0);
    expect(sunnyWmo(80, 50, HOUR_MIN, undefined)).toBe(0);
  });

  it('reads an hour’s own resolution', () => {
    expect(sunnyHourWmo({ wmo: 61, sunMin: 50 })).toBe(0);
    // The same 50 minutes across three hours is a mostly grey afternoon.
    expect(sunnyHourWmo({ wmo: 61, sunMin: 50, is3h: true })).toBe(61);
    // And its own precipitation, which the model carries on every hour.
    expect(sunnyHourWmo({ wmo: 61, sunMin: 50, precip: 0.8 })).toBe(61);
    expect(sunnyHourWmo({ wmo: 61, sunMin: 50, precip: 0 })).toBe(0);
  });

  it('matches index.html for every combination', () => {
    const O = loadOracle(['sunnyWmo'], { consts: ['SUNNY_FRACTION', 'DRY_TRACE_MM'] });
    for (const period of [HOUR_MIN, THREE_HOUR_MIN]) {
      for (let sun = 0; sun <= period; sun += 1) {
        for (const mm of [0, 0.04, 0.05, 0.06, 3]) {
          expect(sunnyWmo(61, sun, period, mm), `${sun}/${period} @ ${mm}mm`).toBe(
            O.sunnyWmo(61, sun, period, mm)
          );
        }
      }
    }
    expect(SUNNY_FRACTION).toBe(0.75);
  });
});
