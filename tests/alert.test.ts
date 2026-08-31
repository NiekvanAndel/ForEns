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
    expect(deriveAlert(model(late), null, 24)!.kind).toBe('wind');
  });

  it('returns null for an empty forecast', () => {
    expect(deriveAlert(model([]), profile())).toBeNull();
  });
});
