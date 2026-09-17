/**
 * The soil blocks on 'Actueel'.
 *
 * Mostly these pin what is *absent*: a block for a quantity the sensor does not carry,
 * a grid of dashes for a sensor that is out of the ground, a green dot on something
 * derived. Those are the mistakes that read as working software.
 */
import { describe, it, expect } from 'vitest';
import { soilTiles, placementContext, type SoilTileLabels } from '../core/model/soilTiles';
import type { Placement } from '../core/model/soil';
import type { SoilSample } from '../core/sources/agroexact';

const HEESCH: Placement = {
  stationId: 's1', placementId: 'p1', lat: 51.73, lon: 5.53,
  from: '2026-04-01T00:00:00Z', to: null,
  crop: 'Aardappel', soil: 'matig zware klei', depthCm: 30,
  thresholds: { scarce: 25, irrigate: 45, critical: 60 },
};

const L: SoilTileLabels = {
  tension: 'Zuigspanning', status: 'Vochtstatus', refillRoom: 'Bijvulruimte',
  refillNeeded: 'Bij te vullen', waterPercent: 'Waterpercentage', pF: 'pF',
  soilTemp: 'Bodemtemperatuur', temp10: 'Temperatuur 10 cm',
  humidity10: 'Luchtvochtigheid 10 cm', dewpoint10: 'Dauwpunt 10 cm',
  now: 'nu', atDepth: '30 cm',
};

function sample(over: Partial<SoilSample> = {}): SoilSample {
  return {
    time: '2026-07-01T11:00', measTime: '2026-07-01T11:00:00Z',
    tension: 48, status: 2, pF: 2.35, waterPercent: 23.8,
    refillMm: 33, refillToScarceMm: 18, soilTemp: 16.4,
    temp10: null, humidity10: null, dewpoint10: null,
    leafWetProxy: null, precip: 0.6,
    ...over,
  };
}

const clock = new Date('2026-07-01T11:30:00Z');
const byId = (tiles: { id: string }[]) => tiles.map((t) => t.id);

describe('soil tiles', () => {
  it('builds a block per quantity the sensor actually reports', () => {
    const tiles = soilTiles(HEESCH, sample(), L, clock);
    expect(byId(tiles)).toEqual([
      'soil-tension', 'soil-status', 'soil-refill-room', 'soil-refill-needed',
      'soil-water-percent', 'soil-pf', 'soil-soil-temp',
    ]);
    // Every one of them is an instrument reporting.
    expect(tiles.every((t) => t.measured)).toBe(true);
    expect(tiles.find((t) => t.id === 'soil-tension')).toMatchObject({
      value: 48, kind: 'kpa', timeLabel: '30 cm',
    });
  });

  it('leaves out the canopy blocks on a sensor without a canopy probe', () => {
    // A block reading "—" would claim there is a probe at 10 cm that is silent.
    const plain = byId(soilTiles(HEESCH, sample(), L, clock));
    expect(plain).not.toContain('soil-temp-10');
    expect(plain).not.toContain('soil-humidity-10');

    const crop = byId(soilTiles(
      HEESCH, sample({ temp10: 19.3, humidity10: 96, dewpoint10: 18.6 }), L, clock
    ));
    expect(crop).toContain('soil-temp-10');
    expect(crop).toContain('soil-humidity-10');
    expect(crop).toContain('soil-dewpoint-10');
  });

  it('shows the figure to top up from suboptimal onward, not only at irrigate', () => {
    // The badge only names an amount once the field is at "irrigate now" — that is a
    // recommendation. A block on a grid of figures is a figure.
    expect(byId(soilTiles(HEESCH, sample({ status: 1 }), L, clock)))
      .toContain('soil-refill-needed');
    expect(byId(soilTiles(HEESCH, sample({ status: 0 }), L, clock)))
      .not.toContain('soil-refill-needed');
  });

  it('takes the blocks off the page when the sensor is out of the ground', () => {
    const autumn = new Date('2026-11-01T12:00:00Z');
    expect(soilTiles(HEESCH, sample({ measTime: '2026-10-01T11:00:00Z' }), L, autumn)).toEqual([]);
    // No reading at all is the same answer, and for the same reason: a grid of
    // dashes says a sensor is there and silent, which is the more alarming claim.
    expect(soilTiles(HEESCH, null, L, clock)).toEqual([]);
  });

  it('has no leaf-wetness block, because it is neither served nor measured', () => {
    const tiles = byId(soilTiles(HEESCH, sample({ leafWetProxy: true }), L, clock));
    expect(tiles.some((id) => id.includes('leaf'))).toBe(false);
  });

  it('names the crop, the soil and the depth, and skips what it does not know', () => {
    expect(placementContext(HEESCH, 'sensor op 30 cm'))
      .toBe('Aardappel · matig zware klei · sensor op 30 cm');
    // The soil type is not served by `/soilstations/` yet, and an invented one is the
    // worst of the three to be wrong about.
    expect(placementContext({ ...HEESCH, soil: null }, 'sensor op 30 cm'))
      .toBe('Aardappel · sensor op 30 cm');
  });
});
