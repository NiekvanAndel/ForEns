/**
 * Alert derivation tests.
 *
 * index.html has no alert hero, so these define the behaviour rather than compare
 * against it. The cases that matter most are the negative ones: the design shows no
 * hero for a quiet location, and a hero that fires on nothing would be worse than
 * no hero at all.
 */
import { describe, it, expect } from 'vitest';
import { deriveAlert } from '../core/model/alert';
import { ALERT_PHRASES, alertPhrases } from '../core/i18n/alertStrings';
import { LANG_CODES } from '../core/i18n';
import type { ForecastModel, Hour } from '../core/model/types';
import type { NowcastProfile } from '../core/radar/types';

function hour(over: Partial<Hour> = {}): Hour {
  return {
    time: '2026-06-15T12:00', temp: 18, precip: 0, wind: 12, humidity: 60,
    wmo: 1, isDay: 1, isPast: false, gusts: 20, windDir: 180, sunMin: 40,
    ...over,
  };
}

function model(hours: Partial<Hour>[]): ForecastModel {
  return {
    pastHours: [], futureHours: hours.map(hour), allHours: [],
    nowHour: '2026-06-15T12:00', days: [], currentTemp: 18, currentWmo: 1,
    nMembers: 51, hresRunLabel: 'IFS 06z', hresHoursByDay: {},
  };
}

function profile(over: Partial<NowcastProfile> = {}): NowcastProfile {
  return {
    bars: [
      { offsetMin: 0, mmPerHour: 0, height: 4 },
      { offsetMin: 30, mmPerHour: 2, height: 27 },
      { offsetMin: 60, mmPerHour: 4, height: 53 },
      { offsetMin: 120, mmPerHour: 0, height: 4 },
    ],
    series: [],
    totalMm: 1.5, confidence: 80, startsInMin: 30, wet: true,
    ...over,
  };
}

const quiet = Array.from({ length: 12 }, () => ({}));

describe('deriveAlert', () => {
  it('shows no hero when nothing is happening', () => {
    expect(deriveAlert(model(quiet), null)).toBeNull();
  });

  it('shows no hero for a dry nowcast either', () => {
    const dry = profile({ wet: false, totalMm: 0, startsInMin: null });
    expect(deriveAlert(model(quiet), dry)).toBeNull();
  });

  it('returns null without a model', () => {
    expect(deriveAlert(null, profile())).toBeNull();
  });

  it('fires on wind with no precipitation at all', () => {
    // The design's Westkapelle case: a wind alert, nothing falling.
    const a = deriveAlert(model([{ gusts: 68 }, ...quiet]), null)!;
    expect(a.kind).toBe('wind');
    expect(a.severity).toBe('light');
    expect(a.headline).toContain('68');
  });

  it('escalates wind severity above the heavy threshold', () => {
    const a = deriveAlert(model([{ gusts: 80 }, ...quiet]), null)!;
    expect(a.kind).toBe('wind');
    expect(a.severity).toBe('heavy');
  });

  it('does not fire below the gust threshold', () => {
    expect(deriveAlert(model([{ gusts: 59 }, ...quiet]), null)).toBeNull();
  });

  it('puts storm ahead of wind when both qualify', () => {
    const a = deriveAlert(model([{ wmo: 95, gusts: 80 }, ...quiet]), null)!;
    expect(a.kind).toBe('storm');
    expect(a.severity).toBe('heavy');
  });

  it('fires on rain and prefers the nowcast total over the hourly model', () => {
    const a = deriveAlert(model(quiet), profile({ totalMm: 6.2, startsInMin: 45 }))!;
    expect(a.kind).toBe('rain');
    expect(a.severity).toBe('heavy');
    expect(a.sub).toContain('6,2 mm'); // comma decimal, per design rule 7
    expect(a.headline).toContain('45 minuten');
  });

  it('falls back to the hourly model when the nowcast is dry', () => {
    const wet = [{ precip: 2 }, { precip: 3 }, ...quiet];
    const a = deriveAlert(model(wet), profile({ wet: false, totalMm: 0, startsInMin: null }))!;
    expect(a.kind).toBe('rain');
  });

  it('phrases an imminent shower as "nu"', () => {
    const a = deriveAlert(model(quiet), profile({ totalMm: 2, startsInMin: 0 }))!;
    expect(a.headline).toContain('nu');
  });

  it('phrases a distant shower in hours', () => {
    const a = deriveAlert(model(quiet), profile({ totalMm: 2, startsInMin: 90 }))!;
    expect(a.headline).toContain('2 uur');
  });

  it('fires on fog, frost and heat when nothing louder applies', () => {
    expect(deriveAlert(model([{ wmo: 45 }, ...quiet]), null)!.kind).toBe('fog');
    expect(deriveAlert(model([{ temp: -3 }, ...quiet]), null)!.kind).toBe('frost');
    expect(deriveAlert(model([{ temp: 33 }, ...quiet]), null)!.kind).toBe('heat');
  });

  it('ranks rain above fog', () => {
    const a = deriveAlert(model([{ wmo: 45, precip: 3 }, ...quiet]), null)!;
    expect(a.kind).toBe('rain');
  });

  it('uses the nowcast bars, or a flat track when there is no profile', () => {
    const withProfile = deriveAlert(model([{ gusts: 70 }, ...quiet]), profile())!;
    expect(withProfile.bars).toEqual([4, 27, 53, 4]);
    const without = deriveAlert(model([{ gusts: 70 }, ...quiet]), null)!;
    expect(without.bars).toEqual([4, 4, 4, 4]);
  });

  it('only looks inside its window', () => {
    // A gale on hour 20 is outside the 12-hour window.
    const late = [...quiet, ...Array.from({ length: 10 }, () => ({ gusts: 90 }))];
    expect(deriveAlert(model(late), null)).toBeNull();
    expect(deriveAlert(model(late), null, { hoursAhead: 24 })!.kind).toBe('wind');
  });

  it('returns null for an empty forecast', () => {
    expect(deriveAlert(model([]), profile())).toBeNull();
  });
});

describe('alert wording', () => {
  const gale = [{ gusts: 90 }];
  const freezing = [{ temp: -3, gusts: 10 }];

  it('writes in the language the app is set to', () => {
    const nl = deriveAlert(model(gale), null, { lang: 'nl' })!;
    const en = deriveAlert(model(gale), null, { lang: 'en' })!;
    const de = deriveAlert(model(gale), null, { lang: 'de' })!;
    expect(nl.label).toBe('Wind');
    expect(nl.headline).toContain('Zware windstoten');
    expect(en.headline).toContain('Severe gusts');
    expect(de.headline).toContain('Schwere Böen');
    // The advice line travels with it: it is the half that says what to do.
    expect(en.sub).toContain('trees');
    expect(de.sub).toContain('Bäumen');
  });

  it('keeps Dutch when nothing is asked for', () => {
    // The widget writer and the background task both have preferences, but a caller
    // that has none must still get a sentence rather than an empty one.
    expect(deriveAlert(model(gale), null)!.headline).toContain('Zware windstoten');
  });

  it('converts the figures to the reader’s units', () => {
    const kmh = deriveAlert(model(gale), null, { lang: 'en' })!;
    const knots = deriveAlert(model(gale), null, { lang: 'en', windUnit: 'kn' })!;
    expect(kmh.headline).toContain('90 km/h');
    expect(knots.headline).toContain('49 kn');
    // "km/u" is the Dutch spelling and stays behind with the Dutch.
    expect(kmh.headline).not.toContain('km/u');
    expect(deriveAlert(model(gale), null, { lang: 'nl' })!.headline).toContain('km/u');
  });

  it('converts a temperature too', () => {
    const c = deriveAlert(model(freezing), null, { lang: 'en' })!;
    const f = deriveAlert(model(freezing), null, { lang: 'en', tempUnit: 'F' })!;
    expect(c.headline).toBe('Frost, down to -3 °C');
    expect(f.headline).toBe('Frost, down to 27 °F');
  });

  it('translates every kind, in every language', () => {
    // The point of the table: no kind may fall back to a Dutch literal because the
    // one branch nobody tested still had one.
    const cases: Record<string, Partial<import('../core/model/types').Hour>[]> = {
      storm: [{ wmo: 95 }],
      wind: [{ gusts: 70 }],
      fog: [{ wmo: 45 }],
      frost: [{ temp: -2 }],
      heat: [{ temp: 33 }],
    };
    for (const lang of LANG_CODES) {
      for (const [kind, hours] of Object.entries(cases)) {
        const a = deriveAlert(model(hours), null, { lang })!;
        expect(a, `${lang}/${kind}`).not.toBeNull();
        expect(a.kind, `${lang}/${kind}`).toBe(kind);
        for (const field of [a.label, a.headline, a.sub]) {
          expect(field.trim().length, `${lang}/${kind}`).toBeGreaterThan(0);
        }
      }
      // Rain comes from the nowcast rather than a weather code.
      const rain = deriveAlert(model([{}]), profile({ wet: true, totalMm: 6, startsInMin: 20 }), { lang })!;
      expect(rain.kind, `${lang}/rain`).toBe('rain');
      expect(rain.headline, `${lang}/rain`).toContain(alertPhrases(lang).inMinutes(20));
    }
  });

  it('agrees with its own count where a language declines', () => {
    for (const lang of LANG_CODES) {
      const p = alertPhrases(lang);
      // One hour and two hours are different words in four of the five, and a
      // placeholder table is exactly where that gets done once and forgotten.
      expect(p.inHours(1)).toContain('1');
      expect(p.inHours(3)).toContain('3');
      if (lang !== 'nl') expect(p.inHours(1)).not.toBe(p.inHours(3).replace('3', '1'));
    }
  });

  it('has a table for every language the app offers', () => {
    for (const lang of LANG_CODES) expect(ALERT_PHRASES[lang]).toBeDefined();
    // And an unknown one falls back rather than throwing: a stored preference
    // outlives the code that wrote it.
    expect(alertPhrases('xx' as never)).toBe(ALERT_PHRASES.nl);
  });
});
