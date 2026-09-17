/**
 * Soil sensor tests.
 *
 * Two kinds of pin here. The unit conversions are the point of the exercise — refill
 * room is a volume percent that only becomes millimetres over the sensor depth, and
 * an hourly row is stamped at the end of the hour it covers — and both are the sort of
 * mistake that produces a plausible chart nobody can tell is wrong.
 *
 * The rest pins decisions: thresholds that are allowed to sit on top of each other,
 * a stored status that beats a recomputed one, and a series that stops being one line
 * when the sensor changes fields.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  fetchSoilStations, fetchSoilRange, fetchSoilReadings, fetchLatestSoilMeasurement,
} from '../core/sources/agroexact';
import {
  DORMANT_AFTER_MS, currentPlacement, isDormant, placementAt, placementFromStation,
  refillMm, segmentByPlacement, statusFromTension, waterPercent,
  type Placement, type SoilThresholds,
} from '../core/model/soil';

/** Build a fetch stand-in that answers every url with one body. */
function mockFetch(body: unknown) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  }) as unknown as Response) as unknown as typeof fetch;
}

/** Heesch, as sheet 3 uses it: potato on clay, 25 / 45 / 60 kPa. */
const HEESCH: SoilThresholds = { scarce: 25, irrigate: 45, critical: 60 };

describe('soil thresholds and status', () => {
  it('puts a reading in the band its thresholds say, counting a threshold as crossed', () => {
    expect(statusFromTension(12, HEESCH)).toBe(0);
    expect(statusFromTension(30, HEESCH)).toBe(1);
    expect(statusFromTension(48, HEESCH)).toBe(2);
    expect(statusFromTension(80, HEESCH)).toBe(3);
    // Exactly on a threshold is across it — the transition alerts already read it
    // that way, and two answers would be an alert the app disagrees with.
    expect(statusFromTension(45, HEESCH)).toBe(2);
    expect(statusFromTension(25, HEESCH)).toBe(1);
    expect(statusFromTension(null, HEESCH)).toBeNull();
  });

  it('skips a collapsed band rather than rejecting it', () => {
    // 238 of the account's 1181 sensors are configured this way: no suboptimal band,
    // straight from fine to irrigate.
    const flat: SoilThresholds = { scarce: 19.9, irrigate: 19.9, critical: 25 };
    expect(statusFromTension(10, flat)).toBe(0);
    expect(statusFromTension(19.9, flat)).toBe(2);
    expect(statusFromTension(25, flat)).toBe(3);
  });

  it('keeps a sensor whose thresholds sit on top of each other, drops an inverted set', async () => {
    const f = mockFetch([
      { station_id: 'a', name: 'Perceel Noord', latitude: '51.56', longitude: '3.82',
        version_type: 'PRO', crop: 'Aardappel', placement_depth: 30,
        threshold_0_to_1: 25, threshold_1_to_2: 45, threshold_2_to_3: 60 },
      { station_id: 'b', name: 'Demoveld', latitude: '51.34', longitude: '5.33',
        version_type: 'BASIC', crop: 'Ui', placement_depth: 20,
        threshold_0_to_1: 19.9, threshold_1_to_2: 19.9, threshold_2_to_3: 25 },
      { station_id: 'c', name: 'Omgekeerd', latitude: '51.1', longitude: '5.1',
        version_type: 'BASIC', crop: 'Gras', placement_depth: 25,
        threshold_0_to_1: 60, threshold_1_to_2: 45, threshold_2_to_3: 25 },
      { station_id: 'd', name: 'Geen positie', latitude: null, longitude: null,
        version_type: 'PRO', crop: 'Ui', placement_depth: 20 },
    ]);
    const stations = await fetchSoilStations('t', { fetchImpl: f });

    // The one without coordinates cannot become a location; the rest all stay.
    expect(stations.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(stations[1]!.thresholds).toEqual({ scarce: 19.9, irrigate: 19.9, critical: 25 });
    // An inverted set is not a configuration, it is a broken one: no threshold line.
    // The sensor itself stays — it still measures suction.
    expect(stations[2]!.thresholds).toBeNull();
    expect(stations[0]!.depthCm).toBe(30);
    expect(stations[0]!.crop).toBe('Aardappel');
  });
});

describe('the two unit traps', () => {
  it('spreads refill room over the sensor depth to get millimetres', () => {
    // 11 vol-% over 30 cm is 33 mm — showing the API's number raw would say 11.
    expect(refillMm(11, 30)).toBe(33);
    expect(refillMm(6, 20)).toBe(12);
    // Without a depth there is no depth of water to state.
    expect(refillMm(11, 0)).toBeNull();
    expect(refillMm(null, 30)).toBeNull();
  });

  it('reads water content as a percent whether it arrives as one or as a fraction', () => {
    // Not pinned against live data — every sensor answered empty — so the rule is the
    // one thing soil moisture cannot be ambiguous about: nothing sits at or below
    // 1 vol-%, and nothing reaches 100.
    expect(waterPercent(0.24)).toBe(24);
    expect(waterPercent(24)).toBe(24);
    expect(waterPercent(1)).toBe(100);
    expect(waterPercent(null)).toBeNull();
  });
});

describe('soil series', () => {
  const row = (timestamp: string, tension: number, status: number) => ({
    timestamp, station_name: 'Perceel Noord',
    water_tension: tension, status_code: status, pF: 2.345,
    water_percentage: 0.238, bijvulruimte: 11, water_until_nonschaarste: 6,
    temperature_placement_depth: 16.44, precipitation: 0.6,
  });

  it('stamps an hourly row at the start of the hour it covers', async () => {
    // A row at 14:00Z covers 13:00Z–14:00Z. At UTC+2 that is the local hour 15:00.
    const f = mockFetch([row('2026-07-01T14:00:00Z', 48, 2)]);
    const out = await fetchSoilRange('t', 'a', 7200, 30, '2026-07-01', '2026-07-01', { fetchImpl: f });
    expect(out).toHaveLength(1);
    expect(out[0]!.time).toBe('2026-07-01T15:00');
    expect(out[0]!.tension).toBe(48);
    expect(out[0]!.status).toBe(2);
    expect(out[0]!.refillMm).toBe(33);
    expect(out[0]!.refillToScarceMm).toBe(18);
    expect(out[0]!.waterPercent).toBe(23.8);
    expect(out[0]!.pF).toBe(2.35);
    expect(out[0]!.soilTemp).toBe(16.4);
    // A BASIC sensor has no canopy probe; the fields stay null rather than borrowing
    // the 1.50 m readings, which are a different quantity.
    expect(out[0]!.temp10).toBeNull();
    expect(out[0]!.humidity10).toBeNull();
    expect(out[0]!.leafWetProxy).toBeNull();
  });

  it('keeps a raw reading on its own half hour, and sorts oldest first', async () => {
    // NDJSON, newest first, with the half-hour grid the sensor reports on.
    const body = [
      JSON.stringify(row('2026-07-01T14:37:00Z', 51, 2)),
      JSON.stringify(row('2026-07-01T14:05:00Z', 49, 2)),
    ].join('\n');
    const f = mockFetch(body);
    const out = await fetchSoilReadings('t', 'a', 7200, 30, '2026-07-01', '2026-07-01', { fetchImpl: f });

    expect(out.map((s) => s.time)).toEqual(['2026-07-01T16:00', '2026-07-01T16:30']);
    // A reading is stamped at the instant it was taken, so it is not shifted back
    // the way an aggregate is.
    expect(out.map((s) => s.tension)).toEqual([49, 51]);
  });

  it('takes the canopy sensor and the leaf-wetness proxy where a CropExact sends them', async () => {
    const f = mockFetch([{
      ...row('2026-07-01T14:00:00Z', 48, 2),
      temperature_10: 19.27, humidity_10: 96.4, dewpoint: 18.6, leaf_wet: true,
    }]);
    const out = await fetchLatestSoilMeasurement('t', 'a', 7200, 30, { fetchImpl: f });
    expect(out.current!.temp10).toBe(19.3);
    expect(out.current!.humidity10).toBe(96);
    expect(out.current!.leafWetProxy).toBe(true);
    expect(out.stationName).toBe('Perceel Noord');
  });

  it('answers empty rather than failing when the sensor is out of the ground', async () => {
    // Which is what every sensor on the account did on 17 September 2026.
    const f = mockFetch([]);
    expect(await fetchSoilRange('t', 'a', 7200, 30, '2026-09-01', '2026-09-17', { fetchImpl: f })).toEqual([]);
    expect((await fetchLatestSoilMeasurement('t', 'a', 7200, 30, { fetchImpl: f })).current).toBeNull();
  });
});

describe('placements', () => {
  const clay: Placement = {
    stationId: 's1', placementId: 'p1', lat: 51.7, lon: 5.5,
    from: '2026-04-01T00:00:00Z', to: '2026-07-20T00:00:00Z',
    crop: 'Aardappel', soil: 'matig zware klei', depthCm: 30,
    thresholds: HEESCH,
  };
  const sand: Placement = {
    stationId: 's1', placementId: 'p2', lat: 51.72, lon: 5.55,
    from: '2026-08-01T00:00:00Z', to: null,
    crop: 'Suikerbiet', soil: 'zand', depthCm: 25,
    thresholds: { scarce: 18, irrigate: 30, critical: 40 },
  };
  const both = [clay, sand];

  it('answers with the placement in force at a moment, and nothing in the gap', () => {
    expect(placementAt(both, '2026-05-10T12:00:00Z')?.placementId).toBe('p1');
    expect(placementAt(both, '2026-09-10T12:00:00Z')?.placementId).toBe('p2');
    // The sensor was out of the ground between the two, and before the first.
    expect(placementAt(both, '2026-07-25T12:00:00Z')).toBeNull();
    expect(placementAt(both, '2026-03-01T12:00:00Z')).toBeNull();
    // The moment of a move belongs to the placement that is starting.
    expect(placementAt(both, '2026-08-01T00:00:00Z')?.placementId).toBe('p2');
    expect(currentPlacement(both)?.placementId).toBe('p2');
  });

  it('breaks a series at a move, so the threshold line can step with it', () => {
    const samples = [
      { measTime: '2026-05-01T10:00:00Z' },
      { measTime: '2026-06-01T10:00:00Z' },
      { measTime: '2026-09-01T10:00:00Z' },
    ];
    const segments = segmentByPlacement(samples, both);
    expect(segments).toHaveLength(2);
    expect(segments[0]!.placement?.thresholds.critical).toBe(60);
    expect(segments[0]!.samples).toHaveLength(2);
    // Drawn over one line with today's thresholds, the first half would sit under a
    // critical line of 40 that never applied to it.
    expect(segments[1]!.placement?.thresholds.critical).toBe(40);
  });

  it('marks the placement made from current settings as assumed', () => {
    const p = placementFromStation(
      { id: 's1', lat: 51.7, lon: 5.5, crop: 'Aardappel', depthCm: 30, thresholds: HEESCH },
      '2026-04-01T00:00:00Z'
    )!;
    expect(p.assumed).toBe(true);
    expect(p.to).toBeNull();
    // The soil type is not on `/soilstations/` yet, so it is null rather than guessed.
    expect(p.soil).toBeNull();
    // Without thresholds or a depth there is no placement to make.
    expect(placementFromStation(
      { id: 's2', lat: 51.7, lon: 5.5, crop: null, depthCm: null, thresholds: HEESCH },
      '2026-04-01T00:00:00Z'
    )).toBeNull();
  });
});

describe('winter', () => {
  const now = new Date('2026-11-01T12:00:00Z');

  it('calls a sensor dormant rather than broken after a fortnight of silence', () => {
    expect(isDormant('2026-10-31T12:00:00Z', now)).toBe(false);
    expect(isDormant(new Date(now.getTime() - DORMANT_AFTER_MS + 3600_000).toISOString(), now)).toBe(false);
    expect(isDormant('2026-10-03T12:00:00Z', now)).toBe(true);
    // Nothing known is the winter answer too, not an error state.
    expect(isDormant(null, now)).toBe(true);
    expect(isDormant('niet een datum', now)).toBe(true);
  });
});
