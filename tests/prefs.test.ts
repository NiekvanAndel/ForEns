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
  adviceFamilyOn, enabledAdviceFamilies, toggleAdviceFamily,
  DEFAULT_PREFS, DEFAULT_LOCATION, DEFAULT_ADVICE_LAYER,
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
    const out = mergePrefs({ useHarmonie: 'false', showSpread: 1 });
    expect(out.useHarmonie).toBe(true);
    expect(out.showSpread).toBe(true);
  });

  it('reads a stored integration field by field', () => {
    const out = mergePrefs({
      integrations: {
        agroexact: { connected: true, account: 'niek@agroexact.nl', useForCurrentLocation: 'yes' },
      },
    });
    const agro = out.integrations.agroexact!;
    expect(agro.connected).toBe(true);
    expect(agro.account).toBe('niek@agroexact.nl');
    // A field written by an older version, or by nothing at all, falls back rather
    // than leaving a half-built object behind.
    expect(agro.useForCurrentLocation).toBe(false);
    expect(agro.lastSyncMs).toBeNull();
  });

  it('ignores an integrations block that is not one', () => {
    expect(mergePrefs({ integrations: { agroexact: 'yes' } }).integrations).toEqual({});
    expect(mergePrefs({ integrations: 'none' }).integrations).toEqual({});
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

describe('the stored grid arrangement', () => {
  it('survives a stored value that lost half of itself', () => {
    const merged = mergePrefs({ tiles: { order: ['temp', 7, null], hidden: 'nope' } });
    expect(merged.tiles).toEqual({ order: ['temp'], hidden: [] });
  });

  it('falls back to the default when there is nothing stored', () => {
    expect(mergePrefs({}).tiles).toEqual({ order: [], hidden: [] });
    expect(mergePrefs({ tiles: 'broken' }).tiles).toEqual({ order: [], hidden: [] });
  });
});

describe('the advice layer', () => {
  it('is on, whole, for somebody who has never touched it', () => {
    expect(mergePrefs({}).advice).toEqual({ enabled: true, hidden: [] });
    expect(DEFAULT_PREFS.advice).toEqual({ enabled: true, hidden: [] });
  });

  it('reads as on when the stored value predates the master switch', () => {
    // A store written before the switch existed says only what is off, and that is
    // exactly what it means: on, minus these.
    expect(mergePrefs({ advice: { hidden: ['spray'] } }).advice)
      .toEqual({ enabled: true, hidden: ['spray'] });
  });

  it('keeps whichever half of a broken stored value is still readable', () => {
    expect(mergePrefs({ advice: { enabled: false, hidden: ['spray', 3, null] } }).advice)
      .toEqual({ enabled: false, hidden: ['spray'] });
    expect(mergePrefs({ advice: 'broken' }).advice).toEqual({ enabled: true, hidden: [] });
  });

  it('switches one family off and back on again', () => {
    const off = toggleAdviceFamily(DEFAULT_ADVICE_LAYER, 'frost');
    expect(adviceFamilyOn(off, 'frost')).toBe(false);
    expect(adviceFamilyOn(off, 'spray')).toBe(true);
    expect(toggleAdviceFamily(off, 'frost')).toEqual(DEFAULT_ADVICE_LAYER);
  });

  it('silences every family when the master switch is off', () => {
    const shut = { enabled: false, hidden: [] };
    expect(adviceFamilyOn(shut, 'spray')).toBe(false);
    expect(enabledAdviceFamilies(['spray', 'frost'], shut)).toEqual([]);
  });

  it('lets a family added later speak for somebody who arranged the old ones', () => {
    const layer = { enabled: true, hidden: ['spray'] };
    expect(enabledAdviceFamilies(['spray', 'frost', 'workability'], layer))
      .toEqual(['frost', 'workability']);
  });
});

describe('the card order on Nu', () => {
  it('starts empty, so the catalogue\'s own order stands', () => {
    expect(mergePrefs({}).nowCards).toEqual({ order: [], hidden: [] });
  });

  it('survives a stored value that lost half of itself', () => {
    expect(mergePrefs({ nowCards: { order: ['advice', 7], hidden: 'nope' } }).nowCards)
      .toEqual({ order: ['advice'], hidden: [] });
  });

  it('is kept apart from the grid and the overview', () => {
    // Three arrangements over the same machinery, and a reader who drags a card on
    // 'Nu' must not find their blocks reordered on 'Actueel'.
    const merged = mergePrefs({ nowCards: { order: ['advice'], hidden: [] } });
    expect(merged.tiles).toEqual({ order: [], hidden: [] });
    expect(merged.overview.order).toEqual([]);
  });
});
