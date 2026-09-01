/**
 * Preference merging tests.
 *
 * Stored preferences outlive the code that wrote them, so the merge has to survive
 * anything an older or corrupted store can hand it. A crash here would be a crash on
 * launch, with no way for the user to recover short of deleting the app.
 */
import { describe, it, expect } from 'vitest';
import {
  mergePrefs, activeLocation, currentLocationIndex, withCurrentLocation,
  DEFAULT_PREFS, DEFAULT_LOCATION,
} from '../core/prefs';

describe('mergePrefs', () => {
  it('returns the defaults for anything unusable', () => {
    for (const input of [null, undefined, 42, 'nope', [], true]) {
      expect(mergePrefs(input), String(input)).toEqual(DEFAULT_PREFS);
    }
  });

  it('keeps valid stored values', () => {
    const out = mergePrefs({ lang: 'de', tempUnit: 'F', windUnit: 'bft', theme: 'dark' });
    expect(out.lang).toBe('de');
    expect(out.tempUnit).toBe('F');
    expect(out.windUnit).toBe('bft');
    expect(out.theme).toBe('dark');
  });

  it('rejects values outside the allowed set rather than trusting them', () => {
    const out = mergePrefs({ lang: 'kl', tempUnit: 'R', windUnit: 'furlongs', theme: 'neon' });
    expect(out.lang).toBe(DEFAULT_PREFS.lang);
    expect(out.tempUnit).toBe(DEFAULT_PREFS.tempUnit);
    expect(out.windUnit).toBe(DEFAULT_PREFS.windUnit);
    expect(out.theme).toBe(DEFAULT_PREFS.theme);
  });

  it('rejects a boolean stored as a string', () => {
    const out = mergePrefs({ useHarmonie: 'false', agroExact: 1 });
    expect(out.useHarmonie).toBe(true);
    expect(out.agroExact).toBe(false);
  });

  it('drops malformed locations but keeps the good ones', () => {
    const out = mergePrefs({
      locations: [
        { name: 'Goed', lat: 51.7, lon: 5.3 },
        { name: 'Geen lat', lon: 5.3 },
        { lat: 51.7, lon: 5.3 },
        { name: 'NaN', lat: Number.NaN, lon: 5.3 },
        null,
        { name: 'Ook goed', lat: 52.4, lon: 4.9, stationId: 'st1' },
      ],
    });
    expect(out.locations.map((l) => l.name)).toEqual(['Goed', 'Ook goed']);
    expect(out.locations[1]!.stationId).toBe('st1');
  });

  it('never leaves the app with nothing to show', () => {
    expect(mergePrefs({ locations: [] }).locations).toEqual([DEFAULT_LOCATION]);
    expect(mergePrefs({ locations: [{ bad: true }] }).locations).toEqual([DEFAULT_LOCATION]);
  });

  it('clamps an active index that the location list can no longer support', () => {
    const out = mergePrefs({
      locations: [{ name: 'A', lat: 1, lon: 1 }, { name: 'B', lat: 2, lon: 2 }],
      activeLocation: 9,
    });
    expect(out.activeLocation).toBe(1);
    expect(mergePrefs({ activeLocation: -3 }).activeLocation).toBe(0);
    expect(mergePrefs({ activeLocation: 1.7, locations: [
      { name: 'A', lat: 1, lon: 1 }, { name: 'B', lat: 2, lon: 2 },
    ] }).activeLocation).toBe(1);
  });

  it('ignores unknown keys from a future version', () => {
    const out = mergePrefs({ lang: 'en', somethingNew: { deeply: 'nested' } });
    expect(out.lang).toBe('en');
    expect(out).not.toHaveProperty('somethingNew');
  });
});

describe('activeLocation', () => {
  it('always resolves to a location', () => {
    expect(activeLocation(DEFAULT_PREFS)).toEqual(DEFAULT_LOCATION);
    // An out-of-range index must not produce undefined at a call site.
    expect(activeLocation({ ...DEFAULT_PREFS, activeLocation: 99 })).toEqual(DEFAULT_LOCATION);
    expect(activeLocation({ ...DEFAULT_PREFS, locations: [] })).toEqual(DEFAULT_LOCATION);
  });
});

describe('withCurrentLocation', () => {
  const here = { name: 'Utrecht', lat: 52.09, lon: 5.12 };

  it('puts the device at the head of the list on the first fix', () => {
    const out = withCurrentLocation(DEFAULT_PREFS, here);
    expect(out.locations[0]).toMatchObject({ name: 'Utrecht', current: true });
    expect(out.locations).toHaveLength(DEFAULT_PREFS.locations.length + 1);
    expect(currentLocationIndex(out)).toBe(0);
  });

  it('keeps the reader on the page they were reading', () => {
    // Inserting at the head shifts every saved place one to the right, so the
    // selected index has to move with it or a background fix silently changes
    // which location is on screen.
    const before = {
      ...DEFAULT_PREFS,
      locations: [{ name: 'A', lat: 1, lon: 1 }, { name: 'B', lat: 2, lon: 2 }],
      activeLocation: 1,
    };
    const out = withCurrentLocation(before, here);
    expect(activeLocation(out).name).toBe('B');
  });

  it('replaces the previous fix rather than adding another', () => {
    const once = withCurrentLocation(DEFAULT_PREFS, here);
    const twice = withCurrentLocation(once, { name: 'Amersfoort', lat: 52.15, lon: 5.39 });
    expect(twice.locations.filter((l) => l.current)).toHaveLength(1);
    expect(twice.locations[0]!.name).toBe('Amersfoort');
    // Nothing shifted the second time, so the viewed page is untouched.
    expect(twice.activeLocation).toBe(once.activeLocation);
  });

  it('has no device page until a fix arrives', () => {
    expect(currentLocationIndex(DEFAULT_PREFS)).toBe(-1);
  });
});
