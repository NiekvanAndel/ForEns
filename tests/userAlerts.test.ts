/**
 * Thresholds a grower sets themselves.
 *
 * The rules are stored on the device and handed to a push service that does not exist
 * yet, so these are what say the model is right before anything evaluates it.
 */
import { describe, expect, it } from 'vitest';
import {
  draftProblem, evaluateAlert, makeAlert, removeAlert, sanitiseAlerts,
  setAlertEnabled, upsertAlert, watchedStationIds,
  type DraftAlert, type UserAlert,
} from '../core/alerts';
import { mergePrefs, DEFAULT_PREFS } from '../core/prefs';
import { buildRegistration, registrationDigest } from '../core/push';

const draft = (over: Partial<DraftAlert> = {}): DraftAlert => ({
  tileId: 'temp', title: 'Temperatuur', timeLabel: 'nu', kind: 'temp',
  op: 'below', value: 2, stationIds: ['s1'], stationNames: ['Hedikhuizen'], ...over,
});

const alert = (over: Partial<UserAlert> = {}): UserAlert =>
  ({ ...makeAlert(draft())!, ...over });

describe('draftProblem', () => {
  it('names the one thing missing, not just "invalid"', () => {
    // A disabled button with no reason is the commonest way a form strands somebody.
    expect(draftProblem(draft())).toBeNull();
    expect(draftProblem(draft({ value: null }))).toBe('value');
    expect(draftProblem(draft({ value: NaN }))).toBe('value');
    expect(draftProblem(draft({ stationIds: [] }))).toBe('stations');
  });

  it('accepts zero and a negative, which are the rules people actually set', () => {
    expect(draftProblem(draft({ value: 0 }))).toBeNull();
    expect(draftProblem(draft({ value: -2 }))).toBeNull();
  });
});

describe('makeAlert', () => {
  it('refuses an incomplete draft rather than storing half a rule', () => {
    expect(makeAlert(draft({ stationIds: [] }))).toBeNull();
    expect(makeAlert(draft({ value: null }))).toBeNull();
  });

  it('starts enabled, and keeps what the block was called', () => {
    const a = makeAlert(draft())!;
    expect(a.enabled).toBe(true);
    expect(a.tileId).toBe('temp');
    expect(a.title).toBe('Temperatuur');
    expect(a.stationNames).toEqual(['Hedikhuizen']);
  });

  it('gives two rules made in the same millisecond different ids', () => {
    // The id is what deletes one, so a collision deletes the wrong rule.
    const a = makeAlert(draft(), 1000)!;
    const b = makeAlert(draft(), 1000)!;
    expect(a.id).not.toBe(b.id);
  });

  it('copies the station list rather than holding the draft’s', () => {
    const d = draft();
    const a = makeAlert(d)!;
    d.stationIds.push('s2');
    expect(a.stationIds).toEqual(['s1']);
  });
});

describe('evaluateAlert', () => {
  it('is strictly more and strictly less', () => {
    // A rule set at exactly the current reading should not fire the moment it is
    // saved: "more than 2" is not "2 or more" to anybody who types it.
    const above = alert({ op: 'above', value: 2 });
    expect(evaluateAlert(above, 2)).toBe(false);
    expect(evaluateAlert(above, 2.1)).toBe(true);

    const below = alert({ op: 'below', value: 2 });
    expect(evaluateAlert(below, 2)).toBe(false);
    expect(evaluateAlert(below, 1.9)).toBe(true);
  });

  it('does not fire on a station that stopped reporting', () => {
    // A gap is not a safe number. Firing on it would be the app inventing weather.
    const a = alert({ op: 'below', value: 2 });
    expect(evaluateAlert(a, null)).toBe(false);
    expect(evaluateAlert(a, undefined)).toBe(false);
    expect(evaluateAlert(a, NaN)).toBe(false);
  });

  it('stays quiet while it is switched off', () => {
    expect(evaluateAlert(alert({ op: 'below', value: 2, enabled: false }), -5)).toBe(false);
  });
});

describe('watchedStationIds', () => {
  it('is what a poller has to fetch, and no more', () => {
    const list = [
      alert({ id: 'a', stationIds: ['s1', 's2'] }),
      alert({ id: 'b', stationIds: ['s2', 's3'] }),
      alert({ id: 'c', stationIds: ['s9'], enabled: false }),
    ];
    expect(watchedStationIds(list)).toEqual(['s1', 's2', 's3']);
  });
});

describe('the list operations', () => {
  const a = alert({ id: 'a' });
  const b = alert({ id: 'b' });

  it('replaces by id rather than appending a second copy', () => {
    const edited = { ...a, value: 5 };
    expect(upsertAlert([a, b], edited)).toEqual([edited, b]);
    expect(upsertAlert([a], b)).toEqual([a, b]);
  });

  it('removes and toggles the one asked for', () => {
    expect(removeAlert([a, b], 'a')).toEqual([b]);
    expect(setAlertEnabled([a, b], 'b', false)[1]!.enabled).toBe(false);
    expect(setAlertEnabled([a, b], 'b', false)[0]!.enabled).toBe(true);
  });
});

describe('sanitiseAlerts', () => {
  it('keeps the good ones when one is malformed', () => {
    // Stored state outlives the code that wrote it, and one bad rule must not cost
    // the reader the others.
    const good = alert({ id: 'good' });
    const out = sanitiseAlerts([
      good,
      { ...good, id: '' },
      { ...good, id: 'x', value: 'warm' },
      { ...good, id: 'y', op: 'between' },
      { ...good, id: 'z', stationIds: [] },
      null,
      'nonsense',
    ]);
    expect(out.map((a) => a.id)).toEqual(['good']);
  });

  it('fills in what it can rather than dropping a rule over a missing label', () => {
    const out = sanitiseAlerts([
      { id: 'a', tileId: 'temp', op: 'above', value: 30, stationIds: ['s1'] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.title).toBe('temp');
    expect(out[0]!.enabled).toBe(true);
  });

  it('is empty for anything that is not a list', () => {
    expect(sanitiseAlerts(null)).toEqual([]);
    expect(sanitiseAlerts({ a: 1 })).toEqual([]);
  });
});

describe('preferences', () => {
  it('round-trips a rule through storage', () => {
    const a = alert({ id: 'keep' });
    const merged = mergePrefs({ ...DEFAULT_PREFS, userAlerts: [a] });
    expect(merged.userAlerts.map((x) => x.id)).toEqual(['keep']);
  });

  it('defaults to none', () => {
    expect(mergePrefs(null).userAlerts).toEqual([]);
  });
});

describe('the push registration', () => {
  const ON = {
    ...DEFAULT_PREFS,
    alertsEnabled: true,
    pushEnabled: true,
    locations: [{ name: 'Wageningen', lat: 51.9, lon: 5.6 }],
  };
  const opts = { token: 'tok', tzOffsetSec: 0, appVersion: '0.1' };

  it('carries a rule even where no built-in kind is wanted', () => {
    // A grower watching one station's temperature and nothing else still wants their
    // rule, so the rules are reason enough to register on their own.
    const prefs = { ...ON, notifyRain: false, userAlerts: [alert({ id: 'r1' })] };
    const reg = buildRegistration(prefs, opts)!;
    expect(reg).not.toBeNull();
    expect(reg.kinds).toEqual([]);
    expect(reg.rules).toEqual([
      { id: 'r1', tileId: 'temp', op: 'below', value: 2, stationIds: ['s1'] },
    ]);
  });

  it('leaves out the ones switched off', () => {
    const prefs = {
      ...ON,
      notifyRain: true,
      userAlerts: [alert({ id: 'on' }), alert({ id: 'off', enabled: false })],
    };
    expect(buildRegistration(prefs, opts)!.rules.map((r) => r.id)).toEqual(['on']);
  });

  it('sends the threshold in canonical units, whatever the phone shows', () => {
    // The whole reason it is stored canonical: a service must not have to know what
    // the reader picked.
    const prefs = { ...ON, tempUnit: 'F' as const, userAlerts: [alert({ value: 2 })] };
    expect(buildRegistration(prefs, opts)!.rules[0]!.value).toBe(2);
  });

  it('re-registers when a rule changes and not when a title does', () => {
    const base = { ...ON, userAlerts: [alert({ id: 'r' })] };
    const renamed = { ...ON, userAlerts: [alert({ id: 'r', title: 'Iets anders' })] };
    const retuned = { ...ON, userAlerts: [alert({ id: 'r', value: 9 })] };
    const digest = (p: typeof base) => registrationDigest(buildRegistration(p, opts));

    expect(digest(renamed)).toBe(digest(base));
    expect(digest(retuned)).not.toBe(digest(base));
  });

  it('orders rules and their stations, so the same set always hashes the same', () => {
    const one = { ...ON, userAlerts: [alert({ id: 'b' }), alert({ id: 'a' })] };
    const other = { ...ON, userAlerts: [alert({ id: 'a' }), alert({ id: 'b' })] };
    expect(registrationDigest(buildRegistration(one, opts)))
      .toBe(registrationDigest(buildRegistration(other, opts)));
  });
});
