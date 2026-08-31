/**
 * Parity: core/model/dayValues against index.html's day-row source selection.
 *
 * The rule is inline in `renderDaily`, not a function, so it cannot be pulled
 * through the VM oracle. It is instead transcribed here once, verbatim from the
 * `overzicht`, `temp`, `vocht` and `wind` branches, and the port is checked against
 * that transcription across a wide grid of days. If the two ever diverge, one of
 * them was edited without the other.
 */
import { describe, it, expect } from 'vitest';
import { resolveDayValues, inRange } from '../core/model/dayValues';
import type { Day } from '../core/model/types';

/* ── The web app's rule, transcribed verbatim from index.html ─────────────── */

const htmlInRange = (val: any, lo: any, hi: any) =>
  val != null && lo != null && hi != null && val >= lo && val <= hi;

function htmlOverzicht(d: any, dayIdx: number) {
  const useWideBand = dayIdx < 7;
  const hasEns = d.ensLoaded ?? false;
  const useHarm = d.useHarm;
  const forceIfs = !useHarm && dayIdx <= 3;

  const useTMin = useHarm ? d.harmTempMin != null
    : (forceIfs || !hasEns || htmlInRange(d.hresTempMin, useWideBand ? d.tempMinP10 : d.tempMinP25, useWideBand ? d.tempMinP90 : d.tempMinP75));
  const useTMax = useHarm ? d.harmTempMax != null
    : (forceIfs || !hasEns || htmlInRange(d.hresTempMax, useWideBand ? d.tempMaxP10 : d.tempMaxP25, useWideBand ? d.tempMaxP90 : d.tempMaxP75));
  const usePrecip = useHarm ? d.harmPrecip != null
    : (forceIfs || !hasEns || htmlInRange(d.hresPrecip, useWideBand ? d.precipP10 : d.precipP25, useWideBand ? d.precipP90 : d.precipP75));
  const useWind = useHarm ? d.harmWindMax != null
    : (forceIfs || !hasEns || htmlInRange(d.hresWindMax, useWideBand ? d.windP10 : d.windP25, useWideBand ? d.windP90 : d.windP75));

  const tMin = useHarm ? (d.harmTempMin ?? d.hresTempMin ?? d.tempMinP50) : (useTMin ? d.hresTempMin : d.tempMinP50);
  const tMax = useHarm ? (d.harmTempMax ?? d.hresTempMax ?? d.tempMaxP50) : (useTMax ? d.hresTempMax : d.tempMaxP50);
  const precip = Number(useHarm ? (d.harmPrecip ?? 0) : (usePrecip && d.hresPrecip != null ? d.hresPrecip : d.precipMedian ?? 0));
  const wind = useHarm ? (d.harmWindMax ?? d.hresWindMax ?? d.windP50) : (useWind ? d.hresWindMax : d.windP50);

  return {
    tMin, tMax, precip, wind,
    useTMin, useTMax, usePrecip, useWind,
    windDir: d.hresWindDir ?? d.windDir,
    wmo: d.dayIcon ?? d.hresWmo ?? d.wmo,
    sun: d.sunHours,
  };
}

function htmlVocht(d: any, dayIdx: number) {
  const useWideBand = dayIdx < 7;
  const useHarm = d.useHarm;
  const forceIfs = !useHarm && dayIdx <= 3;
  const useRhMin = useHarm ? d.harmRhMin != null
    : (forceIfs ? d.hresRhMin != null : htmlInRange(d.hresRhMin, useWideBand ? d.humidityP10 : d.humidityP25, useWideBand ? d.humidityP90 : d.humidityP75));
  const useRhMax = useHarm ? d.harmRhMax != null
    : (forceIfs ? d.hresRhMax != null : htmlInRange(d.hresRhMax, useWideBand ? d.humidityP10 : d.humidityP25, useWideBand ? d.humidityP90 : d.humidityP75));
  const rhMin = useHarm ? (d.harmRhMin ?? d.humidityMedian ?? 0) : (useRhMin ? d.hresRhMin : d.humidityP10 ?? 0);
  const rhMax = useHarm ? (d.harmRhMax ?? d.humidityMedian ?? 100) : (useRhMax ? d.hresRhMax : d.humidityP90 ?? 100);
  return { rhMin, rhMax, useRhMin, useRhMax };
}

/* ── Fixtures ─────────────────────────────────────────────────────────────── */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function makeDay(rand: () => number, over: Partial<Day> = {}): Day {
  const tMinP50 = rand() * 12 + 2;
  const tMaxP50 = tMinP50 + rand() * 12 + 3;
  const spread = rand() * 6 + 1;
  const pMed = rand() < 0.4 ? 0 : rand() * 8;
  const wMed = rand() * 30 + 5;
  const hMed = rand() * 40 + 50;
  return {
    date: '2026-06-15', useHarm: false,
    precipP10: Math.max(0, pMed - spread), precipP25: Math.max(0, pMed - spread / 2),
    precipMedian: pMed, precipP75: pMed + spread / 2, precipP90: pMed + spread,
    pChance: rand() * 100, p5mm: rand() * 100, p20mm: rand() * 100,
    tempLo: tMinP50, tempHi: tMaxP50,
    tempMinP10: tMinP50 - spread, tempMinP25: tMinP50 - spread / 2, tempMinP50: tMinP50,
    tempMinP75: tMinP50 + spread / 2, tempMinP90: tMinP50 + spread,
    tempMaxP10: tMaxP50 - spread, tempMaxP25: tMaxP50 - spread / 2, tempMaxP50: tMaxP50,
    tempMaxP75: tMaxP50 + spread / 2, tempMaxP90: tMaxP50 + spread,
    windP10: Math.max(0, wMed - spread * 2), windP25: Math.max(0, wMed - spread),
    windP50: wMed, windP75: wMed + spread, windP90: wMed + spread * 2,
    humidityMedian: hMed,
    humidityP10: hMed - spread * 2, humidityP25: hMed - spread,
    humidityP75: hMed + spread, humidityP90: hMed + spread * 2,
    sunHours: rand() * 10, et0: rand() * 5, windDir: rand() * 360,
    sunModel: 'ecmwf', sunOpacity: 0.15, sunOpacityDerived: false, sun6Hourly: null,
    dayIcon: 3, wmo: 3, nMembers: 51, ensLoaded: true,
    // Deterministic values: sometimes inside the band, sometimes deliberately outside.
    hresTempMin: tMinP50 + (rand() - 0.5) * spread * 4,
    hresTempMax: tMaxP50 + (rand() - 0.5) * spread * 4,
    hresPrecip: Math.max(0, pMed + (rand() - 0.5) * spread * 4),
    hresWindMax: Math.max(0, wMed + (rand() - 0.5) * spread * 5),
    hresRhMin: hMed + (rand() - 0.5) * spread * 5,
    hresRhMax: hMed + (rand() - 0.5) * spread * 5,
    hresWindDir: rand() * 360,
    hresWmo: 61,
    harmTempMax: null, harmTempMin: null, harmPrecip: null, harmWindMax: null,
    harmRhMin: null, harmRhMax: null,
    ...over,
  } as Day;
}

/* ── Tests ────────────────────────────────────────────────────────────────── */

describe('resolveDayValues', () => {
  it('matches index.html across the whole forecast horizon', () => {
    const rand = rng(20260831);
    for (let trial = 0; trial < 400; trial++) {
      for (let dayIndex = 0; dayIndex < 14; dayIndex++) {
        const harmonie = dayIndex <= 1 && trial % 3 === 0;
        const day = makeDay(rand, {
          useHarm: harmonie,
          ensLoaded: trial % 7 !== 0,
          ...(harmonie
            ? {
                harmTempMin: trial % 5 === 0 ? null : rand() * 10 + 2,
                harmTempMax: trial % 5 === 0 ? null : rand() * 10 + 14,
                harmPrecip: trial % 4 === 0 ? null : rand() * 5,
                harmWindMax: trial % 6 === 0 ? null : rand() * 30,
                harmRhMin: trial % 5 === 0 ? null : rand() * 40 + 40,
                harmRhMax: trial % 5 === 0 ? null : rand() * 30 + 60,
              }
            : {}),
        });

        const expected = htmlOverzicht(day, dayIndex);
        const rh = htmlVocht(day, dayIndex);
        const actual = resolveDayValues(day, { dayIndex });
        const where = `trial ${trial}, day ${dayIndex}`;

        expect(actual.tempMin.value, `${where} tMin`).toEqual(expected.tMin ?? null);
        expect(actual.tempMax.value, `${where} tMax`).toEqual(expected.tMax ?? null);
        expect(actual.precip.value, `${where} precip`).toEqual(expected.precip);
        expect(actual.wind.value, `${where} wind`).toEqual(expected.wind ?? null);
        expect(actual.humidityMin.value, `${where} rhMin`).toEqual(rh.rhMin ?? null);
        expect(actual.humidityMax.value, `${where} rhMax`).toEqual(rh.rhMax ?? null);

        // The `~` flags must agree too: they are what tells a reader the
        // deterministic run was overruled.
        expect(actual.tempMin.direct, `${where} useTMin`).toBe(expected.useTMin);
        expect(actual.tempMax.direct, `${where} useTMax`).toBe(expected.useTMax);
        expect(actual.precip.direct, `${where} usePrecip`).toBe(expected.usePrecip);
        expect(actual.wind.direct, `${where} useWind`).toBe(expected.useWind);
        expect(actual.humidityMin.direct, `${where} useRhMin`).toBe(rh.useRhMin);
        expect(actual.humidityMax.direct, `${where} useRhMax`).toBe(rh.useRhMax);

        expect(actual.windDir, `${where} windDir`).toEqual(expected.windDir ?? null);
        expect(actual.wmo, `${where} wmo`).toEqual(expected.wmo ?? null);
        expect(actual.sunHours, `${where} sun`).toEqual(expected.sun ?? null);
      }
    }
  });

  it('substitutes the ensemble median when IFS falls outside the band', () => {
    const rand = rng(1);
    // An IFS maximum far above p90 must be overruled by the median.
    const day = makeDay(rand, { hresTempMax: 99, tempMaxP50: 21 });
    const r = resolveDayValues(day, { dayIndex: 8 });
    expect(r.tempMax.direct).toBe(false);
    expect(r.tempMax.value).toBe(21);
  });

  it('keeps IFS when it agrees with the ensemble', () => {
    const rand = rng(2);
    const day = makeDay(rand, { hresTempMax: 21, tempMaxP25: 19, tempMaxP75: 23, tempMaxP50: 20 });
    const r = resolveDayValues(day, { dayIndex: 8 });
    expect(r.tempMax.direct).toBe(true);
    expect(r.tempMax.value).toBe(21);
  });

  it('narrows the accepted band beyond day 7', () => {
    const rand = rng(3);
    // Inside p10–p90 but outside p25–p75: accepted early, overruled later.
    const day = makeDay(rand, {
      hresTempMax: 26, tempMaxP10: 20, tempMaxP25: 22,
      tempMaxP50: 23, tempMaxP75: 24, tempMaxP90: 28,
    });
    expect(resolveDayValues(day, { dayIndex: 5 }).tempMax.direct).toBe(true);
    expect(resolveDayValues(day, { dayIndex: 9 }).tempMax.direct).toBe(false);
    expect(resolveDayValues(day, { dayIndex: 9 }).tempMax.value).toBe(23);
  });

  it('uses IFS unconditionally on days 2 and 3, however far it strays', () => {
    const rand = rng(4);
    const day = makeDay(rand, { hresTempMax: 99 });
    for (const dayIndex of [2, 3]) {
      const r = resolveDayValues(day, { dayIndex });
      expect(r.tempMax.direct, `day ${dayIndex}`).toBe(true);
      expect(r.tempMax.value, `day ${dayIndex}`).toBe(99);
      expect(r.source).toBe('ifs');
    }
    // Day 4 no longer gets the exemption.
    expect(resolveDayValues(day, { dayIndex: 4 }).tempMax.direct).toBe(false);
  });

  it('prefers HARMONIE on days 0 and 1', () => {
    const rand = rng(5);
    const day = makeDay(rand, { useHarm: true, harmTempMax: 19, hresTempMax: 24 });
    const r = resolveDayValues(day, { dayIndex: 0 });
    expect(r.tempMax.value).toBe(19);
    expect(r.source).toBe('harmonie');
  });

  it('falls through when HARMONIE has no value for that day', () => {
    const rand = rng(6);
    const day = makeDay(rand, { useHarm: true, harmTempMax: null, hresTempMax: 24 });
    const r = resolveDayValues(day, { dayIndex: 0 });
    expect(r.tempMax.value).toBe(24);
    // Marked approximate, since HARMONIE was expected and absent.
    expect(r.tempMax.direct).toBe(false);
  });

  it('uses the deterministic run before the ensemble has loaded', () => {
    const rand = rng(7);
    const day = makeDay(rand, { ensLoaded: false, hresTempMax: 99 });
    const r = resolveDayValues(day, { dayIndex: 9 });
    expect(r.tempMax.direct).toBe(true);
    expect(r.tempMax.value).toBe(99);
  });
});

describe('inRange', () => {
  it('treats any missing bound as out of range', () => {
    expect(inRange(5, 0, 10)).toBe(true);
    expect(inRange(0, 0, 10)).toBe(true);
    expect(inRange(10, 0, 10)).toBe(true);
    expect(inRange(11, 0, 10)).toBe(false);
    expect(inRange(null, 0, 10)).toBe(false);
    expect(inRange(5, null, 10)).toBe(false);
    expect(inRange(5, 0, null)).toBe(false);
  });
});
