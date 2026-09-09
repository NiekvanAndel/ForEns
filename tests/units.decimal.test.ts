/**
 * The finer rendering the conditions hero uses.
 *
 * `fmtTemp`, `convTemp` and friends are index.html's own and pinned by the parity
 * suite; these are the app's addition, so they are pinned here instead. The rule
 * they encode is one line long and easy to get subtly wrong: a tenth where the feed
 * sent one, a whole number where it did not, and never a trailing ",0".
 */
import { describe, it, expect } from 'vitest';
import {
  fmtDecimal, fmtTempValue, fmtWindValue, convTempExact, convWindExact,
} from '../core/i18n/units';

describe('fmtDecimal', () => {
  it('keeps a tenth the reading actually has', () => {
    expect(fmtDecimal(17.3)).toBe('17,3');
    expect(fmtDecimal(-2.4)).toBe('-2,4');
    expect(fmtDecimal(0.5)).toBe('0,5');
  });

  it('drops a tenth of nothing rather than printing "17,0"', () => {
    expect(fmtDecimal(17)).toBe('17');
    expect(fmtDecimal(17.02)).toBe('17');
    expect(fmtDecimal(0)).toBe('0');
    // Not "-0", which is a temperature nobody reports.
    expect(fmtDecimal(-0.02)).toBe('0');
  });

  it('rounds to the tenth rather than showing the feed\'s noise', () => {
    expect(fmtDecimal(17.26)).toBe('17,3');
    expect(fmtDecimal(63.14)).toBe('63,1');
  });

  it('has a dash for nothing at all', () => {
    expect(fmtDecimal(null)).toBe('—');
    expect(fmtDecimal(undefined)).toBe('—');
    expect(fmtDecimal(Number.NaN)).toBe('—');
  });
});

describe('fmtTempValue', () => {
  it('prints celsius as measured', () => {
    expect(fmtTempValue(17.3, 'C')).toBe('17,3');
    expect(fmtTempValue(17, 'C')).toBe('17');
    expect(fmtTempValue(null, 'C')).toBe('—');
  });

  it('converts before rounding, so the tenth is the converted one', () => {
    // 17,3 °C is 63,14 °F, not the 63 that rounding first would have given.
    expect(fmtTempValue(17.3, 'F')).toBe('63,1');
    expect(convTempExact(17.3, 'F')).toBeCloseTo(63.14, 5);
    expect(fmtTempValue(0, 'K')).toBe('273,2');
  });
});

describe('fmtWindValue', () => {
  it('prints km/h as reported', () => {
    expect(fmtWindValue(21.6, 'kmh')).toBe('21,6');
    expect(fmtWindValue(22, 'kmh')).toBe('22');
    expect(fmtWindValue(null, 'kmh')).toBe('—');
  });

  it('converts to the chosen unit first', () => {
    expect(fmtWindValue(21.6, 'ms')).toBe('6');
    expect(fmtWindValue(20, 'ms')).toBe('5,6');
    expect(fmtWindValue(20, 'kn')).toBe('10,8');
  });

  it('leaves beaufort a whole force, however fine the speed behind it', () => {
    expect(convWindExact(21.6, 'bft')).toBe(4);
    expect(fmtWindValue(21.6, 'bft')).toBe('4');
  });
});
