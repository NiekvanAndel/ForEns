/**
 * Parity: core/i18n/units and the translation accessors against index.html.
 *
 * The originals read the active unit from the PREFS global, so each case rebuilds
 * the oracle with PREFS pinned to the unit under test.
 */
import { describe, it, expect } from 'vitest';
import { loadOracle } from './oracle';
import {
  fmtTemp, fmtTempShort, tempUnitLabel, convTemp,
  convWind, fmtWind, windUnitLabel, fmtPressure, degToCompass, toBeaufort,
  type TempUnit, type WindUnit, type PresUnit,
} from '../core/i18n/units';
import { t, dayNames, wmoText, resolveLang } from '../core/i18n';
import { LANG, LANG_CODES } from '../core/i18n/strings';

const UNIT_FNS = [
  'fmtTemp', 'fmtTempShort', 'tempUnit', 'convTempVal',
  'convWindVal', 'fmtWind', 'windUnit', 'fmtPres', 'degToCompass',
] as const;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Values spanning the realistic range, plus the exact Beaufort boundaries. */
function tempSamples(): number[] {
  const rand = rng(11);
  const out = [-40, -17.8, -0.4, 0, 0.5, 15.49, 15.5, 37, 45];
  for (let i = 0; i < 300; i++) out.push(rand() * 80 - 40);
  return out;
}
function windSamples(): number[] {
  const rand = rng(22);
  const out: number[] = [];
  // Every Beaufort boundary, and either side of it, where rounding is most fragile.
  for (const b of [0, 1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118]) {
    out.push(b - 0.1, b, b + 0.1);
  }
  for (let i = 0; i < 300; i++) out.push(rand() * 160);
  return out;
}

describe('temperature units', () => {
  for (const unit of ['C', 'F', 'K'] as TempUnit[]) {
    it(`matches for ${unit}`, () => {
      const O = loadOracle(UNIT_FNS, { PREFS: { tempUnit: unit } });
      expect(tempUnitLabel(unit)).toEqual(O.tempUnit());
      for (const v of tempSamples()) {
        expect(fmtTemp(v, unit)).toEqual(O.fmtTemp(v));
        expect(fmtTempShort(v, unit)).toEqual(O.fmtTempShort(v));
        expect(convTemp(v, unit)).toEqual(O.convTempVal(v));
      }
      expect(fmtTemp(null, unit)).toEqual(O.fmtTemp(null));
      expect(fmtTempShort(null, unit)).toEqual(O.fmtTempShort(null));
      expect(convTemp(null, unit)).toEqual(O.convTempVal(null));
    });
  }
});

describe('wind units', () => {
  for (const unit of ['kmh', 'ms', 'kn', 'bft'] as WindUnit[]) {
    it(`matches for ${unit}`, () => {
      const O = loadOracle(UNIT_FNS, { PREFS: { windUnit: unit } });
      expect(windUnitLabel(unit)).toEqual(O.windUnit());
      for (const v of windSamples()) {
        expect(fmtWind(v, unit), `fmtWind(${v})`).toEqual(O.fmtWind(v));
        expect(convWind(v, unit), `convWind(${v})`).toEqual(O.convWindVal(v));
      }
      expect(fmtWind(null, unit)).toEqual(O.fmtWind(null));
      expect(convWind(null, unit)).toEqual(O.convWindVal(null));
    });
  }

  it('agrees with the oracle on every Beaufort boundary', () => {
    const O = loadOracle(UNIT_FNS, { PREFS: { windUnit: 'bft' } });
    for (const v of windSamples()) expect(toBeaufort(v)).toEqual(O.convWindVal(v));
  });
});

describe('pressure units', () => {
  for (const unit of ['hPa', 'mbar', 'inHg'] as PresUnit[]) {
    it(`matches for ${unit}`, () => {
      const O = loadOracle(UNIT_FNS, { PREFS: { presUnit: unit } });
      const rand = rng(33);
      for (let i = 0; i < 300; i++) {
        const v = 950 + rand() * 100;
        expect(fmtPressure(v, unit)).toEqual(O.fmtPres(v));
      }
      expect(fmtPressure(null, unit)).toEqual(O.fmtPres(null));
    });
  }
});

describe('degToCompass', () => {
  it('matches across the full circle', () => {
    const O = loadOracle(UNIT_FNS);
    for (let d = 0; d <= 360; d += 0.5) expect(degToCompass(d)).toEqual(O.degToCompass(d));
    expect(degToCompass(null)).toEqual(O.degToCompass(null));
  });
});

describe('translations', () => {
  it('keeps identical key sets across all five languages', () => {
    const base = Object.keys(LANG.nl).sort();
    for (const code of LANG_CODES) {
      expect(Object.keys(LANG[code]).sort(), `language ${code}`).toEqual(base);
    }
  });

  it('gives every language 7 day names and the same WMO codes', () => {
    const wmoKeys = Object.keys(LANG.nl.wmo).sort();
    for (const code of LANG_CODES) {
      expect(dayNames(code).length, `dayNames ${code}`).toBe(7);
      expect(Object.keys(LANG[code].wmo).sort(), `wmo ${code}`).toEqual(wmoKeys);
    }
  });

  it('matches index.html for every string key in every language', () => {
    const O = loadOracle(['t', 'tDays', 'tWmo'] as const, {
      PREFS: { lang: 'nl' }, objectConsts: ['LANG'],
    });
    // `t` reads PREFS.lang, so rebuild per language.
    for (const code of LANG_CODES) {
      const Ol = loadOracle(['t', 'tDays', 'tWmo'] as const, {
        PREFS: { lang: code }, objectConsts: ['LANG'],
      });
      for (const key of Object.keys(LANG.nl)) {
        if (typeof LANG.nl[key] !== 'string') continue;
        expect(t(key, code), `${code}.${key}`).toEqual(Ol.t(key));
      }
      expect(dayNames(code)).toEqual(Ol.tDays());
      for (const wmo of Object.keys(LANG.nl.wmo)) {
        expect(wmoText(+wmo, code), `${code}.wmo.${wmo}`).toEqual(Ol.tWmo(+wmo));
      }
      // An unknown code must fall back to the language's own "unknown" string.
      expect(wmoText(999, code)).toEqual(Ol.tWmo(999));
    }
    expect(O.t('settings')).toBe('Instellingen');
  });

  it('falls back to Dutch for an unknown key', () => {
    expect(t('nonexistent-key', 'en')).toBe('nonexistent-key');
  });
});

describe('resolveLang', () => {
  it('maps device locales onto supported languages', () => {
    expect(resolveLang('nl-NL')).toBe('nl');
    expect(resolveLang('de_DE')).toBe('de');
    expect(resolveLang('en-GB')).toBe('en');
    expect(resolveLang('pt-BR')).toBe('nl');
    expect(resolveLang(null)).toBe('nl');
    expect(resolveLang('')).toBe('nl');
  });
});
