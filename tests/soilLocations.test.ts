/**
 * Binding soil sensors to places.
 *
 * The radius is the whole argument: 200 m, because a soil sensor measures the water
 * in one field and at two kilometres you are on somebody else's. These pin what that
 * means in practice — that almost every sensor becomes its own page, that the two
 * syncs do not delete each other's work, and that a sensor leaving the account takes
 * only what it brought.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PREFS, SOIL_COUPLING_KM,
  syncSoilLocations, syncStationLocations, unlinkStationLocations,
  type Prefs, type SavedLocation, type SoilPlace,
} from '../core/prefs';

const at = (lat: number, lon: number, over: Partial<SavedLocation> = {}): SavedLocation =>
  ({ name: 'Plek', lat, lon, ...over });

const prefsWith = (locations: SavedLocation[]): Prefs =>
  ({ ...DEFAULT_PREFS, locations, activeLocation: 0 });

/** Roughly a metre of latitude, for placing a sensor a known distance away. */
const M = 1 / 111_320;

const sensor = (id: string, lat: number, lon: number, name = 'Perceel Noord'): SoilPlace =>
  ({ stationId: id, stationName: name, lat, lon });

describe('the 200 metre rule', () => {
  it('is 200 metres, not two kilometres', () => {
    expect(SOIL_COUPLING_KM).toBe(0.2);
  });

  it('couples a sensor standing on a saved place', () => {
    const p = prefsWith([at(51.73, 5.53, { name: 'Heesch' })]);
    // 150 m north: the same field.
    const out = syncSoilLocations(p, [sensor('s1', 51.73 + 150 * M, 5.53)]);
    expect(out.locations).toHaveLength(1);
    expect(out.locations[0]).toMatchObject({
      name: 'Heesch', soilStationId: 's1', soilStationName: 'Perceel Noord',
    });
  });

  it('gives a sensor its own page as soon as it is a field away', () => {
    const p = prefsWith([at(51.73, 5.53, { name: 'Heesch' })]);
    // 400 m: near enough to see, far enough to be different ground.
    const out = syncSoilLocations(p, [sensor('s1', 51.73 + 400 * M, 5.53)]);
    expect(out.locations).toHaveLength(2);
    expect(out.locations[0]!.soilStationId).toBeUndefined();
    // Named after the field. A reverse-geocoded town would put four fields on one
    // village and leave the reader unable to say which is which.
    expect(out.locations[1]).toMatchObject({
      name: 'Perceel Noord', soilStationId: 's1', source: 'agroexact',
    });
  });

  it('gives every sensor its own page when none is near anything', () => {
    // Which is this account: the nearest sensor to the first location is 287 km away.
    const p = prefsWith([at(51.73, 5.53, { name: 'Heesch' })]);
    const out = syncSoilLocations(p, [
      sensor('s1', 51.5, 3.8, 'Kortgene'),
      sensor('s2', 52.6, 6.8, 'Echteler'),
      sensor('s3', 51.3, 5.3, 'Demoveld'),
      sensor('s4', 52.1, 4.4, 'Kavel 3'),
    ]);
    expect(out.locations).toHaveLength(5);
    expect(out.locations.map((l) => l.name))
      .toEqual(['Heesch', 'Kortgene', 'Echteler', 'Demoveld', 'Kavel 3']);
  });

  it('puts a second sensor on the same field on its own page', () => {
    const p = prefsWith([at(51.73, 5.53, { name: 'Heesch' })]);
    const out = syncSoilLocations(p, [
      sensor('s1', 51.73, 5.53, 'Noord'),
      sensor('s2', 51.73 + 50 * M, 5.53, 'Zuid'),
    ]);
    // Two instruments on one place are two fields as far as this app can tell, and
    // the second must not overwrite the first's readings.
    expect(out.locations).toHaveLength(2);
    expect(out.locations[0]!.soilStationId).toBe('s1');
    expect(out.locations[1]).toMatchObject({ name: 'Zuid', soilStationId: 's2' });
  });
});

describe('the two syncs living together', () => {
  it('does not let the station sync delete a field', () => {
    // The station sync drops every agroexact location without a weather station, and
    // a soil location has never had one. Without the guard, one refresh of the
    // station list would delete every field on the account.
    const p = syncSoilLocations(
      prefsWith([at(51.73, 5.53, { name: 'Heesch' })]),
      [sensor('s1', 51.5, 3.8, 'Kortgene')]
    );
    const after = syncStationLocations(p, []);
    expect(after.locations.map((l) => l.name)).toContain('Kortgene');
  });

  it('leaves a weather pole page alone and gives the sensor its own', () => {
    // Two instruments answering different questions, sharing a fence post. The pole's
    // page is the air over a region; the sensor's page is the water in one field.
    const withStation = prefsWith([
      at(51.73, 5.53, { name: 'Heesch', stationId: 'w1', source: 'agroexact' }),
    ]);
    const after = syncSoilLocations(withStation, [sensor('s1', 51.73, 5.53, 'Noord')]);
    expect(after.locations).toHaveLength(2);
    expect(after.locations[0]!.soilStationId).toBeUndefined();
    expect(after.locations[1]).toMatchObject({ name: 'Noord', soilStationId: 's1' });
  });

  it('keeps both pages when the station sync later renames the pole', () => {
    const withStation = prefsWith([
      at(51.73, 5.53, { name: 'Heesch', stationId: 'w1', source: 'agroexact' }),
    ]);
    const bound = syncSoilLocations(withStation, [sensor('s1', 51.73, 5.53, 'Noord')]);
    const after = syncStationLocations(bound, [{
      stationId: 'w1', stationName: 'Weide', lat: 51.73, lon: 5.53, place: 'Nistelrode',
    }]);
    expect(after.locations.map((l) => l.name)).toEqual(['Nistelrode', 'Noord']);
  });
});

describe('the two syncs landing in either order', () => {
  it('folds a field back in when an ordinary place arrives on top of it later', () => {
    // The soil sync went first, so the sensor made its own page. Then a saved place
    // turned up fifty metres away — the same ground, two pages. A weather station
    // arriving there would not do this; see the test above.
    const first = syncSoilLocations(prefsWith([]), [sensor('s1', 51.73, 5.53, 'Noord')]);
    expect(first.locations).toHaveLength(1);

    const withPlace = {
      ...first,
      locations: [...first.locations, at(51.73 + 50 * M, 5.53, { name: 'Heesch' })],
    };
    const after = syncSoilLocations(withPlace, [sensor('s1', 51.73, 5.53, 'Noord')]);

    expect(after.locations).toHaveLength(1);
    expect(after.locations[0]).toMatchObject({ name: 'Heesch', soilStationId: 's1' });
  });

  it('leaves a field alone when the place that turns up is a field away', () => {
    const first = syncSoilLocations(prefsWith([]), [sensor('s1', 51.73, 5.53, 'Noord')]);
    const withPole = {
      ...first,
      locations: [...first.locations, at(51.73 + 400 * M, 5.53, { name: 'Heesch' })],
    };
    const after = syncSoilLocations(withPole, [sensor('s1', 51.73, 5.53, 'Noord')]);
    expect(after.locations).toHaveLength(2);
    expect(after.locations.find((l) => l.name === 'Noord')?.soilStationId).toBe('s1');
  });
});

describe('a sensor leaving the account', () => {
  it('takes its own page with it', () => {
    const p = syncSoilLocations(
      prefsWith([at(51.73, 5.53, { name: 'Heesch' })]),
      [sensor('s1', 51.5, 3.8, 'Kortgene')]
    );
    expect(syncSoilLocations(p, []).locations.map((l) => l.name)).toEqual(['Heesch']);
  });

  it('leaves a place that existed before it, minus the binding', () => {
    // A place the reader saved is a place. It does not stop existing because an
    // instrument on it was taken away.
    const p = syncSoilLocations(
      prefsWith([at(51.73, 5.53, { name: 'Heesch' })]),
      [sensor('s1', 51.73, 5.53)]
    );
    const after = syncSoilLocations(p, []);
    expect(after.locations).toHaveLength(1);
    expect(after.locations[0]).toMatchObject({ name: 'Heesch' });
    expect(after.locations[0]!.soilStationId).toBeUndefined();
  });

  it('drops the soil binding when the whole integration is unlinked', () => {
    const p = syncSoilLocations(
      prefsWith([at(51.73, 5.53, { name: 'Heesch' })]),
      [sensor('s1', 51.73, 5.53)]
    );
    const after = unlinkStationLocations(p);
    expect(after.locations[0]!.soilStationId).toBeUndefined();
    expect(after.locations[0]!.name).toBe('Heesch');
  });
});
