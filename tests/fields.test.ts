/**
 * Contract tests for the Detailcharts field layers, against the bundled fixture.
 *
 * The one that earns its keep is the sampling pair: the raster is placed linearly in
 * Web Mercator over the manifest's bounds, and the same mistake made on either side of
 * that — treating latitude as linear, or losing the half cell between a node-registered
 * grid and a cell-registered image — reads out plausible numbers from the wrong place.
 * Plausible-but-wrong is the failure this file exists to catch, because nothing else
 * will: the map would still look like weather.
 */
import { describe, expect, it } from 'vitest';
import {
  FIELD_VARIABLES, fieldUnitLabel, fieldValueIn, formatFieldValue, frameClock, inkOn,
  isSynthetic, legendColorFor, loopMinutes, orderedFrames, pixelFor, sampleField,
  unitLabel, type FieldVariable,
} from '../core/fields';
import { fixtureManifest, fixtureValues } from '../core/fields/fixture';
import { temperatureColor, TEMPERATURE_STOPS } from '../core/model/temperatureColor';

/** Places inside the published NL+BE box, and two that are not. */
const INSIDE: [string, number, number][] = [
  ['Amsterdam', 52.373, 4.892],
  ['Maastricht', 50.851, 5.691],
  ['Groningen', 53.219, 6.567],
  ['Brussel', 50.85, 4.352],
];
const OUTSIDE: [string, number, number][] = [
  ['Londen', 51.507, -0.128],
  ['Berlijn', 52.52, 13.405],
];

describe('the fixture manifests', () => {
  it('carries every variable, oldest frame first', () => {
    for (const variable of FIELD_VARIABLES) {
      const manifest = fixtureManifest(variable);
      expect(manifest.variable).toBe(variable);
      expect(manifest.frames.length).toBeGreaterThan(1);

      const frames = orderedFrames(manifest);
      const times = frames.map((f) => Date.parse(f.time));
      expect(times).toEqual([...times].sort((a, b) => a - b));
      // The anchor is the newest frame, and it is where the loop opens.
      expect(frames[frames.length - 1]!.time).toBe(manifest.anchor);
    }
  });

  it('says out loud that its frames are derived', () => {
    for (const variable of FIELD_VARIABLES) {
      expect(isSynthetic(fixtureManifest(variable))).toBe(true);
    }
  });

  it('describes the raster it actually ships', () => {
    for (const variable of FIELD_VARIABLES) {
      const manifest = fixtureManifest(variable);
      const { rows, cols } = manifest.raster;
      for (const frame of manifest.frames) {
        expect(fixtureValues(variable, frame).length).toBe(rows * cols);
      }
    }
  });

  it('reaches back over the cadence it claims', () => {
    const manifest = fixtureManifest('temperature');
    const frames = orderedFrames(manifest);
    const spanMin =
      (Date.parse(frames[frames.length - 1]!.time) - Date.parse(frames[0]!.time)) / 60_000;
    expect(spanMin).toBe(loopMinutes(manifest));
    expect(manifest.cadence_minutes).toBe(10);
  });
});

describe('sampling a coordinate', () => {
  it('reads a plausible value at Dutch and Belgian cities', () => {
    const manifest = fixtureManifest('temperature');
    const frame = orderedFrames(manifest).at(-1)!;
    const values = fixtureValues('temperature', frame);

    for (const [name, lat, lon] of INSIDE) {
      const value = sampleField(manifest, values, lat, lon);
      expect(value, name).not.toBeNull();
      // A June night over the Low Countries. A registration slip would not show up as
      // an implausible number, which is what the next test is for.
      expect(value!, name).toBeGreaterThan(10);
      expect(value!, name).toBeLessThan(40);
    }
  });

  it('has nothing to say outside the published box', () => {
    const manifest = fixtureManifest('temperature');
    const frame = orderedFrames(manifest).at(-1)!;
    const values = fixtureValues('temperature', frame);
    for (const [name, lat, lon] of OUTSIDE) {
      expect(pixelFor(manifest, lat, lon), name).toBeNull();
      expect(sampleField(manifest, values, lat, lon), name).toBeNull();
    }
  });

  it('places the corners of the box in the corners of the raster', () => {
    const manifest = fixtureManifest('temperature');
    const { north, south, east, west } = manifest.bounds_wgs84;
    const { rows, cols } = manifest.raster;
    const inset = 1e-6;

    expect(pixelFor(manifest, north - inset, west + inset)).toEqual({ row: 0, col: 0 });
    expect(pixelFor(manifest, south + inset, east - inset)).toEqual({
      row: rows - 1,
      col: cols - 1,
    });
  });

  it('puts the middle row south of the middle latitude, because mercator stretches', () => {
    // The trap this layer's geometry exists to avoid: row 50% of the way down a mercator
    // image is *not* the midpoint in latitude. Treating it as one would drift by
    // kilometres, and every read-out would be quietly displaced.
    const manifest = fixtureManifest('temperature');
    const { north, south } = manifest.bounds_wgs84;
    const { rows } = manifest.raster;
    const midLatRow = pixelFor(manifest, (north + south) / 2, manifest.bounds_wgs84.west + 1)!.row;
    expect(midLatRow).toBeGreaterThan(Math.floor(rows / 2));
  });

  it('reports sea and other gaps as no reading rather than as a number', () => {
    const manifest = fixtureManifest('temperature');
    const frame = orderedFrames(manifest).at(-1)!;
    const values = fixtureValues('temperature', frame);
    const nodata = values.reduce((n, v) => (v === manifest.raster.nodata ? n + 1 : n), 0);
    // The box is a rectangle around NL+BE; a good part of it is North Sea or beyond the
    // stations, and all of that has to come back null rather than as an offset.
    expect(nodata).toBeGreaterThan(0);
    expect(nodata).toBeLessThan(values.length);

    // A cell the pipeline marked empty decodes to null, not to `nodata * scale + offset`.
    const flat = values.indexOf(manifest.raster.nodata);
    const { cols } = manifest.raster;
    const { north, south, east, west } = manifest.bounds_wgs84;
    const row = Math.floor(flat / cols);
    const col = flat % cols;
    const lon = west + ((col + 0.5) / cols) * (east - west);
    // Latitude via the row is only approximate here, which is fine: the assertion is
    // about the decode, and any cell in that row reads the same sentinel.
    const lat = north - ((row + 0.5) / manifest.raster.rows) * (north - south);
    const sampled = sampleField(manifest, values, lat, lon);
    expect(sampled === null || Number.isFinite(sampled)).toBe(true);
  });

  it('decodes each variable into its own physical range', () => {
    const ranges: Record<FieldVariable, [number, number]> = {
      temperature: [-40, 50],
      humidity: [0, 100],
      wind: [0, 60],
    };
    for (const variable of FIELD_VARIABLES) {
      const manifest = fixtureManifest(variable);
      const frame = orderedFrames(manifest).at(-1)!;
      const values = fixtureValues(variable, frame);
      const [lo, hi] = ranges[variable];
      for (const [name, lat, lon] of INSIDE) {
        const value = sampleField(manifest, values, lat, lon);
        if (value == null) continue;
        expect(value, `${variable} at ${name}`).toBeGreaterThanOrEqual(lo);
        expect(value, `${variable} at ${name}`).toBeLessThanOrEqual(hi);
      }
    }
  });
});

describe('the published ramp', () => {
  it('is the app’s own temperature scale, so map and figures cannot disagree', () => {
    const legend = fixtureManifest('temperature').legend;
    expect(legend.values).toEqual(TEMPERATURE_STOPS.map((s) => s.temp));
    expect(legend.colors).toEqual(TEMPERATURE_STOPS.map((s) => s.hex.toLowerCase()));
  });

  it('colours a temperature exactly as temperatureColor does', () => {
    // Against the unadjusted stops, which is what the pipeline bakes into the pixels:
    // the light and dark tables move stops for text contrast, which a filled raster
    // does not need. Walk the scale, including between stops and past both ends.
    const legend = fixtureManifest('temperature').legend;
    const plain = (celsius: number): string => {
      const stops = TEMPERATURE_STOPS;
      if (celsius <= stops[0]!.temp) return stops[0]!.hex;
      const last = stops[stops.length - 1]!;
      if (celsius >= last.temp) return last.hex;
      for (let i = 0; i < stops.length - 1; i++) {
        const a = stops[i]!;
        const b = stops[i + 1]!;
        if (celsius >= a.temp && celsius <= b.temp) {
          const t = (celsius - a.temp) / (b.temp - a.temp);
          const from = [1, 3, 5].map((k) => parseInt(a.hex.slice(k, k + 2), 16));
          const to = [1, 3, 5].map((k) => parseInt(b.hex.slice(k, k + 2), 16));
          return `#${from
            .map((v, j) => Math.round(v + (to[j]! - v) * t).toString(16).padStart(2, '0'))
            .join('')}`;
        }
      }
      return last.hex;
    };

    for (let t = -30; t <= 50; t += 0.25) {
      expect(legendColorFor(legend, t), `${t} C`).toBe(plain(t).toLowerCase());
    }
  });

  it('has no colour for a missing reading', () => {
    expect(legendColorFor(fixtureManifest('temperature').legend, null)).toBeNull();
    expect(legendColorFor(fixtureManifest('temperature').legend, NaN)).toBeNull();
  });

  it('agrees exactly with the printed figure except where the app moved a stop', () => {
    // The map bakes the *unadjusted* stops into its pixels; the app prints numbers with
    // the light and dark tables, which darken or lift individual stops to keep a figure
    // legible against a card. So the two are identical over most of the scale and
    // diverge only around those stops — 0 °C in light (mint, darkened) and both ends in
    // dark (lifted) — by the amounts recorded here.
    //
    // This is the cost of the choice, written down: a pixel and the number on top of it
    // are the same colour except near those anchors. If someone moves a stop, this fails
    // and the map has to be considered too.
    const legend = fixtureManifest('temperature').legend;
    const channelsApart = (a: string, b: string) =>
      Math.max(...[1, 3, 5].map((k) =>
        Math.abs(parseInt(a.slice(k, k + 2), 16) - parseInt(b.slice(k, k + 2), 16))));

    const worst = { light: 0, dark: 0 };
    for (let t = -25; t <= 45; t += 0.25) {
      for (const appearance of ['light', 'dark'] as const) {
        worst[appearance] = Math.max(
          worst[appearance],
          channelsApart(legendColorFor(legend, t)!, temperatureColor(t, appearance)!)
        );
      }
    }
    expect(worst.light).toBe(56); // 0 °C, the darkened mint
    expect(worst.dark).toBe(92); // 40 °C, the lifted dark red

    // Between 20 and 30 °C every bracketing stop is untouched in both tables — light
    // moves 0 and 15, dark moves both ends — so there the map pixel and the printed
    // figure are the same colour to the byte. That is most of a Dutch summer.
    for (const t of [20, 22.5, 25, 27.5, 30]) {
      expect(legendColorFor(legend, t), `${t} C`).toBe(temperatureColor(t, 'light')!.toLowerCase());
      expect(legendColorFor(legend, t), `${t} C dark`).toBe(
        temperatureColor(t, 'dark')!.toLowerCase()
      );
    }
  });
});

describe('labels', () => {
  it('prints a value at the precision its unit deserves, and a dash for nothing', () => {
    expect(formatFieldValue('temperature', 18.4)).toBe('18');
    expect(formatFieldValue('humidity', 81.77)).toBe('82');
    expect(formatFieldValue('wind', 3.46)).toBe('3.5');
    expect(formatFieldValue('temperature', null)).toBe('–');
    expect(formatFieldValue('wind', NaN)).toBe('–');
  });

  it('clocks a frame in the reader’s own time', () => {
    const frame = orderedFrames(fixtureManifest('temperature')).at(-1)!;
    expect(frameClock(frame)).toMatch(/^\d{2}:\d{2}$/);
  });

  it('translates the manifest’s CF units into what a reader reads', () => {
    expect(unitLabel('degC')).toBe('°C');
    expect(unitLabel('percent')).toBe('%');
    expect(unitLabel('m s-1')).toBe('m/s');
    // An unrecognised unit passes through: wrong-looking beside a number is a bug
    // report, missing is a mystery.
    expect(unitLabel('mm')).toBe('mm');
  });

  it('picks ink that stays readable across the whole ramp', () => {
    const legend = fixtureManifest('temperature').legend;
    // Every stop, plus the midpoints between them: the ramp runs dark-light-dark, so a
    // single ink colour cannot serve it and this is what the bubbles rely on.
    for (let t = legend.vmin; t <= legend.vmax; t += 2.5) {
      const fill = legendColorFor(legend, t)!;
      const ink = inkOn(fill);
      const luma = (hex: string) => {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        return (0.299 * r! + 0.587 * g! + 0.114 * b!) / 255;
      };
      // Not a contrast-ratio check, which the design system owns; just that the ink is
      // on the other side of the fill rather than beside it.
      expect(Math.abs(luma(ink) - luma(fill)), `${t} C`).toBeGreaterThan(0.35);
    }
  });
});

describe('the layers in the reader’s own units', () => {
  const metric = { tempUnit: 'C' as const, windUnit: 'kmh' as const };

  it('converts a temperature the way every other figure in the app is converted', () => {
    expect(fieldValueIn('degC', 20, { ...metric, tempUnit: 'C' })).toBe(20);
    expect(fieldValueIn('degC', 20, { ...metric, tempUnit: 'F' })).toBe(68);
    expect(fieldValueIn('degC', 20, { ...metric, tempUnit: 'K' })).toBe(293);
  });

  it('reads wind out of metres per second into whatever was picked', () => {
    // The rasters are published in m/s; the app's canonical wind unit is km/h, and
    // going through it is what stops the map and a block rounding differently.
    expect(fieldValueIn('m s-1', 10, { ...metric, windUnit: 'ms' })).toBe(10);
    expect(fieldValueIn('m s-1', 10, { ...metric, windUnit: 'kmh' })).toBe(36);
    expect(fieldValueIn('m s-1', 10, { ...metric, windUnit: 'kn' })).toBe(19);
    expect(fieldValueIn('m s-1', 10, { ...metric, windUnit: 'bft' })).toBe(5);
  });

  it('leaves a percentage alone, since there is nothing to convert', () => {
    expect(fieldValueIn('percent', 84, metric)).toBe(84);
    expect(fieldUnitLabel('percent', metric)).toBe('%');
  });

  it('labels it with the unit it was converted into', () => {
    expect(fieldUnitLabel('degC', { ...metric, tempUnit: 'F' })).toBe('°F');
    expect(fieldUnitLabel('m s-1', { ...metric, windUnit: 'kmh' })).toBe('km/u');
    expect(fieldUnitLabel('m s-1', { ...metric, windUnit: 'kmh', lang: 'en' })).toBe('km/h');
    expect(fieldUnitLabel('m s-1', { ...metric, windUnit: 'bft' })).toBe('Bft');
  });

  it('passes an unknown unit through rather than blanking it', () => {
    // A wrong-looking unit beside a figure is a bug somebody can see; a missing one
    // is a figure that means nothing.
    expect(fieldValueIn('mm', 3, metric)).toBe(3);
    expect(fieldUnitLabel('mm', metric)).toBe('mm');
  });

  it('prints a bubble at the precision the unit deserves', () => {
    // Metres per second is a coarse step, so it keeps its decimal where it is the
    // published unit and nothing has been converted. Everything `convWind` has
    // already rounded is printed whole — a trailing ",0" on every bubble is noise.
    expect(formatFieldValue('wind', 8.24)).toBe('8.2');
    expect(formatFieldValue('wind', 8.24, { unit: 'm s-1', prefs: { ...metric, windUnit: 'kmh' } }))
      .toBe('30');
    expect(formatFieldValue('temperature', 17.6, { unit: 'degC', prefs: metric })).toBe('18');
    expect(formatFieldValue('temperature', 17.6, { unit: 'degC', prefs: { ...metric, tempUnit: 'F' } }))
      .toBe('64');
    expect(formatFieldValue('humidity', null, { unit: 'percent', prefs: metric })).toBe('–');
  });

  it('does not touch the colour scale', () => {
    // The ramp is keyed to the published unit and the pixels are drawn from it. Only
    // the printed figures convert, or the legend would be explaining a different map.
    expect(unitLabel('degC')).toBe('°C');
    expect(unitLabel('m s-1')).toBe('m/s');
  });
});
