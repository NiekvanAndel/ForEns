import { describe, expect, it } from 'vitest';
import { buildPastDays, mergePastHours, type PastHour } from '../core/model/pastDays';
import { parsePastHours } from '../core/sources/pastWeather';
import { resolveDayValues } from '../core/model/dayValues';
import { beamScale } from '../core/model/beam';
import type { MeasuredHour } from '../core/sources/agroexact';

const modelHour = (time: string, over: Partial<PastHour> = {}): PastHour => ({
  time, temp: 10, humidity: 70, precip: 0, wind: 12, windDir: 180,
  wmo: 3, sunMin: 0, et0: 0.1, measured: false, ...over,
});

const stationHour = (time: string, over: Partial<MeasuredHour> = {}): MeasuredHour => ({
  time, temp: 12, tempMin: null, tempMax: null,
  humidity: 65, humidityMin: null, humidityMax: null, dewpoint: 8,
  wind: 9, gusts: 18, windDir: 200, precip: 0, radiation: null, ...over,
});

describe('mergePastHours', () => {
  it('lets the station speak where it reported, per quantity', () => {
    const out = mergePastHours(
      [stationHour('2026-09-14T10:00', { temp: 18, precip: null })],
      [modelHour('2026-09-14T10:00', { temp: 15, precip: 2 })]
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.temp).toBe(18);
    // The station has no rain gauge reading for this hour, so the model answers —
    // the merge is per quantity, not per hour wholesale.
    expect(out[0]!.precip).toBe(2);
    expect(out[0]!.measured).toBe(true);
  });

  it('keeps the weather code and the sunshine the model’s, always', () => {
    // A weather station has no opinion about "overcast" and no radiometer calibrated
    // to sunshine minutes.
    const out = mergePastHours(
      [stationHour('2026-09-14T10:00')],
      [modelHour('2026-09-14T10:00', { wmo: 61, sunMin: 12 })]
    );
    expect(out[0]!.wmo).toBe(61);
    expect(out[0]!.sunMin).toBe(12);
  });

  it('falls back to the model for an hour the station missed entirely', () => {
    const out = mergePastHours(
      [stationHour('2026-09-14T10:00')],
      [modelHour('2026-09-14T10:00'), modelHour('2026-09-14T11:00', { temp: 16 })]
    );
    expect(out).toHaveLength(2);
    expect(out[1]!.temp).toBe(16);
    expect(out[1]!.measured).toBe(false);
  });

  it('does not call an hour measured where the station put no number on it', () => {
    const out = mergePastHours(
      [stationHour('2026-09-14T10:00', { temp: null, precip: 1 })],
      [modelHour('2026-09-14T10:00', { temp: 15 })]
    );
    expect(out[0]!.temp).toBe(15);
    expect(out[0]!.precip).toBe(1);
    expect(out[0]!.measured).toBe(false);
  });

  it('is in time order whatever order it was handed', () => {
    const out = mergePastHours(
      [],
      [modelHour('2026-09-14T11:00'), modelHour('2026-09-14T09:00')]
    );
    expect(out.map((h) => h.time)).toEqual(['2026-09-14T09:00', '2026-09-14T11:00']);
  });
});

describe('buildPastDays', () => {
  const dayOf = (hours: PastHour[], date = '2026-09-14') =>
    buildPastDays({ dates: [date], hours, lat: 52, offsetSec: 7200 })[0];

  it('aggregates a day the way a day row reads it', () => {
    const hours = [
      modelHour('2026-09-14T06:00', { temp: 8, humidity: 90, precip: 1.2, wind: 10, sunMin: 0 }),
      modelHour('2026-09-14T12:00', { temp: 19, humidity: 55, precip: 0, wind: 24, sunMin: 45 }),
      modelHour('2026-09-14T18:00', { temp: 14, humidity: 70, precip: 0.4, wind: 16, sunMin: 15 }),
    ];
    const day = dayOf(hours)!;
    const v = resolveDayValues(day, { dayIndex: 0 });
    expect(v.tempMin.value).toBe(8);
    expect(v.tempMax.value).toBe(19);
    expect(v.precip.value).toBe(1.6);
    // Wind is the day's strongest hour, not its average — that is what the row means.
    expect(v.wind.value).toBe(24);
    expect(v.humidityMin.value).toBe(55);
    expect(v.humidityMax.value).toBe(90);
    expect(day.sunHours).toBe(1);
  });

  it('reads the extremes as far as the hours’ own spread goes', () => {
    // The coldest minute was inside some hour's minimum, not at the lowest hourly
    // mean, so an hour that reports its own range widens the day's.
    const day = dayOf([
      modelHour('2026-09-14T06:00', { temp: 8, tempMin: 6, tempMax: 9 }),
      modelHour('2026-09-14T12:00', { temp: 19, tempMin: 17, tempMax: 22 }),
    ])!;
    const v = resolveDayValues(day, { dayIndex: 0 });
    expect(v.tempMin.value).toBe(6);
    expect(v.tempMax.value).toBe(22);
  });

  it('marks nothing as approximate: a day that happened is not resolved', () => {
    // Every figure is direct, so no row prints the `~` that means "the ensemble
    // overruled the deterministic run". There is no ensemble here to overrule it.
    const day = dayOf([modelHour('2026-09-14T12:00')])!;
    const v = resolveDayValues(day, { dayIndex: 0 });
    expect(v.tempMin.direct).toBe(true);
    expect(v.tempMax.direct).toBe(true);
    expect(v.precip.direct).toBe(true);
    expect(v.wind.direct).toBe(true);
    expect(day.ensLoaded).toBe(false);
  });

  it('is a past day, and says whether an instrument made it', () => {
    const modelled = dayOf([modelHour('2026-09-14T12:00')])!;
    expect(modelled.past).toBe(true);
    expect(modelled.pastMeasured).toBe(false);

    const measured = buildPastDays({
      dates: ['2026-09-14'],
      hours: mergePastHours(
        [stationHour('2026-09-14T12:00', { temp: 17 })],
        [modelHour('2026-09-14T12:00')]
      ),
      lat: 52,
      offsetSec: 7200,
    })[0]!;
    expect(measured.pastMeasured).toBe(true);
  });

  it('is not measured where only some of the day was', () => {
    // Half from an instrument and half from a model is not a measurement.
    const day = buildPastDays({
      dates: ['2026-09-14'],
      hours: mergePastHours(
        [stationHour('2026-09-14T12:00', { temp: 17 })],
        [modelHour('2026-09-14T12:00'), modelHour('2026-09-14T13:00')]
      ),
      lat: 52,
      offsetSec: 7200,
    })[0]!;
    expect(day.pastMeasured).toBe(false);
  });

  it('leaves out a date with nothing to say rather than drawing an empty row', () => {
    expect(
      buildPastDays({ dates: ['2026-09-13', '2026-09-14'], hours: [modelHour('2026-09-14T12:00')], lat: 52, offsetSec: 7200 })
    ).toHaveLength(1);
    expect(buildPastDays({ dates: ['2026-09-13'], hours: [], lat: 52, offsetSec: 7200 })).toEqual([]);
  });

  it('takes the day icon from the daylight hours only', () => {
    // Three hours of drizzle at night must not label a clear day as wet.
    const day = dayOf([
      modelHour('2026-09-14T01:00', { wmo: 61 }),
      modelHour('2026-09-14T02:00', { wmo: 61 }),
      modelHour('2026-09-14T03:00', { wmo: 61 }),
      modelHour('2026-09-14T13:00', { wmo: 0 }),
    ])!;
    expect(resolveDayValues(day, { dayIndex: 0 }).wmo).toBe(0);
  });

  it('sizes the shared scale, without ever drawing a band', () => {
    // The percentile fields carry the measured value so `beamScale` can see it. A
    // row of zeros there would drag a week's temperature axis down to freezing.
    const day = dayOf([modelHour('2026-09-14T12:00', { temp: 24 })])!;
    const scale = beamScale([day], 'temp');
    expect(scale.lo).toBe(22);
    expect(scale.hi).toBe(26);
  });
});

describe('parsePastHours', () => {
  it('reads the fields the rows need, and converts the sunshine', () => {
    const out = parsePastHours({
      hourly: {
        time: ['2026-09-14T10:00'],
        temperature_2m: [15],
        relativehumidity_2m: [72],
        precipitation: [0.4],
        windspeed_10m: [18],
        winddirection_10m: [210],
        weather_code: [61],
        // Open-Meteo reports seconds; the day builder works in minutes.
        sunshine_duration: [1800],
        et0_fao_evapotranspiration: [0.12],
      },
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      time: '2026-09-14T10:00', temp: 15, humidity: 72, precip: 0.4,
      wind: 18, windDir: 210, wmo: 61, sunMin: 30, measured: false,
    });
  });

  it('is empty rather than wrong when there is no response', () => {
    expect(parsePastHours(null)).toEqual([]);
    expect(parsePastHours({})).toEqual([]);
    expect(parsePastHours({ hourly: { time: [] } })).toEqual([]);
  });
});
